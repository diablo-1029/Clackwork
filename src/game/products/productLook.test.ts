import { describe, expect, it } from "vitest";
import { getCutPattern } from "@/game/machines/cutter/cutterGeometry";
import type { MachineResult } from "@/types/game";
import { products } from "@/config/products";
import { deriveProductLook, finishedLook, stampMark, stampOffset } from "./productLook";

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

  const press = (position: number, target = 0.5) => ({ presses: [{ position, target }] });

  it("places the imprint where the press landed", () => {
    const centred = deriveProductLook([result("stamper", 100, press(0.5))]).stamps?.[0];
    const late = deriveProductLook([result("stamper", 60, press(0.8))]).stamps?.[0];
    expect(centred).toEqual({ shift: 0, strength: 0.95, scale: 1 });
    expect(late!.shift).toBeGreaterThan(0);
    expect(late!.strength).toBeLessThan(centred!.strength);
    expect(stampMark(0.2, 60).shift).toBeCloseTo(-late!.shift);
  });

  it("puts an off-centre mark where it was aimed, and keeps both marks of a double press", () => {
    const left = deriveProductLook([result("stamper", 100, press(0.3, 0.3))]).stamps![0];
    expect(left.shift).toBeCloseTo(stampOffset(0.3));
    expect(left.shift).toBeLessThan(0);

    const both = deriveProductLook([
      result("stamper", 100, { presses: [{ position: 0.3, target: 0.3 }, { position: 0.7, target: 0.7 }] }),
    ]).stamps!;
    expect(both).toHaveLength(2);
    expect(both[0].shift).toBeCloseTo(-both[1].shift);
    // Two marks share the face, so each is smaller.
    expect(both.every((mark) => mark.scale < 1)).toBe(true);
  });

  it("accumulates across the whole chain", () => {
    const look = deriveProductLook([
      result("cutter", 100, { pattern: "vertical" }),
      result("stamper", 100, { presses: [{ position: 0.5, target: 0.5 }] }),
      result("polisher", 100),
    ]);
    expect(look.cuts).toHaveLength(1);
    expect(look.stamps).toHaveLength(1);
    expect(look.polished).toBe(true);
  });

  it("keeps the glaze the Paint Booth applied", () => {
    expect(deriveProductLook([result("paintBooth", 95, { glaze: "#2f7fd8" })]).paint).toEqual({ color: "#2f7fd8" });
    expect(deriveProductLook([result("paintBooth", 95, { glaze: 7 })]).paint).toBeUndefined();
    expect(deriveProductLook([result("paintBooth", 95)]).paint).toBeUndefined();
  });

  it("keeps the parts the Assembler put on", () => {
    expect(deriveProductLook([result("assembler", 90)]).assembled).toBe(true);
    expect(deriveProductLook([result("paintBooth", 90, { glaze: "#ef5350" })]).assembled).toBeUndefined();
    // The colour applied before assembly is what the finished robot wears.
    expect(
      deriveProductLook([result("paintBooth", 90, { glaze: "#29b6f6" }), result("assembler", 90)]),
    ).toMatchObject({ assembled: true, paint: { color: "#29b6f6" } });
  });

  it("describes how each finished product looks, for icons", () => {
    expect(finishedLook(products.woodBlock)).toEqual({ cuts: [], polished: false });
    expect(finishedLook(products.toyRobot)).toMatchObject({ assembled: true, paint: { color: "#ef5350" } });
    expect(finishedLook(products.ceramicCoaster).paint).toBeDefined();
    expect(finishedLook(products.ceramicCoaster).assembled).toBeUndefined();
    // Golden orders are glazed gold, not in the product's usual colour.
    expect(finishedLook(products.toyRobot, true).paint?.color).not.toBe("#ef5350");
  });

  it("ignores missing or unknown metadata", () => {
    const look = deriveProductLook([
      result("cutter", 80),
      result("cutter", 80, { pattern: "zigzag" }),
      result("stamper", 80, { presses: [{ position: "middle" }] }),
      result("stamper", 80, { presses: "none" }),
      result("packager", 80),
    ]);
    expect(look).toEqual({ cuts: [], polished: false });
  });
});
