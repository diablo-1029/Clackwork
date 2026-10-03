import { describe, expect, it } from "vitest";
import { products } from "@/config/products";
import { applyXp, xpRequired } from "./levels";
import {
  getUnlocksAtLevel,
  machinesUnlockedAt,
  productsUnlockedAt,
  resolveMachineSequence,
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

  it("never unlocks products whose machines are not playable yet", () => {
    expect(productsUnlockedAt(99).sort()).toEqual(["soapBar", "woodBlock"]);
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
