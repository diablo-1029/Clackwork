import { economy, qualityBands, streakTiers, type QualityBand } from "@/config/economy";
import { upgrades } from "@/config/upgrades";
import { clamp } from "@/lib/math";
import type { UpgradeId } from "@/types/game";

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

export function getProductValueMultiplier(upgradeLevels: Record<UpgradeId, number>): number {
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
