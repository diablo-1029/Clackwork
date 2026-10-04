import { economy } from "@/config/economy";
import { clampQuality } from "./multipliers";

/** `scale` is the product's `stepXpScale`; every step still pays at least 1 XP. */
export function calculateMachineXp(quality: number, scale = 1): number {
  const full = economy.xp.machineBase + Math.floor(clampQuality(quality) / economy.xp.qualityDivisor);
  return Math.max(1, Math.round(full * scale));
}

/** Fast Learner: applied to each XP award on its own, so what is shown is what is paid. */
export function boostXp(xp: number, multiplier: number): number {
  return Math.max(0, Math.round(xp * multiplier));
}

/** Golden Products add a small flat bonus; they never multiply XP. */
export function calculateCompletionXp(machineCount: number, isGolden: boolean): number {
  return economy.xp.completionBase + machineCount + (isGolden ? economy.xp.goldenBonus : 0);
}
