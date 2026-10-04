import { economy } from "@/config/economy";
import type { ProductId } from "@/types/game";

/** Lifetime numbers that are not part of the player's core save. */
export interface FactoryStats {
  bestStreak: number;
  goldenMade: number;
  twistsWon: number;
  overdrives: number;
  products: Partial<Record<ProductId, ProductStat>>;
  /** The best shift so far, by score. */
  bestShift: { score: number; products: number };
}

export interface ProductStat {
  made: number;
  bestQuality: number;
}

export const emptyStats: FactoryStats = {
  bestStreak: 0,
  goldenMade: 0,
  twistsWon: 0,
  overdrives: 0,
  products: {},
  bestShift: { score: 0, products: 0 },
};

/** Everything an achievement can look at. */
export interface AchievementContext {
  productsMade: number;
  perfects: number;
  stats: FactoryStats;
  /** How many products can be made in this version of the game. */
  playableProducts: number;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  /** Coins paid once, when it is earned. */
  reward: number;
  target: number;
  value: (context: AchievementContext) => number;
}

const distinctMade = (context: AchievementContext) =>
  Object.values(context.stats.products).filter((stat) => (stat?.made ?? 0) > 0).length;

const tiers = (
  id: string,
  names: [string, string, string],
  describe: (target: number) => string,
  targets: [number, number, number],
  rewards: [number, number, number],
  value: AchievementDefinition["value"],
): AchievementDefinition[] =>
  targets.map((target, i) => ({
    id: `${id}${target}`,
    name: names[i],
    description: describe(target),
    reward: rewards[i],
    target,
    value,
  }));

export const achievements: AchievementDefinition[] = [
  ...tiers(
    "made",
    ["Getting Started", "Production Line", "Industrialist"],
    (target) => `Make ${target} products.`,
    [10, 50, 200],
    [50, 200, 600],
    (context) => context.productsMade,
  ),
  ...tiers(
    "perfect",
    ["Sharp Eye", "Precision Worker", "Perfectionist"],
    (target) => `Get ${target} Perfect results.`,
    [25, 100, 500],
    [50, 200, 600],
    (context) => context.perfects,
  ),
  ...tiers(
    "streak",
    ["On a Roll", "Unstoppable", "Flawless Run"],
    (target) => `Reach a Perfect streak of ${target}.`,
    [5, 10, 15],
    [40, 120, 300],
    (context) => context.stats.bestStreak,
  ),
  ...tiers(
    "shift",
    ["Clocked In", "Overtime", "Employee of the Month"],
    (target) => `Score ${target.toLocaleString("en-US")} in one shift.`,
    [1500, 4000, 8000],
    [60, 200, 500],
    (context) => context.stats.bestShift.score,
  ),
  {
    id: "golden1",
    name: "Struck Gold",
    description: "Finish a Golden order.",
    reward: 100,
    target: 1,
    value: (context) => context.stats.goldenMade,
  },
  {
    id: "overdrive1",
    name: "Running Hot",
    description: "Fill the fever meter and start Overdrive.",
    reward: 100,
    target: 1,
    value: (context) => context.stats.overdrives,
  },
  {
    id: "twist10",
    name: "Plot Twist",
    description: "Win 10 twist orders.",
    reward: 150,
    target: 10,
    value: (context) => context.stats.twistsWon,
  },
  {
    id: "collector",
    name: "Full Catalogue",
    description: "Make every product at least once.",
    reward: 300,
    // Set from the context, so the target follows the product list.
    target: 0,
    value: distinctMade,
  },
];

export function achievementTarget(definition: AchievementDefinition, context: AchievementContext): number {
  return definition.id === "collector" ? context.playableProducts : definition.target;
}

export function isEarned(definition: AchievementDefinition, context: AchievementContext): boolean {
  const target = achievementTarget(definition, context);
  return target > 0 && definition.value(context) >= target;
}

/** Achievements reached now that have not been paid before. */
export function newlyEarned(context: AchievementContext, earned: string[]): AchievementDefinition[] {
  return achievements.filter((definition) => !earned.includes(definition.id) && isEarned(definition, context));
}

/** Folds a finished order into a product's record. */
export function recordProduct(stat: ProductStat | undefined, quality: number): ProductStat {
  return { made: (stat?.made ?? 0) + 1, bestQuality: Math.max(stat?.bestQuality ?? 0, quality) };
}

/** 0–3 mastery stars: made once, made often, then made often with a flawless order among them. */
export function masteryStars(stat: ProductStat | undefined): 0 | 1 | 2 | 3 {
  const made = stat?.made ?? 0;
  const { twoStars, threeStars } = economy.mastery;
  if (made >= threeStars && (stat?.bestQuality ?? 0) >= 100) return 3;
  if (made >= twoStars) return 2;
  return made >= 1 ? 1 : 0;
}
