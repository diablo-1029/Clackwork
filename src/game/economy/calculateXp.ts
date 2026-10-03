import { economy } from "@/config/economy";
import { clampQuality } from "./multipliers";

export function calculateMachineXp(quality: number): number {
  return economy.xp.machineBase + Math.floor(clampQuality(quality) / economy.xp.qualityDivisor);
}

/** Golden Products add a small flat bonus; they never multiply XP. */
export function calculateCompletionXp(machineCount: number, isGolden: boolean): number {
  return economy.xp.completionBase + machineCount + (isGolden ? economy.xp.goldenBonus : 0);
}
