import { hashString } from "@/lib/math";
import type { MachineId } from "@/types/game";

export interface MachineVariant {
  id: string;
  /** Short name, used when the level-up panel announces it. */
  name: string;
  /** Factory Level from which this variant can come up. The first variant is always available. */
  minLevel: number;
  /** Shown under the machine instead of its usual instruction; `null` keeps the usual one. */
  instruction: string | null;
}

/**
 * The ways each machine can play. The first entry is the basic version that
 * new players learn on; the rest join the rotation as the factory levels up,
 * so the same product is not the same motions every time.
 *
 * The Cutter varies through its cut patterns (cutter/cutterGeometry.ts) and
 * the Assembler by shuffling its tray, so both list a single variant here.
 */
export const machineVariants: Record<MachineId, MachineVariant[]> = {
  cutter: [{ id: "pattern", name: "Single cut", minLevel: 1, instruction: null }],
  packager: [
    { id: "across", name: "Tape across", minLevel: 1, instruction: null },
    { id: "down", name: "Top-to-bottom tape", minLevel: 3, instruction: "Seal it top to bottom." },
    { id: "cross", name: "Cross tape", minLevel: 7, instruction: "Tape it both ways." },
  ],
  stamper: [
    { id: "steady", name: "Steady press", minLevel: 1, instruction: null },
    { id: "quick", name: "Quick press", minLevel: 4, instruction: "Quick press: tap at the mark." },
    { id: "offset", name: "Moved mark", minLevel: 6, instruction: "The mark has moved. Tap on it." },
    { id: "double", name: "Double stamp", minLevel: 9, instruction: "Two marks: tap on each." },
  ],
  polisher: [
    { id: "full", name: "Full polish", minLevel: 1, instruction: null },
    { id: "patches", name: "Dull patches", minLevel: 6, instruction: "Polish the dull patches." },
    { id: "edges", name: "Dull edges", minLevel: 9, instruction: "Polish the dull edges." },
  ],
  paintBooth: [
    { id: "standard", name: "Standard nozzle", minLevel: 1, instruction: null },
    { id: "fine", name: "Fine nozzle", minLevel: 10, instruction: "Fine nozzle: take more passes." },
    { id: "wide", name: "Wide nozzle", minLevel: 13, instruction: "Wide nozzle: a few quick passes." },
  ],
  sorter: [
    { id: "two", name: "Two bins", minLevel: 1, instruction: null },
    { id: "three", name: "Three bins", minLevel: 12, instruction: "Three bins this time." },
  ],
  assembler: [{ id: "standard", name: "Assembly", minLevel: 1, instruction: null }],
};

/**
 * The variant for one step of one run. Stable for that step (a remount shows
 * the same one), different between steps and runs, and always the basic one
 * while the player is still being taught the machine.
 */
/**
 * The same choice during a shift: only the first `variantCount` unlocked variants
 * are in rotation, so a shift opens on the basics and gets trickier as it goes.
 */
export function pickShiftVariant(
  machineId: MachineId,
  runId: string,
  stepIndex: number,
  factoryLevel: number,
  variantCount: number,
  onboarding = false,
): MachineVariant {
  const all = machineVariants[machineId];
  if (onboarding) return all[0];
  const unlocked = all.filter((variant, index) => index === 0 || variant.minLevel <= factoryLevel);
  const pool = unlocked.slice(0, Math.max(1, Math.floor(variantCount)));
  return pool[hashString(`${runId}:${stepIndex}`) % pool.length] ?? all[0];
}

export function pickVariant(
  machineId: MachineId,
  runId: string,
  stepIndex: number,
  factoryLevel: number,
  onboarding = false,
): MachineVariant {
  const all = machineVariants[machineId];
  if (onboarding) return all[0];
  const pool = all.filter((variant, index) => index === 0 || variant.minLevel <= factoryLevel);
  return pool[hashString(`${runId}:${stepIndex}`) % pool.length] ?? all[0];
}
