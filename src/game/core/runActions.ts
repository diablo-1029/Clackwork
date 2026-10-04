import { products } from "@/config/products";
import { pacing } from "@/config/progression";
import { clampQuality } from "@/game/economy/multipliers";
import { levelUpBonus } from "@/game/progression/levels";
import { resolveMachineSequence } from "@/game/progression/unlocks";
import { devLog, track } from "@/lib/analytics";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import { useRunStore } from "@/stores/runStore";
import { useUiStore } from "@/stores/uiStore";
import { isFeatureUnlocked } from "@/game/progression/unlocks";
import type { OrderOffer, OrderTwist, ProductionRun, RewardSummary } from "@/types/game";
import { generateOffers, pickProduct, rollGolden } from "./orders";
import { resolveMachineReward, resolveProductReward } from "./RewardResolver";

/**
 * The run controller's non-visual half: every change to coins, XP, streak and
 * unlocks goes through here, guarded by the run store so nothing pays out twice.
 */

function newRunId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

/** Adds XP and handles everything a level-up entails. */
export function grantXp(amount: number): void {
  const levelsGained = usePlayerStore.getState().addXp(amount);
  if (levelsGained.length === 0) return;

  // Every level reached pays its bonus here, the one place levels are gained, so exactly once.
  usePlayerStore.getState().addCoins(levelsGained.reduce((sum, reached) => sum + levelUpBonus(reached), 0));

  const level = usePlayerStore.getState().factoryLevel;
  const newProducts = useProgressionStore.getState().syncUnlocks(level);
  const ui = useUiStore.getState();
  ui.queueLevelUps(levelsGained);
  // A freshly unlocked product arrives as the next order so the player meets it right away.
  ui.queueProducts(newProducts);

  track("level_up", { factoryLevel: level });
  devLog("Progression", `reached level ${level}`);
}

/** Whether the player chooses orders from the board yet. */
export function isOrderBoardUnlocked(): boolean {
  return isFeatureUnlocked("orderBoard", usePlayerStore.getState().factoryLevel);
}

/**
 * The cards on the order board, dealing a fresh set only when there is none.
 * A newly unlocked product (or a debug choice) is always the first card.
 */
export function ensureOffers(): OrderOffer[] {
  const ui = useUiStore.getState();
  if (ui.offers.length > 0) return ui.offers;

  const progression = useProgressionStore.getState();
  const player = usePlayerStore.getState();

  // One scripted Golden card teaches the event; afterwards Golden is chance-based.
  const introduceGolden =
    !progression.onboarding.hasSeenGoldenIntro && player.factoryLevel >= pacing.goldenIntroLevel;
  const goldenFirst = ui.debug.goldenNext || introduceGolden;
  if (ui.debug.goldenNext) ui.setDebug({ goldenNext: false });
  if (introduceGolden) progression.setOnboarding("hasSeenGoldenIntro");

  const forced = ui.queuedProducts;
  if (forced.length > 0) useUiStore.setState({ queuedProducts: [] });

  const offers = generateOffers({
    unlocked: progression.products,
    level: player.factoryLevel,
    goldenTouchLevel: progression.upgrades.goldenTouch,
    productsCompleted: player.totalProductsCompleted,
    forced,
    goldenFirst,
  });
  ui.setOffers(offers);
  return offers;
}

/**
 * Starts the next order: the chosen card if there is one, otherwise an order
 * picked for the player. A run that is still in progress is never replaced.
 */
export function createOrder(offer?: OrderOffer): ProductionRun | null {
  const runStore = useRunStore.getState();
  if (runStore.run && runStore.phase !== "REWARD_SUMMARY") return null;

  const ui = useUiStore.getState();
  const progression = useProgressionStore.getState();
  const player = usePlayerStore.getState();

  let twist: OrderTwist | undefined;
  let productId = offer?.productId;
  if (offer) {
    twist = offer.twist;
    // The board is spent: the next one is dealt fresh.
    ui.setOffers([]);
  } else {
    const queued = ui.shiftQueuedProduct();
    productId = queued && products[queued] ? queued : pickProduct(progression.products);
  }
  const product = (productId && products[productId]) || products.woodBlock;

  let isGolden: boolean;
  if (offer) {
    isGolden = offer.isGolden;
  } else if (ui.debug.goldenNext) {
    isGolden = true;
    ui.setDebug({ goldenNext: false });
  } else if (
    !progression.onboarding.hasSeenGoldenIntro &&
    player.factoryLevel >= pacing.goldenIntroLevel
  ) {
    // One scripted Golden Product teaches the event; afterwards it is chance-based.
    isGolden = true;
    progression.setOnboarding("hasSeenGoldenIntro");
  } else {
    isGolden = rollGolden(progression.upgrades.goldenTouch);
  }

  const run: ProductionRun = {
    id: newRunId(),
    productId: product.id,
    isGolden,
    machineSequence: resolveMachineSequence(product, progression.machines),
    currentMachineIndex: 0,
    results: [],
    startedAt: Date.now(),
    status: "intro",
    rewardCommitted: false,
    twist,
  };

  runStore.startRun(run);
  track("product_started", { productId: product.id, factoryLevel: player.factoryLevel, isGolden });
  devLog("Run", `Created run ${run.id.slice(0, 8)}: ${product.id}${isGolden ? " (golden)" : ""}`);
  return run;
}

export interface MachineOutcome {
  quality: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

/** Commits the active machine's score and pays its XP. Safe to call more than once. */
export function completeMachine(outcome: MachineOutcome): boolean {
  const runStore = useRunStore.getState();
  const { run } = runStore;
  if (!run) return false;

  // Single-tap machines finish in the same gesture that starts them.
  if (runStore.phase === "MACHINE_READY") runStore.dispatch("INTERACTION_START");

  const machineId = run.machineSequence[run.currentMachineIndex];
  const override = useUiStore.getState().debug.qualityOverride;
  const quality = clampQuality(override ?? outcome.quality);

  const committed = useRunStore.getState().commitMachineResult({
    machineId,
    productId: run.productId,
    quality,
    isPerfect: quality >= 100,
    durationMs: Math.max(0, Math.round(outcome.durationMs)),
    metadata: outcome.metadata,
  });
  if (!committed) return false;

  const player = usePlayerStore.getState();
  const reward = resolveMachineReward(quality, player.perfectStreak);
  player.setStreak(reward.streak);
  if (reward.isPerfect) player.incrementPerfect();
  grantXp(reward.xp);

  const progression = useProgressionStore.getState();
  if (machineId === "cutter") progression.setOnboarding("hasCompletedFirstCut");
  if (machineId === "packager") progression.setOnboarding("hasCompletedFirstPackage");

  useRunStore.getState().setFeedback({ machineId, quality, xp: reward.xp, streak: reward.streak });
  track("machine_completed", { machineId, productId: run.productId, quality, durationMs: outcome.durationMs });
  devLog("Machine", `${machineId} result=${quality}`);
  return true;
}

/** Leaves the finished machine: on to the next one, or to product completion. */
export function exitMachine(): void {
  const runStore = useRunStore.getState();
  const { run } = runStore;
  if (!run) return;
  const isLast = run.currentMachineIndex >= run.machineSequence.length - 1;
  if (runStore.dispatch(isLast ? "EXIT_FINAL" : "EXIT_NEXT") && !isLast) {
    devLog("Run", `Enter machine ${run.machineSequence[run.currentMachineIndex + 1]}`);
  }
}

/** Pays out the finished product exactly once and moves to the reward summary. */
export function finishProduct(): RewardSummary | null {
  const runStore = useRunStore.getState();
  if (!runStore.markRewardCommitted()) return null;

  const run = useRunStore.getState().run!;
  const product = products[run.productId];
  const player = usePlayerStore.getState();

  const reward = resolveProductReward({
    product,
    results: run.results,
    streak: player.perfectStreak,
    upgradeLevels: useProgressionStore.getState().upgrades,
    isGolden: run.isGolden,
    twist: run.twist,
  });

  player.addCoins(reward.coins);
  player.incrementProducts();
  grantXp(reward.completionXp);

  const summary: RewardSummary = {
    runId: run.id,
    productId: run.productId,
    isGolden: run.isGolden,
    quality: reward.quality,
    coins: reward.coins,
    xp: reward.machineXp + reward.completionXp,
    streakBonus: reward.streakBonus,
    twist: reward.twist,
  };

  runStore.setLastReward(summary);
  runStore.dispatch("REWARD_RESOLVED");
  track("product_completed", {
    productId: run.productId,
    quality: reward.quality,
    coins: reward.coins,
    isGolden: run.isGolden,
  });
  devLog("Reward", `coins=${summary.coins} xp=${summary.xp}`);
  return summary;
}
