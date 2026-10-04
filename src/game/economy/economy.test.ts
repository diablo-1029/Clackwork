import { describe, expect, it } from "vitest";
import { calculateCoins } from "./calculateCoins";
import { calculateCompletionXp, calculateMachineXp } from "./calculateXp";
import {
  getGoldenChance,
  getQualityLabel,
  getQualityMultiplier,
  getStreakBonus,
  nextStreak,
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
