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
import type { MachineResult, ProductDefinition, UpgradeId } from "@/types/game";

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
}

export interface ProductReward {
  quality: number;
  coins: number;
  /** XP granted on completion, on top of what each machine already paid. */
  completionXp: number;
  /** XP the machines of this run already paid, for the summary only. */
  machineXp: number;
  streakBonus: number;
}

/** Pure: turns a finished run into its payout. Applying it is the caller's job. */
export function resolveProductReward(input: ProductRewardInput): ProductReward {
  const quality = calculateProductQuality(input.results);
  return {
    quality,
    coins: calculateCoins({
      baseValue: input.product.baseValue,
      quality,
      streak: input.streak,
      upgradeLevels: input.upgradeLevels,
      isGolden: input.isGolden,
    }),
    completionXp: calculateCompletionXp(input.results.length, input.isGolden),
    machineXp: input.results.reduce((total, r) => total + calculateMachineXp(r.quality), 0),
    streakBonus: getStreakBonus(input.streak),
  };
}

/**
 * What the order would pay if it were finished now. With no results yet it is
 * the order's value before quality; with every result in, it is the payout.
 */
export function projectOrderValue(input: ProductRewardInput): number {
  if (input.results.length > 0) return resolveProductReward(input).coins;
  return Math.round(
    input.product.baseValue *
      getStreakMultiplier(input.streak) *
      getProductValueMultiplier(input.upgradeLevels) *
      getGoldenMultiplier(input.isGolden),
  );
}
