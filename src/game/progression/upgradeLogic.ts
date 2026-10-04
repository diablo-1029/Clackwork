import { upgrades } from "@/config/upgrades";
import type { UpgradeId } from "@/types/game";

export function getUpgradeCost(id: UpgradeId, currentLevel: number): number {
  const def = upgrades[id];
  return Math.round(def.baseCost * Math.pow(def.costGrowth, Math.max(0, currentLevel)));
}

export type PurchaseBlock = "locked" | "maxed" | "coins";

export interface PurchaseCheck {
  ok: boolean;
  cost: number;
  reason?: PurchaseBlock;
}

export function canPurchaseUpgrade(
  id: UpgradeId,
  currentLevel: number,
  coins: number,
  factoryLevel: number,
): PurchaseCheck {
  const def = upgrades[id];
  const cost = getUpgradeCost(id, currentLevel);
  if (factoryLevel < def.unlockLevel) return { ok: false, cost, reason: "locked" };
  if (currentLevel >= def.maxLevel) return { ok: false, cost, reason: "maxed" };
  if (coins < cost) return { ok: false, cost, reason: "coins" };
  return { ok: true, cost };
}

/** Human-readable effect at a given level, e.g. "Product value +20%". */
export function describeUpgradeEffect(id: UpgradeId, level: number): string {
  const effect = upgrades[id].effect;
  switch (effect.kind) {
    case "productValue":
      return `Product value +${Math.round(level * effect.perLevel * 100)}%`;
    case "goldenChance": {
      const chance = effect.chanceByLevel[Math.min(level, effect.chanceByLevel.length - 1)] ?? 0;
      return `Golden chance ${Math.round(chance * 100)}%`;
    }
    case "perfectAssist":
      return level > 0 ? `Perfect from ${100 - level * effect.windowPerLevel}%` : "Perfect at 100% only";
    case "streakShield":
      return level > 0
        ? `Keeps streak at ${effect.minQualityByLevel[Math.min(level, effect.minQualityByLevel.length - 1)]}%+`
        : "No shield";
    case "xpBoost":
      return `XP +${Math.round(level * effect.perLevel * 100)}%`;
    case "rerolls": {
      const count = level * effect.perLevel;
      return count === 1 ? "1 reroll per board" : `${count} rerolls per board`;
    }
  }
}
