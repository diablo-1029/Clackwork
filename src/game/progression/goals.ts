import { economy } from "@/config/economy";
import { featureUnlocks } from "@/config/progression";
import { products } from "@/config/products";
import { seededRandom } from "@/lib/math";
import type { ProductId } from "@/types/game";

/**
 * Daily goals: three small targets picked from the date, the same for the whole
 * day. They refresh on the next day; nothing is lost by skipping one.
 */
export type GoalKind = "products" | "perfects" | "twist" | "streak" | "coins" | "product";

export interface DailyGoal {
  kind: GoalKind;
  target: number;
  progress: number;
  /** Reached its target. The reward is paid at that moment, so done also means paid. */
  done: boolean;
  /** Coins paid on completion. */
  reward: number;
  /** For "product" goals: which product to make. */
  productId?: ProductId;
}

export interface DailyGoals {
  /** Local date the goals belong to, as YYYY-MM-DD. Empty before the first deal. */
  date: string;
  items: DailyGoal[];
  /** The bonus for finishing all three has been paid. */
  bonusPaid: boolean;
}

export const emptyGoals: DailyGoals = { date: "", items: [], bonusPaid: false };

/** The player's local calendar day. */
export function dateKey(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function goalReward(level: number): number {
  const { base, perLevel } = economy.goals;
  return base + perLevel * Math.max(1, Math.floor(level));
}

export function goalBonus(level: number): number {
  return goalReward(level) * economy.goals.bonusFactor;
}

function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

const twistLevel = featureUnlocks.find((feature) => feature.id === "orderTwists")?.unlockLevel ?? 4;

/** Targets grow gently with Factory Level, so a day's goals stay a short session. */
function targetFor(kind: GoalKind, level: number): number {
  switch (kind) {
    case "products":
      return Math.min(8, 3 + Math.floor(level / 4));
    case "perfects":
      return Math.min(14, 5 + Math.floor(level / 2));
    case "twist":
      return level >= 8 ? 2 : 1;
    case "streak":
      return Math.min(10, 4 + Math.floor(level / 4));
    case "coins":
      return 40 + 20 * level;
    case "product":
      return level >= 8 ? 3 : 2;
  }
}

/** Three different goals for the day. The same date, level and products always give the same three. */
export function pickDailyGoals(date: string, level: number, unlocked: ProductId[]): DailyGoal[] {
  const random = seededRandom(hash(date));
  const kinds: GoalKind[] = ["products", "perfects", "streak", "coins"];
  if (level >= twistLevel) kinds.push("twist");
  const makeable = unlocked.filter((id) => products[id]);
  if (makeable.length >= 2) kinds.push("product");

  const chosen: GoalKind[] = [];
  while (chosen.length < economy.goals.perDay && kinds.length > 0) {
    chosen.push(...kinds.splice(Math.floor(random() * kinds.length), 1));
  }

  return chosen.map((kind): DailyGoal => {
    const goal: DailyGoal = { kind, target: targetFor(kind, level), progress: 0, done: false, reward: goalReward(level) };
    if (kind === "product") goal.productId = makeable[Math.floor(random() * makeable.length)];
    return goal;
  });
}

/** Today's goals: the stored ones if they are from today, otherwise a fresh set. */
export function goalsForToday(stored: DailyGoals, now: Date, level: number, unlocked: ProductId[]): DailyGoals {
  const today = dateKey(now);
  if (stored.date === today && stored.items.length > 0) return stored;
  return { date: today, items: pickDailyGoals(today, level, unlocked), bonusPaid: false };
}

export type GoalEvent =
  | { type: "machine"; perfect: boolean; streak: number }
  | { type: "order"; productId: ProductId; coins: number; twistWon: boolean };

function progressAfter(goal: DailyGoal, event: GoalEvent): number {
  if (event.type === "machine") {
    if (goal.kind === "perfects" && event.perfect) return goal.progress + 1;
    // A streak goal remembers the best streak reached today.
    if (goal.kind === "streak") return Math.max(goal.progress, event.streak);
    return goal.progress;
  }
  switch (goal.kind) {
    case "products":
      return goal.progress + 1;
    case "coins":
      return goal.progress + Math.max(0, event.coins);
    case "twist":
      return goal.progress + (event.twistWon ? 1 : 0);
    case "product":
      return goal.progress + (event.productId === goal.productId ? 1 : 0);
    default:
      return goal.progress;
  }
}

export interface GoalStep {
  goals: DailyGoal[];
  /** Goals that reached their target on this event. */
  completed: DailyGoal[];
}

/** Moves every unfinished goal forward. A finished goal never moves again. */
export function applyGoalEvent(goals: DailyGoal[], event: GoalEvent): GoalStep {
  const completed: DailyGoal[] = [];
  const next = goals.map((goal) => {
    if (goal.done) return goal;
    const progress = Math.min(goal.target, progressAfter(goal, event));
    const updated = { ...goal, progress, done: progress >= goal.target };
    if (updated.done) completed.push(updated);
    return updated;
  });
  return { goals: next, completed };
}

export function describeGoal(goal: DailyGoal): string {
  switch (goal.kind) {
    case "products":
      return `Make ${goal.target} products`;
    case "perfects":
      return `Get ${goal.target} Perfects`;
    case "twist":
      return goal.target === 1 ? "Win a twist order" : `Win ${goal.target} twist orders`;
    case "streak":
      return `Reach a Perfect streak of ${goal.target}`;
    case "coins":
      return `Earn ${goal.target} coins from orders`;
    case "product": {
      const name = (goal.productId && products[goal.productId]?.name) || "product";
      return `Make ${goal.target} ${name}${goal.target === 1 ? "" : "s"}`;
    }
  }
}
