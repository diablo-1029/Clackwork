import { hashString } from "@/lib/math";
import type { MachineId } from "@/types/game";

export interface MachineVariant {
  id: string;
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
  cutter: [{ id: "pattern", minLevel: 1, instruction: null }],
  packager: [
    { id: "across", minLevel: 1, instruction: null },
    { id: "down", minLevel: 3, instruction: "Seal it top to bottom." },
    { id: "cross", minLevel: 7, instruction: "Tape it both ways." },
  ],
  stamper: [
    { id: "steady", minLevel: 1, instruction: null },
    { id: "quick", minLevel: 4, instruction: "Quick press: tap at the mark." },
    { id: "offset", minLevel: 6, instruction: "The mark has moved. Tap on it." },
    { id: "double", minLevel: 9, instruction: "Two marks: tap on each." },
  ],
  polisher: [
    { id: "full", minLevel: 1, instruction: null },
    { id: "patches", minLevel: 6, instruction: "Polish the dull patches." },
    { id: "edges", minLevel: 9, instruction: "Polish the dull edges." },
  ],
  paintBooth: [
    { id: "standard", minLevel: 1, instruction: null },
    { id: "fine", minLevel: 10, instruction: "Fine nozzle: take more passes." },
    { id: "wide", minLevel: 13, instruction: "Wide nozzle: a few quick passes." },
  ],
  sorter: [
    { id: "two", minLevel: 1, instruction: null },
    { id: "three", minLevel: 12, instruction: "Three bins this time." },
  ],
  assembler: [{ id: "standard", minLevel: 1, instruction: null }],
};

/**
 * The variant for one step of one run. Stable for that step (a remount shows
 * the same one), different between steps and runs, and always the basic one
 * while the player is still being taught the machine.
 */
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
