/**
 * Level-gated features that are not machines, products, upgrades or themes
 * (those carry their own `unlockLevel` in their config files).
 */
export interface FeatureUnlock {
  id: "goals" | "orderBoard" | "fever" | "orderTwists" | "streakIndicator" | "themeSelection";
  name: string;
  description: string;
  unlockLevel: number;
}

export const featureUnlocks: FeatureUnlock[] = [
  {
    id: "goals",
    name: "Daily Goals",
    description: "Three goals a day and lasting achievements, all paying coins.",
    unlockLevel: 2,
  },
  {
    id: "orderBoard",
    name: "Order Board",
    description: "Choose your next order from three cards.",
    unlockLevel: 3,
  },
  {
    id: "fever",
    name: "Fever Meter",
    description: "Perfects fill the meter. Fill it for Overdrive: double coins on three orders.",
    unlockLevel: 3,
  },
  {
    // Keep in step with orderBoard.twistMinLevel in config/economy.ts.
    id: "orderTwists",
    name: "Order Twists",
    description: "Some order cards now carry a twist that changes what they pay.",
    unlockLevel: 4,
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
