import { describe, expect, it } from "vitest";
import { calculateCoins } from "./calculateCoins";
import { describeUpgradeEffect, getUpgradeCost } from "@/game/progression/upgradeLogic";
import { applyMachineResult, clampFever, emptyFever, finishOrder, isOverdrive } from "./fever";
import { boostXp, calculateCompletionXp, calculateMachineXp } from "./calculateXp";
import {
  applyPerfectAssist,
  getGoldenChance,
  getQualityLabel,
  getQualityMultiplier,
  getRerollCount,
  getShieldMinQuality,
  getStreakBonus,
  getXpMultiplier,
  nextStreak,
  resolveStreak,
} from "./multipliers";

const noUpgrades = { betterMaterials: 0, goldenTouch: 0 };

describe("quality multiplier", () => {
  it.each([
    [100, 1.3, "PERFECT"],
    [99, 1.2, "Excellent"],
    [95, 1.2, "Excellent"],
    [94, 1.1, "Great"],
    [85, 1.1, "Great"],
    [70, 1.0, "Good"],
    [50, 0.9, "Okay"],
    [49, 0.8, "Rough"],
    [0, 0.8, "Rough"],
  ])("quality %i → ×%f (%s)", (quality, multiplier, label) => {
    expect(getQualityMultiplier(quality)).toBe(multiplier);
    expect(getQualityLabel(quality)).toBe(label);
  });

  it("clamps out-of-range and invalid quality", () => {
    expect(getQualityMultiplier(250)).toBe(1.3);
    expect(getQualityMultiplier(-20)).toBe(0.8);
    expect(getQualityMultiplier(Number.NaN)).toBe(0.8);
  });
});

describe("streak", () => {
  it.each([
    [0, 0],
    [2, 0],
    [3, 0.05],
    [4, 0.05],
    [5, 0.1],
    [8, 0.15],
    [12, 0.2],
    [50, 0.2],
  ])("streak %i → +%f", (streak, bonus) => {
    expect(getStreakBonus(streak)).toBe(bonus);
  });

  it("grows on Perfect only", () => {
    expect(nextStreak(4, 100)).toBe(5);
    expect(nextStreak(4, 99)).toBe(3);
  });

  it("loses one step on a decent result and resets on a poor one", () => {
    expect(nextStreak(4, 70)).toBe(3);
    expect(nextStreak(4, 69)).toBe(0);
  });

  it("cannot go negative", () => {
    expect(nextStreak(0, 80)).toBe(0);
    expect(nextStreak(0, 10)).toBe(0);
    expect(nextStreak(-3, 80)).toBe(0);
  });
});

describe("coins", () => {
  it("matches the worked example from the design document", () => {
    // 18 × 1.20 × 1.05 × 1.10 = 24.948 → 25
    expect(
      calculateCoins({
        baseValue: 18,
        quality: 96,
        streak: 4,
        upgradeLevels: { betterMaterials: 1, goldenTouch: 0 },
        isGolden: false,
      }),
    ).toBe(25);
  });

  it("pays 5x for a Golden Product", () => {
    const base = { baseValue: 10, quality: 75, streak: 0, upgradeLevels: noUpgrades };
    expect(calculateCoins({ ...base, isGolden: false })).toBe(10);
    expect(calculateCoins({ ...base, isGolden: true })).toBe(50);
  });

  it("still pays for a rough product and never goes negative", () => {
    expect(calculateCoins({ baseValue: 10, quality: 0, streak: 0, upgradeLevels: noUpgrades, isGolden: false })).toBe(8);
    expect(calculateCoins({ baseValue: 0, quality: 100, streak: 12, upgradeLevels: noUpgrades, isGolden: true })).toBe(0);
  });
});

describe("xp", () => {
  it("pays 2–7 XP per machine", () => {
    expect(calculateMachineXp(0)).toBe(2);
    expect(calculateMachineXp(59)).toBe(4);
    expect(calculateMachineXp(100)).toBe(7);
  });

  it("scales step XP for products with many short steps, never below 1", () => {
    expect(calculateMachineXp(100, 0.5)).toBe(4);
    expect(calculateMachineXp(0, 0.5)).toBe(1);
    expect(calculateMachineXp(0, 0.1)).toBe(1);
    expect(calculateMachineXp(100, 1)).toBe(7);
  });

  it("adds a completion bonus, with a flat Golden bonus rather than a multiplier", () => {
    expect(calculateCompletionXp(2, false)).toBe(7);
    expect(calculateCompletionXp(4, false)).toBe(9);
    expect(calculateCompletionXp(2, true)).toBe(12);
  });
});

describe("golden chance", () => {
  it.each([
    [0, 0],
    [1, 0.02],
    [2, 0.03],
    [3, 0.04],
    [4, 0.05],
    [5, 0.06],
    [9, 0.06],
  ])("level %i → %f", (level, chance) => {
    expect(getGoldenChance(level)).toBe(chance);
  });
});

describe("steady hands", () => {
  it("does nothing without the upgrade", () => {
    expect(applyPerfectAssist(99, {})).toBe(99);
    expect(applyPerfectAssist(100, {})).toBe(100);
  });

  it.each([
    [1, 99, 100],
    [1, 98, 98],
    [3, 97, 100],
    [3, 96, 96],
    [5, 95, 100],
    [5, 94, 94],
    // Levels past the maximum are treated as the maximum.
    [9, 94, 94],
  ])("level %i turns %i into %i", (level, quality, expected) => {
    expect(applyPerfectAssist(quality, { steadyHands: level })).toBe(expected);
  });
});

describe("streak shield", () => {
  it.each([
    [0, null],
    [1, 95],
    [2, 85],
    [3, 70],
    [7, 70],
  ])("level %i covers %s and up", (level, min) => {
    expect(getShieldMinQuality({ streakShield: level })).toBe(min);
  });

  it("keeps the streak on a covered miss and reports that it was used", () => {
    expect(resolveStreak(6, 90, 85)).toEqual({ streak: 6, shieldUsed: true });
  });

  it("is not spent on a Perfect, a result below its cover, or an empty streak", () => {
    expect(resolveStreak(6, 100, 85)).toEqual({ streak: 7, shieldUsed: false });
    expect(resolveStreak(6, 80, 85)).toEqual({ streak: 5, shieldUsed: false });
    expect(resolveStreak(6, 60, 85)).toEqual({ streak: 0, shieldUsed: false });
    expect(resolveStreak(0, 90, 85)).toEqual({ streak: 0, shieldUsed: false });
  });

  it("behaves like the plain streak rule without a shield", () => {
    expect(resolveStreak(4, 90, null)).toEqual({ streak: nextStreak(4, 90), shieldUsed: false });
  });
});

describe("fast learner and fresh orders", () => {
  it("adds 10% XP per level, rounded per award", () => {
    expect(getXpMultiplier({})).toBe(1);
    expect(getXpMultiplier({ fastLearner: 3 })).toBeCloseTo(1.3);
    expect(boostXp(7, getXpMultiplier({ fastLearner: 3 }))).toBe(9);
    expect(boostXp(7, 1)).toBe(7);
  });

  it("gives one reroll per level", () => {
    expect(getRerollCount({})).toBe(0);
    expect(getRerollCount({ freshOrders: 2 })).toBe(2);
    expect(getRerollCount({ freshOrders: 9 })).toBe(3);
  });
});

describe("upgrade shop", () => {
  it("prices the new upgrades from their config", () => {
    expect(getUpgradeCost("steadyHands", 0)).toBe(120);
    expect(getUpgradeCost("steadyHands", 4)).toBe(3358);
    expect(getUpgradeCost("streakShield", 2)).toBe(2250);
    expect(getUpgradeCost("freshOrders", 1)).toBe(600);
    expect(getUpgradeCost("fastLearner", 0)).toBe(150);
  });

  it("describes each effect in plain words", () => {
    expect(describeUpgradeEffect("steadyHands", 0)).toBe("Perfect at 100% only");
    expect(describeUpgradeEffect("steadyHands", 2)).toBe("Perfect from 98%");
    expect(describeUpgradeEffect("streakShield", 0)).toBe("No shield");
    expect(describeUpgradeEffect("streakShield", 2)).toBe("Keeps streak at 85%+");
    expect(describeUpgradeEffect("fastLearner", 2)).toBe("XP +20%");
    expect(describeUpgradeEffect("freshOrders", 1)).toBe("1 reroll per board");
    expect(describeUpgradeEffect("freshOrders", 3)).toBe("3 rerolls per board");
  });
});

describe("fever meter", () => {
  const charged = (charge: number) => ({ charge, ordersLeft: 0 });

  it("gains a charge on a Perfect and loses one on a poor result", () => {
    expect(applyMachineResult(charged(2), 100)).toEqual({ fever: charged(3), activated: false });
    expect(applyMachineResult(charged(2), 69)).toEqual({ fever: charged(1), activated: false });
    expect(applyMachineResult(charged(0), 10)).toEqual({ fever: charged(0), activated: false });
  });

  it("holds steady on a decent result", () => {
    expect(applyMachineResult(charged(4), 99).fever).toEqual(charged(4));
    expect(applyMachineResult(charged(4), 70).fever).toEqual(charged(4));
  });

  it("starts Overdrive on the twelfth charge and empties the meter", () => {
    const step = applyMachineResult(charged(11), 100);
    expect(step).toEqual({ fever: { charge: 0, ordersLeft: 3 }, activated: true });
    expect(isOverdrive(step.fever)).toBe(true);
  });

  it("does not charge during Overdrive", () => {
    const active = { charge: 0, ordersLeft: 2 };
    expect(applyMachineResult(active, 100)).toEqual({ fever: active, activated: false });
    expect(applyMachineResult(active, 10)).toEqual({ fever: active, activated: false });
  });

  it("uses one Overdrive order per finished order, then starts again from empty", () => {
    let fever = { charge: 0, ordersLeft: 3 };
    fever = finishOrder(fever);
    fever = finishOrder(fever);
    expect(isOverdrive(fever)).toBe(true);
    fever = finishOrder(fever);
    expect(fever).toEqual(emptyFever);
    expect(finishOrder(fever)).toEqual(emptyFever);
    expect(applyMachineResult(fever, 100).fever).toEqual(charged(1));
  });

  it("clamps a stored meter to its limits", () => {
    expect(clampFever({ charge: 99, ordersLeft: 0 })).toEqual(charged(11));
    expect(clampFever({ charge: 5, ordersLeft: 40 })).toEqual({ charge: 0, ordersLeft: 3 });
  });
});
