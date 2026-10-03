import { describe, expect, it } from "vitest";
import { getCutPattern } from "@/game/machines/cutter/cutterGeometry";
import type { MachineResult } from "@/types/game";
import { deriveProductLook, stampMark } from "./productLook";

const result = (machineId: MachineResult["machineId"], quality: number, metadata?: Record<string, unknown>): MachineResult => ({
  machineId,
  productId: "soapBar",
  quality,
  isPerfect: quality >= 100,
  durationMs: 1000,
  metadata,
});

describe("product look", () => {
  it("starts untouched", () => {
    expect(deriveProductLook([])).toEqual({ cuts: [], polished: false });
  });

  it("keeps the seam of the cut that was made", () => {
    const look = deriveProductLook([result("cutter", 90, { pattern: "diagonalRight" })]);
    expect(look.cuts).toEqual(getCutPattern("diagonalRight")!.segments);
  });

  it("keeps both seams of a double cut", () => {
    expect(deriveProductLook([result("cutter", 90, { pattern: "doubleVertical" })]).cuts).toHaveLength(2);
  });

  it("places the imprint where the press landed", () => {
    const centred = deriveProductLook([result("stamper", 100, { markerPosition: 0.5 })]).stamp;
    const late = deriveProductLook([result("stamper", 60, { markerPosition: 0.8 })]).stamp;
    expect(centred).toEqual({ shift: 0, strength: 0.95 });
    expect(late!.shift).toBeGreaterThan(0);
    expect(late!.strength).toBeLessThan(centred!.strength);
    expect(stampMark(0.2, 60).shift).toBeCloseTo(-late!.shift);
  });

  it("accumulates across the whole chain", () => {
    const look = deriveProductLook([
      result("cutter", 100, { pattern: "vertical" }),
      result("stamper", 100, { markerPosition: 0.5 }),
      result("polisher", 100),
    ]);
    expect(look.cuts).toHaveLength(1);
    expect(look.stamp).toBeDefined();
    expect(look.polished).toBe(true);
  });

  it("keeps the glaze the Paint Booth applied", () => {
    expect(deriveProductLook([result("paintBooth", 95, { glaze: "#2f7fd8" })]).paint).toEqual({ color: "#2f7fd8" });
    expect(deriveProductLook([result("paintBooth", 95, { glaze: 7 })]).paint).toBeUndefined();
    expect(deriveProductLook([result("paintBooth", 95)]).paint).toBeUndefined();
  });

  it("ignores missing or unknown metadata", () => {
    const look = deriveProductLook([
      result("cutter", 80),
      result("cutter", 80, { pattern: "zigzag" }),
      result("stamper", 80, { markerPosition: "middle" }),
      result("packager", 80),
    ]);
    expect(look).toEqual({ cuts: [], polished: false });
  });
});
