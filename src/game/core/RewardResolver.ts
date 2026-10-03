import { calculateCoins } from "@/game/economy/calculateCoins";
import { calculateCompletionXp, calculateMachineXp } from "@/game/economy/calculateXp";
import {
  clampQuality,
  getGoldenMultiplier,
  getProductValueMultiplier,
  getStreakBonus,
  getStreakMultiplier,
  nextStreak,
} from "@/game/economy/multipliers";
import type { MachineResult, OrderTwist, ProductDefinition, UpgradeId } from "@/types/game";
import { parTimeMs, resolveTwist } from "./orders";

/** Simple average of the machine scores (MVP has no per-machine weights). */
export function calculateProductQuality(results: Pick<MachineResult, "quality">[]): number {
  if (results.length === 0) return 0;
  const sum = results.reduce((total, r) => total + clampQuality(r.quality), 0);
  return clampQuality(sum / results.length);
}

export interface MachineReward {
  xp: number;
  streak: number;
  isPerfect: boolean;
}

export function resolveMachineReward(quality: number, currentStreak: number): MachineReward {
  const q = clampQuality(quality);
  return {
    xp: calculateMachineXp(q),
    streak: nextStreak(currentStreak, q),
    isPerfect: q >= 100,
  };
}

export interface ProductRewardInput {
  product: ProductDefinition;
  results: MachineResult[];
  streak: number;
  upgradeLevels: Record<UpgradeId, number>;
  isGolden: boolean;
  twist?: OrderTwist;
}

export interface ProductReward {
  quality: number;
  coins: number;
  /** XP granted on completion, on top of what each machine already paid. */
  completionXp: number;
  /** XP the machines of this run already paid, for the summary only. */
  machineXp: number;
  streakBonus: number;
  /** The order's twist and whether its condition was met. */
  twist?: { kind: OrderTwist; achieved: boolean };
}

/** Pure: turns a finished run into its payout. Applying it is the caller's job. */
export function resolveProductReward(input: ProductRewardInput): ProductReward {
  const quality = calculateProductQuality(input.results);
  const twist = resolveTwist(input.twist, {
    quality,
    // Only time spent working the machines counts, never the pauses between them.
    activeMs: input.results.reduce((total, r) => total + r.durationMs, 0),
    parMs: parTimeMs(input.results.map((r) => r.machineId)),
  });

  const coins = calculateCoins({
    baseValue: input.product.baseValue,
    quality,
    streak: input.streak,
    upgradeLevels: input.upgradeLevels,
    isGolden: input.isGolden,
  });
  const machineXp = input.results.reduce((total, r) => total + calculateMachineXp(r.quality), 0);
  const completionXp = calculateCompletionXp(input.results.length, input.isGolden);

  return {
    quality,
    coins: Math.round(coins * twist.coinMultiplier),
    // An XP twist covers the whole order; the machines' share was already paid, so it is added here.
    completionXp: completionXp + Math.round((machineXp + completionXp) * (twist.xpMultiplier - 1)),
    machineXp,
    streakBonus: getStreakBonus(input.streak),
    twist: input.twist ? { kind: input.twist, achieved: twist.achieved } : undefined,
  };
}

/**
 * What the order would pay if it were finished now. With no results yet it is
 * the order's value before quality; with every result in, it is the payout.
 */
export function projectOrderValue(input: ProductRewardInput): number {
  // A Rush bonus cannot be known until the order is finished, so it is left out of the projection.
  const twist = input.twist === "rush" ? undefined : input.twist;
  if (input.results.length > 0) return resolveProductReward({ ...input, twist }).coins;
  return Math.round(
    input.product.baseValue *
      getStreakMultiplier(input.streak) *
      getProductValueMultiplier(input.upgradeLevels) *
      getGoldenMultiplier(input.isGolden),
  );
}
