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
  /**
   * Shifts: a run against the clock. A result wins back a share of the machine's normal
   * length (`refund`, best band first) or, below `poorQuality`, costs `poorPenalty` of it
   * (at least `minPenaltyMs`). What is won back is multiplied by `refundDecay` for every
   * product finished, down to `refundFloor`, so every shift ends. Set every `factor` to 0
   * for a fixed-length shift.
   */
  shift: {
    startMs: 60_000,
    maxMs: 90_000,
    /** The clock turns urgent below this. */
    lowMs: 5_000,
    /** After time runs out, how long the machine in progress may still be finished. */
    buzzerMs: 4_000,
    refund: [
      { min: 100, factor: 0.6 },
      { min: 95, factor: 0.45 },
      { min: 85, factor: 0.3 },
      { min: 70, factor: 0.15 },
    ],
    poorQuality: 70,
    poorPenalty: 0.5,
    minPenaltyMs: 1_500,
    refundDecay: 0.9,
    refundFloor: 0.25,
    /** Score: each Perfect in a row adds `comboStep` to the multiplier, up to `comboMax`. */
    comboStep: 0.1,
    comboMax: 3,
    productBonus: 50,
    /** A harder variant of each machine joins the rotation every this many products. */
    productsPerVariant: 2,
    /** Machines with a moving part speed up by this much per product, up to `tempoMax`. */
    tempoPerProduct: 0.06,
    tempoMax: 1.8,
  },
  /** Daily goals: how many a day, what each pays (base + perLevel × Factory Level), and the all-done bonus. */
  goals: { perDay: 3, base: 30, perLevel: 12, bonusFactor: 2 },
  /** Orders of one product needed for two and three mastery stars (three also needs a 100% order). */
  mastery: { twoStars: 10, threeStars: 25 },
  /**
   * The fever meter: `size` Perfects fill it, a result below `poorQuality` drains one,
   * and a full meter makes the next `orders` finished orders pay `coinMultiplier` times the coins.
   */
  fever: { size: 12, orders: 3, coinMultiplier: 2, poorQuality: 70 },
  xp: {
    machineBase: 2,
    qualityDivisor: 20,
    completionBase: 5,
    goldenBonus: 5,
  },
  /** XP to leave a level: base + step × (level − 1)^exponent. Tuned with `npm run simulate`: Level 5 in about a quarter of an hour, Level 15 in about three. */
  level: {
    base: 70,
    step: 205,
    exponent: 1,
  },
  /** Coins paid on every level-up, so no level is ever empty-handed. */
  levelBonus: {
    perLevel: 25,
    /** Every nth level is a milestone and pays this many times as much. */
    milestoneEvery: 5,
    milestoneFactor: 3,
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
  /** Extra parts of a step (a second cut, strip or stamp) each add this share of the machine's time. */
  rush: { coinBonus: 0.4, parFactor: 1, extraPartFactor: 0.6 },
  /** A bigger payout for a clean product, a slightly smaller one otherwise. */
  precision: { minQuality: 95, coinBonus: 0.6, coinPenalty: 0.15 },
  training: { xpBonus: 0.5 },
} as const;
