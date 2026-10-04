import type { UpgradeDefinition, UpgradeId } from "@/types/game";

// Unlock levels are staggered so most early levels open something new to save for.

export const upgrades: Record<UpgradeId, UpgradeDefinition> = {
  betterMaterials: {
    id: "betterMaterials",
    name: "Better Materials",
    description: "Richer stock makes every product worth more.",
    unlockLevel: 2,
    maxLevel: 10,
    baseCost: 50,
    costGrowth: 1.75,
    effect: { kind: "productValue", perLevel: 0.1 },
    visualKey: "materials",
  },
  goldenTouch: {
    id: "goldenTouch",
    name: "Golden Touch",
    description: "A chance for an order to arrive Golden, worth 5x coins.",
    unlockLevel: 5,
    maxLevel: 5,
    baseCost: 250,
    costGrowth: 2.3,
    // Index = upgrade level.
    effect: { kind: "goldenChance", chanceByLevel: [0, 0.02, 0.03, 0.04, 0.05, 0.06] },
    visualKey: "golden",
  },
  steadyHands: {
    id: "steadyHands",
    name: "Steady Hands",
    description: "A near-Perfect result counts as Perfect.",
    unlockLevel: 3,
    maxLevel: 5,
    baseCost: 120,
    costGrowth: 2.3,
    effect: { kind: "perfectAssist", windowPerLevel: 1 },
  },
  streakShield: {
    id: "streakShield",
    name: "Streak Shield",
    description: "Once per order, a good result that misses Perfect keeps your streak.",
    unlockLevel: 4,
    maxLevel: 3,
    baseCost: 250,
    costGrowth: 3,
    // Index = upgrade level. Level 0 has no shield.
    effect: { kind: "streakShield", minQualityByLevel: [101, 95, 85, 70] },
  },
  freshOrders: {
    id: "freshOrders",
    name: "Fresh Orders",
    description: "Reroll the order board when none of the tickets suit you.",
    unlockLevel: 5,
    maxLevel: 3,
    baseCost: 200,
    costGrowth: 3,
    effect: { kind: "rerolls", perLevel: 1 },
  },
  fastLearner: {
    id: "fastLearner",
    name: "Fast Learner",
    description: "Every machine and every order pays more XP.",
    unlockLevel: 6,
    maxLevel: 5,
    baseCost: 150,
    costGrowth: 2.2,
    effect: { kind: "xpBoost", perLevel: 0.1 },
  },
};

/** Every upgrade at level 0: the starting point for a new factory. */
export function zeroUpgradeLevels(): Record<UpgradeId, number> {
  return Object.fromEntries(Object.keys(upgrades).map((id) => [id, 0])) as Record<UpgradeId, number>;
}

export const upgradeList: UpgradeDefinition[] = Object.values(upgrades).sort(
  (a, b) => a.unlockLevel - b.unlockLevel,
);
