import { orderBoard, orderTwists } from "@/config/economy";
import { machines } from "@/config/machines";
import { products } from "@/config/products";
import { getGoldenChance } from "@/game/economy/multipliers";
import type { MachineId, OrderOffer, OrderTwist, ProductId } from "@/types/game";

/** Weighted pick from the products the player can currently produce. */
export function pickProduct(unlocked: ProductId[], random: () => number = Math.random): ProductId {
  const pool = unlocked.filter((id) => products[id]);
  if (pool.length === 0) return "woodBlock";

  const total = pool.reduce((sum, id) => sum + products[id].orderWeight, 0);
  let roll = random() * total;
  for (const id of pool) {
    roll -= products[id].orderWeight;
    if (roll < 0) return id;
  }
  return pool[pool.length - 1];
}

/** Rolled once when the order is created; the whole run keeps the outcome. */
export function rollGolden(goldenTouchLevel: number, random: () => number = Math.random): boolean {
  return random() < getGoldenChance(goldenTouchLevel);
}

const TWISTS: OrderTwist[] = ["rush", "precision", "training"];

export interface OfferInput {
  unlocked: ProductId[];
  level: number;
  goldenTouchLevel: number;
  /** How many products the player has finished; the first few orders never carry a twist. */
  productsCompleted: number;
  /** Products that must be on the board, in order (a new unlock, or a debug choice). */
  forced?: ProductId[];
  /** Makes the first card Golden, for the scripted introduction of Golden orders. */
  goldenFirst?: boolean;
  random?: () => number;
  count?: number;
}

/**
 * The cards on the order board. Products are drawn without repeats while there
 * are enough to go round, using flattened weights (the square root of each
 * product's order weight) so newer products are not crowded out by the staples.
 */
export function generateOffers({
  unlocked,
  level,
  goldenTouchLevel,
  productsCompleted,
  forced = [],
  goldenFirst = false,
  random = Math.random,
  count = orderBoard.offerCount,
}: OfferInput): OrderOffer[] {
  const pool = unlocked.filter((id) => products[id]);
  if (pool.length === 0) pool.push("woodBlock");

  const chosen: ProductId[] = forced.filter((id) => products[id]).slice(0, count);
  let remaining = pool.filter((id) => !chosen.includes(id));
  while (chosen.length < count) {
    // Once every product is on the board, extra cards repeat products.
    if (remaining.length === 0) remaining = [...pool];
    const weights = remaining.map((id) => Math.sqrt(products[id].orderWeight));
    let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= weights[i];
      if (roll < 0) {
        index = i;
        break;
      }
    }
    chosen.push(remaining[index]);
    remaining = remaining.filter((_, i) => i !== index);
  }

  const twistsAllowed = level >= orderBoard.twistMinLevel && productsCompleted >= orderBoard.graceOrders;

  return chosen.map((productId, index): OrderOffer => {
    const isNew = index < forced.length && products[productId].unlockLevel === level;
    const isGolden = (goldenFirst && index === 0) || rollGolden(goldenTouchLevel, random);
    // A brand-new product arrives plain, so the first go at it is not complicated by a twist.
    const twist =
      twistsAllowed && !isNew && random() < orderBoard.twistChance
        ? TWISTS[Math.floor(random() * TWISTS.length)]
        : undefined;
    return { id: `offer-${index}-${Math.floor(random() * 1e9).toString(36)}`, productId, isGolden, twist, isNew };
  });
}

/** How many actions a step asked for: two cuts, two strips of tape or two stamps count as two. */
function partsOf(metadata: Record<string, unknown> | undefined): number {
  for (const key of ["cuts", "strips", "presses"]) {
    const parts = metadata?.[key];
    if (Array.isArray(parts)) return Math.max(1, parts.length);
  }
  return 1;
}

/**
 * Hands-on time the steps played are expected to take, used as the target for
 * Rush orders. Steps that asked for more than one action get more time.
 */
export function parTimeMs(steps: { machineId: MachineId; metadata?: Record<string, unknown> }[]): number {
  const seconds = steps.reduce((sum, step) => {
    const base = machines[step.machineId]?.estimatedDurationSeconds ?? 0;
    return sum + base * (1 + orderTwists.rush.extraPartFactor * (partsOf(step.metadata) - 1));
  }, 0);
  return seconds * 1000 * orderTwists.rush.parFactor;
}

export interface TwistOutcome {
  coinMultiplier: number;
  xpMultiplier: number;
  /** Whether the twist's condition was met (always true for twists without one). */
  achieved: boolean;
}

export interface TwistInput {
  quality: number;
  /** Time spent actually working the machines, not waiting between them. */
  activeMs: number;
  parMs: number;
}

/** What a twist does to the payout of a finished order. Pure. */
export function resolveTwist(twist: OrderTwist | undefined, { quality, activeMs, parMs }: TwistInput): TwistOutcome {
  switch (twist) {
    case "rush": {
      // Missing par costs nothing: Rush is only ever a bonus.
      const achieved = activeMs <= parMs;
      return { coinMultiplier: achieved ? 1 + orderTwists.rush.coinBonus : 1, xpMultiplier: 1, achieved };
    }
    case "precision": {
      const achieved = quality >= orderTwists.precision.minQuality;
      return {
        coinMultiplier: achieved ? 1 + orderTwists.precision.coinBonus : 1 - orderTwists.precision.coinPenalty,
        xpMultiplier: 1,
        achieved,
      };
    }
    case "training":
      return { coinMultiplier: 1, xpMultiplier: 1 + orderTwists.training.xpBonus, achieved: true };
    default:
      return { coinMultiplier: 1, xpMultiplier: 1, achieved: true };
  }
}

/** One short line describing a twist, for cards and badges. */
export function describeTwist(twist: OrderTwist): { name: string; rule: string } {
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  switch (twist) {
    case "rush":
      return { name: "Rush", rule: `+${percent(orderTwists.rush.coinBonus)} coins if quick` };
    case "precision":
      return {
        name: "Precision",
        rule: `+${percent(orderTwists.precision.coinBonus)} at ${orderTwists.precision.minQuality}%+, else −${percent(orderTwists.precision.coinPenalty)}`,
      };
    case "training":
      return { name: "Training", rule: `+${percent(orderTwists.training.xpBonus)} XP` };
  }
}
