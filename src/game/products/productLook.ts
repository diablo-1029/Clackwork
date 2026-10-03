import { getCutPattern, type CutSegment } from "@/game/machines/cutter/cutterGeometry";
import type { MachineResult, ProductDefinition } from "@/types/game";
import { goldenColors, materialProfiles } from "./materialProfiles";

/** Width of the Stamper's slab, which stamp offsets are measured against. */
const STAMP_REFERENCE_WIDTH = 160;
/** How far, in slab units, a press at the very edge of the timing track lands off its mark. */
const STAMP_MAX_SHIFT = 23;
/** How far from the middle a mark aimed at the edge of the track would sit, as a share of the width. */
const STAMP_TARGET_SPREAD = 0.8;

export interface StampMark {
  /** Horizontal offset of the imprint as a share of the product's width (0 = centred). */
  shift: number;
  /** 0–1 opacity of the imprint; a cleaner press leaves a crisper mark. */
  strength: number;
  /** Size relative to a single centred imprint; smaller when there are two. */
  scale: number;
}

/** Where a mark aimed at `target` (0–1 along the timing track) sits, as a share of the product's width. */
export function stampOffset(target: number): number {
  return (target - 0.5) * STAMP_TARGET_SPREAD;
}

/** What earlier machines have done to the product, so later machines can show it. */
export interface ProductLook {
  /** Cut seams, in the coordinate space of `PRODUCT_RECT`. */
  cuts: CutSegment[];
  /** Imprints left by the Stamper: one normally, two for a double press. */
  stamps?: StampMark[];
  /** The glaze the Paint Booth applied. */
  paint?: { color: string };
  /** The Assembler has snapped every part on. */
  assembled?: boolean;
  polished: boolean;
}

export const untouchedLook: ProductLook = { cuts: [], polished: false };

/**
 * `position` is where the marker was when the press fired and `target` where it was
 * aimed, both 0–1 along the track. The imprint lands at its target, nudged by the miss.
 */
export function stampMark(position: number, quality: number, target = 0.5, scale = 1): StampMark {
  return {
    shift: stampOffset(target) + ((position - target) * 2 * STAMP_MAX_SHIFT) / STAMP_REFERENCE_WIDTH,
    strength: 0.45 + (Math.min(100, Math.max(0, quality)) / 100) * 0.5,
    scale,
  };
}

/** Reads the presses a Stamper result recorded, tolerating missing or malformed metadata. */
function stampsFrom(result: MachineResult): StampMark[] {
  const presses = result.metadata?.presses;
  if (!Array.isArray(presses)) return [];
  const valid = presses.filter(
    (press): press is { position: number; target: number } =>
      typeof press?.position === "number" && typeof press?.target === "number",
  );
  const scale = valid.length > 1 ? 0.6 : 1;
  return valid.map((press) => stampMark(press.position, result.quality, press.target, scale));
}

/** Pure: rebuilds the product's appearance from the results committed so far. */
export function deriveProductLook(results: MachineResult[]): ProductLook {
  const look: ProductLook = { cuts: [], polished: false };

  for (const result of results) {
    if (result.machineId === "cutter") {
      look.cuts.push(...(getCutPattern(result.metadata?.pattern)?.segments ?? []));
    } else if (result.machineId === "stamper") {
      const stamps = stampsFrom(result);
      if (stamps.length > 0) look.stamps = stamps;
    } else if (result.machineId === "paintBooth") {
      const glaze = result.metadata?.glaze;
      if (typeof glaze === "string") look.paint = { color: glaze };
    } else if (result.machineId === "assembler") {
      look.assembled = true;
    } else if (result.machineId === "polisher") {
      look.polished = true;
    }
  }
  return look;
}

/** How a finished product looks, for icons and cards: painted and assembled where its chain says so. */
export function finishedLook(product: ProductDefinition, isGolden = false): ProductLook {
  const look: ProductLook = { cuts: [], polished: false };
  if (product.machineSequence.includes("paintBooth")) {
    const glaze = isGolden ? goldenColors.base : materialProfiles[product.materialProfile].glazeColors?.[0];
    if (glaze) look.paint = { color: glaze };
  }
  if (product.machineSequence.includes("assembler")) look.assembled = true;
  return look;
}
