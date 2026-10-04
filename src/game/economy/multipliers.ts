import { economy, qualityBands, streakTiers, type QualityBand } from "@/config/economy";
import { upgrades } from "@/config/upgrades";
import { clamp } from "@/lib/math";
import type { UpgradeLevels } from "@/types/game";

export function clampQuality(quality: number): number {
  if (!Number.isFinite(quality)) return 0;
  return clamp(Math.round(quality), 0, 100);
}

export function getQualityBand(quality: number): QualityBand {
  const q = clampQuality(quality);
  return qualityBands.find((band) => q >= band.min) ?? qualityBands[qualityBands.length - 1];
}

export function getQualityMultiplier(quality: number): number {
  return getQualityBand(quality).multiplier;
}

export function getQualityLabel(quality: number): string {
  return getQualityBand(quality).label;
}

/** Bonus as a fraction, e.g. 0.05 for +5%. */
export function getStreakBonus(streak: number): number {
  const s = Math.max(0, Math.floor(streak));
  return (streakTiers.find((tier) => s >= tier.min) ?? streakTiers[streakTiers.length - 1]).bonus;
}

export function getStreakMultiplier(streak: number): number {
  return 1 + getStreakBonus(streak);
}

/** Perfect grows the streak, a decent result costs one step, a poor one resets it. */
export function nextStreak(streak: number, quality: number): number {
  const current = Math.max(0, Math.floor(streak));
  const q = clampQuality(quality);
  if (q >= 100) return current + 1;
  if (q >= economy.streakKeepThreshold) return Math.max(0, current - 1);
  return 0;
}

export interface StreakOutcome {
  streak: number;
  /** True when the Streak Shield absorbed this result. */
  shieldUsed: boolean;
}

/**
 * `nextStreak`, with the Streak Shield: a result that misses Perfect but reaches
 * `shieldMinQuality` leaves the streak where it was. Pass null when no shield is available.
 */
export function resolveStreak(streak: number, quality: number, shieldMinQuality: number | null): StreakOutcome {
  const q = clampQuality(quality);
  const current = Math.max(0, Math.floor(streak));
  if (shieldMinQuality !== null && current > 0 && q < 100 && q >= shieldMinQuality) {
    return { streak: current, shieldUsed: true };
  }
  return { streak: nextStreak(current, q), shieldUsed: false };
}

const upgradeLevel = (levels: UpgradeLevels, id: keyof UpgradeLevels, max: number) =>
  clamp(Math.floor(levels[id] ?? 0), 0, max);

/** Steady Hands: a result close enough to 100 is rounded up to Perfect. */
export function applyPerfectAssist(quality: number, upgradeLevels: UpgradeLevels): number {
  const q = clampQuality(quality);
  const { effect, maxLevel } = upgrades.steadyHands;
  if (effect.kind !== "perfectAssist") return q;
  const window = upgradeLevel(upgradeLevels, "steadyHands", maxLevel) * effect.windowPerLevel;
  return window > 0 && q >= 100 - window ? 100 : q;
}

/** The lowest quality the Streak Shield covers, or null without the upgrade. */
export function getShieldMinQuality(upgradeLevels: UpgradeLevels): number | null {
  const { effect, maxLevel } = upgrades.streakShield;
  if (effect.kind !== "streakShield") return null;
  const level = upgradeLevel(upgradeLevels, "streakShield", maxLevel);
  return level > 0 ? (effect.minQualityByLevel[level] ?? null) : null;
}

export function getXpMultiplier(upgradeLevels: UpgradeLevels): number {
  const { effect, maxLevel } = upgrades.fastLearner;
  if (effect.kind !== "xpBoost") return 1;
  return 1 + upgradeLevel(upgradeLevels, "fastLearner", maxLevel) * effect.perLevel;
}

/** How many times each order board can be rerolled. */
export function getRerollCount(upgradeLevels: UpgradeLevels): number {
  const { effect, maxLevel } = upgrades.freshOrders;
  if (effect.kind !== "rerolls") return 0;
  return upgradeLevel(upgradeLevels, "freshOrders", maxLevel) * effect.perLevel;
}

export function getProductValueMultiplier(upgradeLevels: UpgradeLevels): number {
  const effect = upgrades.betterMaterials.effect;
  if (effect.kind !== "productValue") return 1;
  return 1 + (upgradeLevels.betterMaterials ?? 0) * effect.perLevel;
}

export function getGoldenChance(goldenTouchLevel: number): number {
  const effect = upgrades.goldenTouch.effect;
  if (effect.kind !== "goldenChance") return 0;
  const level = clamp(Math.floor(goldenTouchLevel), 0, effect.chanceByLevel.length - 1);
  return effect.chanceByLevel[level] ?? 0;
}

export function getGoldenMultiplier(isGolden: boolean): number {
  return isGolden ? economy.goldenMultiplier : 1;
}
