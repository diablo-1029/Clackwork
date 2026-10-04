import { economy } from "@/config/economy";

/** XP needed to go from `level` to `level + 1`. */
export function xpRequired(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  const { base, step, exponent } = economy.level;
  return Math.floor(base + step * Math.pow(safeLevel - 1, exponent));
}

/** Coins paid for reaching `level`. */
export function levelUpBonus(level: number): number {
  const { perLevel, milestoneEvery, milestoneFactor } = economy.levelBonus;
  const safeLevel = Math.max(1, Math.floor(level));
  return perLevel * safeLevel * (safeLevel % milestoneEvery === 0 ? milestoneFactor : 1);
}

export interface XpGain {
  level: number;
  xp: number;
  /** Every level reached by this gain, in order. */
  levelsGained: number[];
}

/** `xp` is progress within the current level. */
export function applyXp(level: number, xp: number, amount: number): XpGain {
  let nextLevel = Math.max(1, Math.floor(level));
  let nextXp = Math.max(0, xp) + Math.max(0, amount);
  const levelsGained: number[] = [];

  while (nextXp >= xpRequired(nextLevel)) {
    nextXp -= xpRequired(nextLevel);
    nextLevel += 1;
    levelsGained.push(nextLevel);
  }

  return { level: nextLevel, xp: nextXp, levelsGained };
}
