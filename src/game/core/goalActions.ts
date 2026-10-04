import { productList } from "@/config/products";
import {
  newlyEarned,
  recordProduct,
  type AchievementContext,
  type FactoryStats,
} from "@/game/progression/achievements";
import { applyGoalEvent, describeGoal, goalBonus, goalsForToday, type GoalEvent } from "@/game/progression/goals";
import { isFeatureUnlocked, isProductPlayable } from "@/game/progression/unlocks";
import { devLog } from "@/lib/analytics";
import { useGoalsStore } from "@/stores/goalsStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import { useUiStore } from "@/stores/uiStore";
import type { ProductId } from "@/types/game";

/**
 * Goals, achievements and lifetime stats. Like runActions, this is the one place
 * their rewards are paid, so each goal and achievement pays exactly once.
 */

export function areGoalsUnlocked(): boolean {
  return isFeatureUnlocked("goals", usePlayerStore.getState().factoryLevel);
}

/** Deals today's goals if the stored ones are from another day. Safe to call any time. */
export function refreshGoals(now: Date = new Date()): void {
  if (!areGoalsUnlocked()) return;
  const store = useGoalsStore.getState();
  const today = goalsForToday(
    store.goals,
    now,
    usePlayerStore.getState().factoryLevel,
    useProgressionStore.getState().products,
  );
  if (today !== store.goals) store.setGoals(today);
}

export function achievementContext(): AchievementContext {
  const player = usePlayerStore.getState();
  return {
    productsMade: player.totalProductsCompleted,
    perfects: player.totalPerfects,
    stats: useGoalsStore.getState().stats,
    playableProducts: productList.filter(isProductPlayable).length,
  };
}

/** What a play event adds to the lifetime stats. */
export type ProgressEvent =
  | { type: "machine"; perfect: boolean; streak: number; overdriveStarted: boolean }
  | { type: "order"; productId: ProductId; quality: number; coins: number; isGolden: boolean; twistWon: boolean }
  | { type: "shift"; score: number; products: number };

function statsAfter(stats: FactoryStats, event: ProgressEvent): FactoryStats {
  if (event.type === "shift") {
    return event.score > stats.bestShift.score
      ? { ...stats, bestShift: { score: event.score, products: event.products } }
      : stats;
  }
  if (event.type === "machine") {
    return {
      ...stats,
      bestStreak: Math.max(stats.bestStreak, event.streak),
      overdrives: stats.overdrives + (event.overdriveStarted ? 1 : 0),
    };
  }
  return {
    ...stats,
    goldenMade: stats.goldenMade + (event.isGolden ? 1 : 0),
    twistsWon: stats.twistsWon + (event.twistWon ? 1 : 0),
    products: { ...stats.products, [event.productId]: recordProduct(stats.products[event.productId], event.quality) },
  };
}

/**
 * Called after every machine result and every finished order. Stats are always
 * kept; goals and achievements only move, and pay, once the feature is unlocked.
 */
export function recordProgress(event: ProgressEvent, now: Date = new Date()): void {
  const store = useGoalsStore.getState();
  store.setStats(statsAfter(store.stats, event));
  if (!areGoalsUnlocked()) return;

  const player = usePlayerStore.getState();
  const messages: string[] = [];
  let coins = 0;

  refreshGoals(now);
  const current = useGoalsStore.getState().goals;
  const goalEvent: GoalEvent | null =
    event.type === "machine"
      ? { type: "machine", perfect: event.perfect, streak: event.streak }
      : event.type === "order"
        ? { type: "order", productId: event.productId, coins: event.coins, twistWon: event.twistWon }
        : null;
  // The end of a shift only matters to stats and achievements.
  const step = goalEvent ? applyGoalEvent(current.items, goalEvent) : { goals: current.items, completed: [] };

  for (const goal of step.completed) {
    coins += goal.reward;
    messages.push(`Goal complete: ${describeGoal(goal)} (+${goal.reward})`);
  }
  let bonusPaid = current.bonusPaid;
  if (!bonusPaid && step.goals.length > 0 && step.goals.every((goal) => goal.done)) {
    const bonus = goalBonus(player.factoryLevel);
    bonusPaid = true;
    coins += bonus;
    messages.push(`All goals done! Bonus +${bonus}`);
  }
  useGoalsStore.getState().setGoals({ ...current, items: step.goals, bonusPaid });

  const earned = newlyEarned(achievementContext(), useGoalsStore.getState().achievements);
  if (earned.length > 0) {
    useGoalsStore.getState().addAchievements(earned.map((definition) => definition.id));
    for (const definition of earned) {
      coins += definition.reward;
      messages.push(`Achievement: ${definition.name} (+${definition.reward})`);
    }
  }

  if (messages.length === 0) return;
  player.addCoins(coins);
  useGoalsStore.getState().addUnseen(messages.length);
  // One toast for everything this event completed.
  useUiStore
    .getState()
    .showToast(messages.length > 2 ? `${messages[0]} and ${messages.length - 1} more` : messages.join(" · "));
  devLog("Goals", messages.join(" | "));
}
