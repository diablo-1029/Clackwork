import type { QualityTier } from "@/types/game";

export interface QualityBand {
  min: number;
  label: string;
  multiplier: number;
  tier: QualityTier;
}

/** Ordered from best to worst; the first band whose `min` is met applies. */
export const qualityBands: QualityBand[] = [
  { min: 100, label: "PERFECT", multiplier: 1.3, tier: "perfect" },
  { min: 95, label: "Excellent", multiplier: 1.2, tier: "excellent" },
  { min: 85, label: "Great", multiplier: 1.1, tier: "good" },
  { min: 70, label: "Good", multiplier: 1.0, tier: "good" },
  { min: 50, label: "Okay", multiplier: 0.9, tier: "low" },
  { min: 0, label: "Rough", multiplier: 0.8, tier: "low" },
];

/** Ordered from highest streak to lowest. */
export const streakTiers: { min: number; bonus: number }[] = [
  { min: 12, bonus: 0.2 },
  { min: 8, bonus: 0.15 },
  { min: 5, bonus: 0.1 },
  { min: 3, bonus: 0.05 },
  { min: 0, bonus: 0 },
];

export const economy = {
  /** A non-perfect result at or above this only costs one streak step. */
  streakKeepThreshold: 70,
  goldenMultiplier: 5,
  xp: {
    machineBase: 2,
    qualityDivisor: 20,
    completionBase: 5,
    goldenBonus: 5,
  },
  level: {
    base: 100,
    exponent: 1.35,
  },
} as const;

/** The board the player picks orders from once it unlocks (see featureUnlocks). */
export const orderBoard = {
  offerCount: 3,
  /** Share of cards that carry a twist. */
  twistChance: 0.35,
  twistMinLevel: 4,
  /** No twists until the player has finished this many products. */
  graceOrders: 3,
} as const;

/** First guesses, to be tuned by play. */
export const orderTwists = {
  /** Bonus for finishing under par. Missing par costs nothing. */
  rush: { coinBonus: 0.4, parFactor: 0.8 },
  /** A bigger payout for a clean product, a slightly smaller one otherwise. */
  precision: { minQuality: 95, coinBonus: 0.6, coinPenalty: 0.15 },
  training: { xpBonus: 0.5 },
} as const;
