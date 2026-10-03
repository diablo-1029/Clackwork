import { products } from "@/config/products";
import { pacing } from "@/config/progression";
import { clampQuality } from "@/game/economy/multipliers";
import { resolveMachineSequence } from "@/game/progression/unlocks";
import { devLog, track } from "@/lib/analytics";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import { useRunStore } from "@/stores/runStore";
import { useUiStore } from "@/stores/uiStore";
import type { ProductionRun, RewardSummary } from "@/types/game";
import { pickProduct, rollGolden } from "./orders";
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

  const level = usePlayerStore.getState().factoryLevel;
  const newProducts = useProgressionStore.getState().syncUnlocks(level);
  const ui = useUiStore.getState();
  ui.queueLevelUps(levelsGained);
  // A freshly unlocked product arrives as the next order so the player meets it right away.
  ui.queueProducts(newProducts);

  track("level_up", { factoryLevel: level });
  devLog("Progression", `reached level ${level}`);
}

/** Starts the next order. A run that is still in progress is never replaced. */
export function createOrder(): ProductionRun | null {
  const runStore = useRunStore.getState();
  if (runStore.run && runStore.phase !== "REWARD_SUMMARY") return null;

  const ui = useUiStore.getState();
  const progression = useProgressionStore.getState();
  const player = usePlayerStore.getState();

  const queued = ui.shiftQueuedProduct();
  const productId = queued && products[queued] ? queued : pickProduct(progression.products);
  const product = products[productId] ?? products.woodBlock;

  let isGolden: boolean;
  if (ui.debug.goldenNext) {
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
