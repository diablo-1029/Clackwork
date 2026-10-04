import { describe, expect, it } from "vitest";
import { achievements, emptyStats, isEarned, masteryStars, newlyEarned } from "./achievements";
import { applyGoalEvent, dateKey, describeGoal, goalBonus, goalReward, goalsForToday, pickDailyGoals } from "./goals";
import { products } from "@/config/products";
import { applyXp, levelUpBonus, xpRequired } from "./levels";
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
  it("follows 70 + 205 × (level − 1)", () => {
    expect(xpRequired(1)).toBe(70);
    expect(xpRequired(2)).toBe(275);
    expect(xpRequired(3)).toBe(480);
    expect(xpRequired(10)).toBe(1915);
  });

  it("rises by the same step with every level", () => {
    for (let level = 1; level < 40; level++) {
      expect(xpRequired(level + 1) - xpRequired(level)).toBe(205);
    }
  });

  it("reaches the third machine within the first shift", () => {
    // A Wood Block order pays roughly 21 XP, and Level 2 brings the Stamper.
    expect(xpRequired(1) / 21).toBeLessThan(4);
  });

  it("carries leftover XP into the next level", () => {
    expect(applyXp(1, 60, 25)).toEqual({ level: 2, xp: 15, levelsGained: [2] });
  });

  it("can gain several levels at once", () => {
    const gain = applyXp(1, 0, 70 + 275 + 10);
    expect(gain).toEqual({ level: 3, xp: 10, levelsGained: [2, 3] });
  });

  it("pays a coin bonus for every level, tripled on every fifth", () => {
    expect(levelUpBonus(2)).toBe(50);
    expect(levelUpBonus(6)).toBe(150);
    expect(levelUpBonus(10)).toBe(750);
    expect(levelUpBonus(11)).toBe(275);
    expect(levelUpBonus(40)).toBe(3000);
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

  it("unlocks the Stamper and Soap Bar at level 2, so a new player soon has a third machine", () => {
    expect(machinesUnlockedAt(1)).not.toContain("stamper");
    expect(machinesUnlockedAt(2)).toContain("stamper");
    expect(productsUnlockedAt(2)).toContain("soapBar");
    expect(getUnlocksAtLevel(2).map((u) => u.id)).toEqual(
      expect.arrayContaining(["betterMaterials", "goals", "soapBar", "stamper"]),
    );
  });

  it("opens the order board, the fever meter and more at level 3", () => {
    expect(getUnlocksAtLevel(3).map((u) => u.id).sort()).toEqual(["fever", "orderBoard", "packager:down", "steadyHands"]);
  });

  it("unlocks the Polisher and Golden Touch at level 5", () => {
    expect(getUnlocksAtLevel(5).map((u) => u.id).sort()).toEqual(["freshOrders", "goldenTouch", "polisher"]);
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
    expect(getUnlocksAtLevel(10).map((u) => u.id).sort()).toEqual([
      "crystal",
      "paintBooth:fine",
      "sorter",
      "sunsetShift",
    ]);
  });

  it("unlocks the Assembler and Toy Robot together at level 12", () => {
    expect(machinesUnlockedAt(11)).not.toContain("assembler");
    expect(productsUnlockedAt(11)).not.toContain("toyRobot");
    expect(machinesUnlockedAt(12)).toContain("assembler");
    expect(productsUnlockedAt(12)).toContain("toyRobot");
    expect(getUnlocksAtLevel(12).map((u) => u.id).sort()).toEqual([
      "assembler",
      "candyLine",
      "sorter:three",
      "toyRobot",
    ]);
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

  it("announces new techniques, once each, and never before their machine", () => {
    const ids = (level: number) => getUnlocksAtLevel(level).map((u) => u.id);
    // The two double-cut patterns are one announcement.
    expect(ids(2).filter((id) => id.startsWith("cutter:"))).toEqual(["cutter:Double cut"]);
    expect(ids(4)).toEqual(expect.arrayContaining(["stamper:quick", "orderTwists"]));
    expect(ids(7)).toEqual(["packager:cross"]);
    expect(ids(9).sort()).toEqual(["cutter:Triple cut", "polisher:edges", "stamper:double"]);
    expect(ids(13)).toEqual(["paintBooth:wide"]);

    const techniques = Array.from({ length: 30 }, (_, i) => getUnlocksAtLevel(i + 1))
      .flat()
      .filter((u) => u.kind === "technique");
    expect(new Set(techniques.map((u) => u.id)).size).toBe(techniques.length);
    for (const technique of techniques) {
      const machineId = technique.id.split(":")[0];
      expect(machinesUnlockedAt(technique.level)).toContain(machineId);
    }
  });

  it("gives every level from 2 to 10 something to unlock", () => {
    for (let level = 2; level <= 10; level++) expect(getUnlocksAtLevel(level).length).toBeGreaterThan(0);
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
    expect(getUpgradeCost("betterMaterials", 1)).toBe(88);
    expect(getUpgradeCost("betterMaterials", 2)).toBe(153);
    expect(getUpgradeCost("goldenTouch", 0)).toBe(250);
    expect(getUpgradeCost("goldenTouch", 1)).toBe(575);
  });

  it("requires the unlock level, enough coins and room to grow", () => {
    expect(canPurchaseUpgrade("betterMaterials", 0, 500, 1)).toMatchObject({ ok: false, reason: "locked" });
    expect(canPurchaseUpgrade("betterMaterials", 0, 49, 2)).toMatchObject({ ok: false, reason: "coins" });
    expect(canPurchaseUpgrade("betterMaterials", 0, 50, 2)).toMatchObject({ ok: true, cost: 50 });
    expect(canPurchaseUpgrade("betterMaterials", 10, 1e9, 20)).toMatchObject({ ok: false, reason: "maxed" });
  });
});

describe("daily goals", () => {
  const unlocked = ["woodBlock", "soapBar", "ceramicCoaster"] as const;

  it("uses the local calendar day", () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("gives the same three different goals for the same day", () => {
    const first = pickDailyGoals("2026-10-04", 9, [...unlocked]);
    expect(first).toHaveLength(3);
    expect(new Set(first.map((goal) => goal.kind)).size).toBe(3);
    expect(pickDailyGoals("2026-10-04", 9, [...unlocked])).toEqual(first);
  });

  it("varies from day to day", () => {
    const days = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
    const sets = new Set(days.map((date) => pickDailyGoals(date, 9, [...unlocked]).map((goal) => goal.kind).join()));
    expect(sets.size).toBeGreaterThan(5);
  });

  it("only offers goals the player can do", () => {
    for (let i = 1; i <= 28; i++) {
      const early = pickDailyGoals(`2026-02-${String(i).padStart(2, "0")}`, 2, ["woodBlock"]);
      expect(early.some((goal) => goal.kind === "twist" || goal.kind === "product")).toBe(false);
      expect(early.every((goal) => goal.target > 0 && goal.reward === goalReward(2))).toBe(true);
    }
  });

  it("pays more at higher levels, and double for the bonus", () => {
    expect(goalReward(2)).toBe(54);
    expect(goalReward(12)).toBe(174);
    expect(goalBonus(12)).toBe(348);
  });

  it("keeps today's goals and replaces yesterday's", () => {
    const today = goalsForToday({ date: "", items: [], bonusPaid: false }, new Date(2026, 9, 4), 5, [...unlocked]);
    expect(goalsForToday(today, new Date(2026, 9, 4, 22), 5, [...unlocked])).toBe(today);
    expect(goalsForToday({ ...today, bonusPaid: true }, new Date(2026, 9, 5), 5, [...unlocked])).toMatchObject({
      date: "2026-10-05",
      bonusPaid: false,
    });
  });

  it("moves each kind of goal on the right event", () => {
    const goal = (kind: Parameters<typeof describeGoal>[0]["kind"], target: number) => ({
      kind,
      target,
      progress: 0,
      done: false,
      reward: 10,
    });
    const items = [goal("products", 2), goal("perfects", 2), goal("streak", 4), goal("coins", 50), goal("twist", 1)];
    const withProduct = [...items, { ...goal("product", 1), productId: "soapBar" as const }];

    let step = applyGoalEvent(withProduct, { type: "machine", perfect: true, streak: 3 });
    expect(step.goals.map((g) => g.progress)).toEqual([0, 1, 3, 0, 0, 0]);
    // A lower streak later does not undo the best one.
    step = applyGoalEvent(step.goals, { type: "machine", perfect: false, streak: 1 });
    expect(step.goals[2].progress).toBe(3);

    step = applyGoalEvent(step.goals, { type: "order", productId: "woodBlock", coins: 60, twistWon: true });
    expect(step.goals.map((g) => g.progress)).toEqual([1, 1, 3, 50, 1, 0]);
    expect(step.completed.map((g) => g.kind)).toEqual(["coins", "twist"]);

    // Finished goals stay finished and are not reported again.
    step = applyGoalEvent(step.goals, { type: "order", productId: "soapBar", coins: 60, twistWon: true });
    expect(step.completed.map((g) => g.kind)).toEqual(["products", "product"]);
  });

  it("describes goals in plain words", () => {
    const base = { target: 3, progress: 0, done: false, reward: 10 };
    expect(describeGoal({ ...base, kind: "products" })).toBe("Make 3 products");
    expect(describeGoal({ ...base, kind: "twist", target: 1 })).toBe("Win a twist order");
    expect(describeGoal({ ...base, kind: "product", productId: "soapBar" })).toBe("Make 3 Soap Bars");
  });
});

describe("achievements and mastery", () => {
  const context = (over: Partial<Parameters<typeof newlyEarned>[0]> = {}) => ({
    productsMade: 0,
    perfects: 0,
    stats: emptyStats,
    playableProducts: 6,
    ...over,
  });

  it("has unique ids", () => {
    expect(new Set(achievements.map((a) => a.id)).size).toBe(achievements.length);
  });

  it("earns nothing on a fresh factory", () => {
    expect(newlyEarned(context(), [])).toEqual([]);
  });

  it("earns each tier at its target and skips ones already paid", () => {
    const ids = (list: ReturnType<typeof newlyEarned>) => list.map((a) => a.id);
    expect(ids(newlyEarned(context({ productsMade: 50 }), []))).toEqual(["made10", "made50"]);
    expect(ids(newlyEarned(context({ productsMade: 50 }), ["made10"]))).toEqual(["made50"]);
    expect(ids(newlyEarned(context({ stats: { ...emptyStats, bestStreak: 10, overdrives: 1 } }), []))).toEqual([
      "streak5",
      "streak10",
      "overdrive1",
    ]);
  });

  it("needs every playable product for the catalogue", () => {
    const collector = achievements.find((a) => a.id === "collector")!;
    const made = { made: 1, bestQuality: 80 };
    const five = { woodBlock: made, soapBar: made, ceramicCoaster: made, crystal: made, toyRobot: made };
    expect(isEarned(collector, context({ stats: { ...emptyStats, products: five } }))).toBe(false);
    expect(isEarned(collector, context({ stats: { ...emptyStats, products: { ...five, goldIngot: made } } }))).toBe(true);
  });

  it.each([
    [undefined, 0],
    [{ made: 1, bestQuality: 60 }, 1],
    [{ made: 10, bestQuality: 60 }, 2],
    [{ made: 25, bestQuality: 99 }, 2],
    [{ made: 25, bestQuality: 100 }, 3],
    [{ made: 9, bestQuality: 100 }, 1],
  ])("mastery for %o is %i stars", (stat, stars) => {
    expect(masteryStars(stat)).toBe(stars);
  });
});
