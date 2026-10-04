import { beforeEach, describe, expect, it } from "vitest";
import { pickShiftVariant } from "@/game/machines/variants";
import { createFreshSave } from "@/lib/storage/saveService";
import { useGoalsStore } from "@/stores/goalsStore";
import { hydrateStores } from "@/stores/persistence";
import { usePlayerStore } from "@/stores/playerStore";
import { useRunStore } from "@/stores/runStore";
import { useShiftStore } from "@/stores/shiftStore";
import { useUiStore } from "@/stores/uiStore";
import { completeMachine, createOrder, endShift, exitMachine, finishProduct, startShift } from "./runActions";
import {
  applyShiftProduct,
  applyShiftResult,
  comboMultiplier,
  newShift,
  refundFactor,
  refundMs,
  shiftDifficulty,
  startClock,
  summarise,
  tickShift,
} from "./shift";

const running = () => startClock(newShift());

describe("shift clock", () => {
  it("starts at 30 seconds and waits for the first move", () => {
    const shift = newShift();
    expect(shift.timeLeftMs).toBe(30_000);
    expect(tickShift(shift, 5_000)).toBe(shift);
    expect(tickShift(startClock(shift), 5_000).timeLeftMs).toBe(25_000);
  });

  it("holds a warm-up clock until the first product is finished", () => {
    const warmup = newShift(true);
    expect(startClock(warmup).started).toBe(false);
    expect(applyShiftResult(warmup, 100, 3).timeLeftMs).toBe(30_000);
    expect(applyShiftProduct(applyShiftResult(warmup, 100, 3), 13, 21).started).toBe(true);
  });

  it("runs out at zero and stays there", () => {
    const done = tickShift(running(), 99_000);
    expect(done).toMatchObject({ timeLeftMs: 0, expired: true });
    expect(tickShift(done, 1_000)).toBe(done);
  });

  it("wins time back by quality band and loses it on a poor result", () => {
    expect([100, 97, 90, 75, 60].map(refundFactor)).toEqual([0.6, 0.45, 0.3, 0.15, -0.5]);
    expect(refundMs(100, 3, 0)).toBe(1_800);
    expect(refundMs(90, 3, 0)).toBe(900);
    // Half of a three-second machine would be 1.5 s, which is also the least a poor result costs.
    expect(refundMs(60, 3, 0)).toBe(-1_500);
    expect(refundMs(60, 1, 0)).toBe(-1_500);
    expect(refundMs(60, 9, 0)).toBe(-4_500);
  });

  it("scales with the machine, so a long one is not a punishment", () => {
    expect(refundMs(100, 9, 0)).toBe(refundMs(100, 3, 0) * 3);
  });

  it("gives back less with every product, down to a floor", () => {
    expect(refundMs(100, 3, 1)).toBe(1_620);
    expect(refundMs(100, 3, 5)).toBeLessThan(refundMs(100, 3, 1));
    expect(refundMs(100, 3, 500)).toBe(450);
    // Penalties do not shrink.
    expect(refundMs(60, 3, 500)).toBe(-1_500);
  });

  it("never holds more than 45 seconds", () => {
    let shift = { ...running(), timeLeftMs: 44_500 };
    shift = applyShiftResult(shift, 100, 9);
    expect(shift.timeLeftMs).toBe(45_000);
  });

  it("lets a buzzer-beater score without buying the shift back", () => {
    const expired = tickShift(running(), 99_000);
    const after = applyShiftResult(expired, 100, 3);
    expect(after).toMatchObject({ timeLeftMs: 0, expired: true, lastDeltaMs: 0 });
    expect(after.score).toBeGreaterThan(0);
  });

  it("can end on a penalty", () => {
    const nearly = { ...running(), timeLeftMs: 1_000 };
    expect(applyShiftResult(nearly, 40, 3)).toMatchObject({ timeLeftMs: 0, expired: true });
  });
});

describe("shift score", () => {
  it("multiplies by a combo that grows with Perfects, up to x3", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(5)).toBeCloseTo(1.5);
    expect(comboMultiplier(500)).toBe(3);
  });

  it("keeps the combo on a decent result and loses it on a poor one", () => {
    let shift = running();
    shift = applyShiftResult(shift, 100, 3);
    shift = applyShiftResult(shift, 100, 3);
    expect(shift).toMatchObject({ combo: 2, score: 110 + 120, machines: 2 });
    shift = applyShiftResult(shift, 90, 3);
    expect(shift.combo).toBe(2);
    shift = applyShiftResult(shift, 50, 3);
    expect(shift).toMatchObject({ combo: 0, bestCombo: 2 });
  });

  it("adds a bonus and the earnings for each finished product", () => {
    const shift = applyShiftProduct(applyShiftResult(running(), 100, 3), 13, 21);
    // 110 for the Perfect, then 50 x 1.1 for the product.
    expect(shift).toMatchObject({ products: 1, coins: 13, xp: 21, score: 165 });
  });

  it("gets trickier as products are finished", () => {
    expect(shiftDifficulty(0)).toEqual({ variantCount: 1, tempo: 1 });
    expect(shiftDifficulty(4).variantCount).toBe(3);
    expect(shiftDifficulty(4).tempo).toBeCloseTo(1.24);
    expect(shiftDifficulty(500).tempo).toBe(1.8);
  });

  it("opens on basic variants and widens only to what the level has unlocked", () => {
    for (let i = 0; i < 40; i++) {
      expect(pickShiftVariant("stamper", `run-${i}`, 1, 15, 1).id).toBe("steady");
      expect(["steady", "quick"]).toContain(pickShiftVariant("stamper", `run-${i}`, 1, 15, 2).id);
      // At level 2 only the basic Stamper exists, however far the shift has gone.
      expect(pickShiftVariant("stamper", `run-${i}`, 1, 2, 9).id).toBe("steady");
    }
  });

  it("reports a new best only when the old one is beaten", () => {
    const shift = { ...running(), score: 900, products: 4 };
    expect(summarise(shift, 500)).toMatchObject({ isBest: true, previousBest: 500 });
    expect(summarise(shift, 900).isBest).toBe(false);
  });
});

describe("playing a shift", () => {
  const run = () => useRunStore.getState();
  const shift = () => useShiftStore.getState().shift;

  const playMachine = (quality: number) => {
    run().dispatch("ENTER_DONE");
    run().dispatch("INTERACTION_START");
    useShiftStore.getState().update(startClock);
    completeMachine({ quality, durationMs: 900 });
    run().dispatch("SCORE_COMMITTED");
    run().dispatch("CONTINUE");
    exitMachine();
  };
  const playProduct = (quality: number) => {
    run().dispatch("INTRO_DONE");
    playMachine(quality);
    playMachine(quality);
    return finishProduct();
  };

  beforeEach(() => {
    useRunStore.getState().clear();
    useShiftStore.getState().reset();
    useUiStore.getState().reset();
    hydrateStores(createFreshSave());
  });

  it("starts with a product on the belt, as a warm-up for a brand-new player", () => {
    startShift();
    expect(useUiStore.getState().mode).toBe("shift");
    expect(run().run?.productId).toBe("woodBlock");
    expect(shift()).toMatchObject({ warmup: true, started: false, timeLeftMs: 30_000 });
  });

  it("is not a warm-up once the player has made something", () => {
    usePlayerStore.getState().hydrate({ ...usePlayerStore.getState(), totalProductsCompleted: 3 });
    startShift();
    expect(shift()?.warmup).toBe(false);
  });

  it("scores each result, pays each product once and starts the clock after the warm-up product", () => {
    startShift();
    const summary = playProduct(100);
    expect(summary?.coins).toBe(13);
    expect(usePlayerStore.getState().coins).toBe(13);
    // Perfects at x1.1 and x1.2, then the product bonus at x1.2.
    expect(shift()).toMatchObject({ machines: 2, products: 1, coins: 13, xp: 21, score: 110 + 120 + 60, started: true });
    // The clock did not move during the warm-up.
    expect(shift()?.timeLeftMs).toBe(30_000);

    createOrder();
    playProduct(100);
    expect(shift()?.products).toBe(2);
    // Two Perfects on three-second machines after one product: 2 x 1,620 ms, capped by nothing yet.
    expect(shift()?.timeLeftMs).toBe(33_240);
    expect(finishProduct()).toBeNull();
    expect(shift()?.products).toBe(2);
  });

  it("ends with a summary, saves a new best and clears the belt", () => {
    startShift();
    playProduct(100);
    createOrder();
    const summary = endShift();
    expect(summary).toMatchObject({ score: 290, products: 1, isBest: true, previousBest: 0 });
    expect(shift()).toBeNull();
    expect(run().run).toBeNull();
    expect(useShiftStore.getState().summary).toEqual(summary);
    expect(useGoalsStore.getState().stats.bestShift).toEqual({ score: 290, products: 1 });
    expect(endShift()).toBeNull();
  });

  it("keeps the old best when a shift scores less", () => {
    useGoalsStore.getState().setStats({ ...useGoalsStore.getState().stats, bestShift: { score: 5_000, products: 12 } });
    startShift();
    playProduct(100);
    expect(endShift()).toMatchObject({ isBest: false, previousBest: 5_000 });
    expect(useGoalsStore.getState().stats.bestShift).toEqual({ score: 5_000, products: 12 });
  });

  it("holds level-ups until the shift is over", () => {
    startShift();
    for (let i = 0; i < 4; i++) {
      playProduct(100);
      createOrder();
    }
    expect(usePlayerStore.getState().factoryLevel).toBeGreaterThanOrEqual(2);
    // Nothing clears them during the shift; the summary screen celebrates them.
    expect(useUiStore.getState().pendingLevelUps.length).toBeGreaterThan(0);
  });

  it("leaves free play untouched", () => {
    useUiStore.getState().setMode("free");
    createOrder();
    playProduct(100);
    expect(shift()).toBeNull();
    expect(usePlayerStore.getState().coins).toBe(13);
  });
});
