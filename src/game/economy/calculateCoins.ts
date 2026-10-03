import type { UpgradeId } from "@/types/game";
import {
  getGoldenMultiplier,
  getProductValueMultiplier,
  getQualityMultiplier,
  getStreakMultiplier,
} from "./multipliers";

export interface CoinInput {
  baseValue: number;
  quality: number;
  streak: number;
  upgradeLevels: Record<UpgradeId, number>;
  isGolden: boolean;
}

/** Base × quality × streak × upgrades × golden, rounded once at the end. */
export function calculateCoins(input: CoinInput): number {
  const raw =
    input.baseValue *
    getQualityMultiplier(input.quality) *
    getStreakMultiplier(input.streak) *
    getProductValueMultiplier(input.upgradeLevels) *
    getGoldenMultiplier(input.isGolden);
  // Guard against float noise such as 24.999999 before rounding.
  return Math.max(0, Math.round(Number(raw.toFixed(6))));
}
