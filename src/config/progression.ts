/**
 * Level-gated features that are not machines, products, upgrades or themes
 * (those carry their own `unlockLevel` in their config files).
 */
export interface FeatureUnlock {
  id: "orderBoard" | "streakIndicator" | "themeSelection";
  name: string;
  description: string;
  unlockLevel: number;
}

export const featureUnlocks: FeatureUnlock[] = [
  {
    id: "orderBoard",
    name: "Order Board",
    description: "Choose your next order from three cards.",
    unlockLevel: 3,
  },
  {
    id: "streakIndicator",
    name: "Streak Bonus",
    description: "Your Perfect streak now shows its coin bonus.",
    unlockLevel: 4,
  },
  {
    id: "themeSelection",
    name: "Factory Themes",
    description: "Restyle the factory floor.",
    unlockLevel: 6,
  },
];

export const pacing = {
  /** Reward summaries auto-advance once the player has finished this many products. */
  autoAdvanceAfterProducts: 3,
  /** A scripted Golden Product introduces the event at this level. */
  goldenIntroLevel: 5,
  /** Phase timings in ms. */
  orderIntroMs: 1100,
  orderIntroFirstMs: 1900,
  machineEnterMs: 200,
  machineResolveMs: 450,
  resultFeedbackMs: 800,
  machineExitMs: 300,
  rewardSummaryMs: 1900,
} as const;
