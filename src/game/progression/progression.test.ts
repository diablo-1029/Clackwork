import { describe, expect, it } from "vitest";
import { products } from "@/config/products";
import { applyXp, xpRequired } from "./levels";
import {
  getUnlocksAtLevel,
  isProductPlayable,
  machinesUnlockedAt,
  productsUnlockedAt,
  resolveMachineSequence,
  stepName,
} from "./unlocks";
import { canPurchaseUpgrade, getUpgradeCost } from "./upgradeLogic";

describe("xp thresholds", () => {
  it("follows floor(100 × level^1.35)", () => {
    expect(xpRequired(1)).toBe(100);
    expect(xpRequired(2)).toBe(254);
    expect(xpRequired(3)).toBe(440);
  });

  it("carries leftover XP into the next level", () => {
    expect(applyXp(1, 90, 25)).toEqual({ level: 2, xp: 15, levelsGained: [2] });
  });

  it("can gain several levels at once", () => {
    const gain = applyXp(1, 0, 100 + 254 + 10);
    expect(gain).toEqual({ level: 3, xp: 10, levelsGained: [2, 3] });
  });

  it("ignores negative amounts", () => {
    expect(applyXp(2, 50, -40)).toEqual({ level: 2, xp: 50, levelsGained: [] });
  });
});

describe("unlocks", () => {
  it("starts with the Cutter, the Packager and the Wood Block", () => {
    expect(machinesUnlockedAt(1).sort()).toEqual(["cutter", "packager"]);
    expect(productsUnlockedAt(1)).toEqual(["woodBlock"]);
  });

  it("unlocks the Stamper and Soap Bar at level 3", () => {
    expect(machinesUnlockedAt(3)).toContain("stamper");
    expect(productsUnlockedAt(3)).toContain("soapBar");
    expect(getUnlocksAtLevel(3).map((u) => u.id).sort()).toEqual(["soapBar", "stamper"]);
  });

  it("unlocks the Polisher and Golden Touch at level 5", () => {
    expect(getUnlocksAtLevel(5).map((u) => u.id).sort()).toEqual(["goldenTouch", "polisher"]);
  });

  it("unlocks the Paint Booth and Ceramic Coaster at level 8", () => {
    expect(machinesUnlockedAt(7)).not.toContain("paintBooth");
    expect(productsUnlockedAt(7)).not.toContain("ceramicCoaster");
    expect(machinesUnlockedAt(8)).toContain("paintBooth");
    expect(productsUnlockedAt(8)).toContain("ceramicCoaster");
    expect(getUnlocksAtLevel(8).map((u) => u.id).sort()).toEqual(["ceramicCoaster", "nightShift", "paintBooth"]);
  });

  it("unlocks the Sorter and Crystal together at level 10", () => {
    expect(machinesUnlockedAt(9)).not.toContain("sorter");
    expect(productsUnlockedAt(9)).not.toContain("crystal");
    expect(machinesUnlockedAt(10)).toContain("sorter");
    expect(productsUnlockedAt(10)).toContain("crystal");
    expect(getUnlocksAtLevel(10).map((u) => u.id).sort()).toEqual(["crystal", "sorter", "sunsetShift"]);
  });

  it("unlocks the Assembler and Toy Robot together at level 12", () => {
    expect(machinesUnlockedAt(11)).not.toContain("assembler");
    expect(productsUnlockedAt(11)).not.toContain("toyRobot");
    expect(machinesUnlockedAt(12)).toContain("assembler");
    expect(productsUnlockedAt(12)).toContain("toyRobot");
    expect(getUnlocksAtLevel(12).map((u) => u.id).sort()).toEqual(["assembler", "candyLine", "toyRobot"]);
  });

  it("names repeated steps by what they build, and other steps by their machine", () => {
    const sequence = products.toyRobot.machineSequence;
    expect(sequence.map((_, i) => stepName(products.toyRobot, sequence, i))).toEqual([
      "Paint Booth",
      "Head",
      "Arms",
      "Legs",
      "Torso",
      "Build",
      "Packager",
    ]);
    const wood = products.woodBlock.machineSequence;
    expect(wood.map((_, i) => stepName(products.woodBlock, wood, i))).toEqual(["Cutter", "Packager"]);
  });

  it("unlocks Gold Ingot at level 15", () => {
    expect(productsUnlockedAt(14)).not.toContain("goldIngot");
    expect(productsUnlockedAt(15)).toContain("goldIngot");
    expect(getUnlocksAtLevel(15).map((u) => u.id)).toEqual(["goldIngot"]);
    expect(productsUnlockedAt(99).sort()).toEqual([
      "ceramicCoaster",
      "crystal",
      "goldIngot",
      "soapBar",
      "toyRobot",
      "woodBlock",
    ]);
  });

  it("keeps a product locked while it is not released", () => {
    expect(isProductPlayable(products.goldIngot)).toBe(true);
    expect(isProductPlayable({ ...products.goldIngot, released: false })).toBe(false);
    expect(isProductPlayable(products.toyRobot)).toBe(true);
  });

  it("extends the Soap Bar chain once the Polisher is owned", () => {
    expect(resolveMachineSequence(products.soapBar, ["cutter", "stamper", "packager"])).toEqual([
      "cutter",
      "stamper",
      "packager",
    ]);
    expect(
      resolveMachineSequence(products.soapBar, ["cutter", "stamper", "packager", "polisher"]),
    ).toEqual(["cutter", "stamper", "polisher", "packager"]);
  });
});

describe("upgrades", () => {
  it("costs round(base × growth^level)", () => {
    expect(getUpgradeCost("betterMaterials", 0)).toBe(50);
    expect(getUpgradeCost("betterMaterials", 1)).toBe(80);
    expect(getUpgradeCost("betterMaterials", 2)).toBe(128);
    expect(getUpgradeCost("goldenTouch", 0)).toBe(250);
    expect(getUpgradeCost("goldenTouch", 1)).toBe(475);
  });

  it("requires the unlock level, enough coins and room to grow", () => {
    expect(canPurchaseUpgrade("betterMaterials", 0, 500, 1)).toMatchObject({ ok: false, reason: "locked" });
    expect(canPurchaseUpgrade("betterMaterials", 0, 49, 2)).toMatchObject({ ok: false, reason: "coins" });
    expect(canPurchaseUpgrade("betterMaterials", 0, 50, 2)).toMatchObject({ ok: true, cost: 50 });
    expect(canPurchaseUpgrade("betterMaterials", 10, 1e9, 20)).toMatchObject({ ok: false, reason: "maxed" });
  });
});
