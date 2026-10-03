import type { UpgradeDefinition, UpgradeId } from "@/types/game";

export const upgrades: Record<UpgradeId, UpgradeDefinition> = {
  betterMaterials: {
    id: "betterMaterials",
    name: "Better Materials",
    description: "Richer stock makes every product worth more.",
    unlockLevel: 2,
    maxLevel: 10,
    baseCost: 50,
    costGrowth: 1.6,
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
    costGrowth: 1.9,
    // Index = upgrade level.
    effect: { kind: "goldenChance", chanceByLevel: [0, 0.02, 0.03, 0.04, 0.05, 0.06] },
    visualKey: "golden",
  },
};

export const upgradeList: UpgradeDefinition[] = Object.values(upgrades).sort(
  (a, b) => a.unlockLevel - b.unlockLevel,
);
