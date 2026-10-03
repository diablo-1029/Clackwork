import { getCutPattern, type CutSegment } from "@/game/machines/cutter/cutterGeometry";
import type { MachineResult, ProductDefinition } from "@/types/game";
import { goldenColors, materialProfiles } from "./materialProfiles";

/** Width of the Stamper's slab, which stamp offsets are measured against. */
const STAMP_REFERENCE_WIDTH = 160;
/** How far, in slab units, a press at the very edge of the timing track lands off-center. */
const STAMP_MAX_SHIFT = 23;

export interface StampMark {
  /** Horizontal offset of the imprint as a share of the product's width (0 = centred). */
  shift: number;
  /** 0–1 opacity of the imprint; a cleaner press leaves a crisper mark. */
  strength: number;
}

/** What earlier machines have done to the product, so later machines can show it. */
export interface ProductLook {
  /** Cut seams, in the coordinate space of `PRODUCT_RECT`. */
  cuts: CutSegment[];
  stamp?: StampMark;
  /** The glaze the Paint Booth applied. */
  paint?: { color: string };
  /** The Assembler has snapped every part on. */
  assembled?: boolean;
  polished: boolean;
}

export const untouchedLook: ProductLook = { cuts: [], polished: false };

/** `position` is the Stamper's marker position: 0 = left edge, 0.5 = center. */
export function stampMark(position: number, quality: number): StampMark {
  return {
    shift: ((position - 0.5) * 2 * STAMP_MAX_SHIFT) / STAMP_REFERENCE_WIDTH,
    strength: 0.45 + (Math.min(100, Math.max(0, quality)) / 100) * 0.5,
  };
}

/** Pure: rebuilds the product's appearance from the results committed so far. */
export function deriveProductLook(results: MachineResult[]): ProductLook {
  const look: ProductLook = { cuts: [], polished: false };

  for (const result of results) {
    if (result.machineId === "cutter") {
      look.cuts.push(...(getCutPattern(result.metadata?.pattern)?.segments ?? []));
    } else if (result.machineId === "stamper") {
      const position = result.metadata?.markerPosition;
      if (typeof position === "number") look.stamp = stampMark(position, result.quality);
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
