import { describe, expect, it } from "vitest";
import type { Point } from "@/lib/math";
import { calculateCutterQuality, isCutAttempt } from "./cutter/cutterScoring";
import { cutPatterns, getCutPattern, pickCutPattern, pieceShift, splitAlong } from "./cutter/cutterGeometry";
import { calculatePackagerQuality } from "./packager/packagerScoring";
import {
  calculatePaintBoothQuality,
  depositPaint,
  paintBoothTuning,
  paintCoverage,
} from "./paintBooth/paintBoothScoring";
import { calculatePolisherQuality, polisherTuning } from "./polisher/polisherScoring";
import { PRODUCT_RECT } from "./shared";
import { calculateSorterQuality, createSortQueue, sorterTuning } from "./sorter/sorterScoring";
import { calculateStamperQuality, markerPosition } from "./stamper/stamperScoring";

const from: Point = { x: 200, y: 70 };
const to: Point = { x: 200, y: 230 };

/** A vertical trace from `start` to `end` (0–1 along the guide) with a sideways offset. */
function trace(offset: number | ((t: number) => number), start = 0, end = 1, steps = 40): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = start + ((end - start) * i) / steps;
    const dx = typeof offset === "function" ? offset(t) : offset;
    return { x: from.x + dx, y: from.y + (to.y - from.y) * t };
  });
}

describe("cutter scoring", () => {
  it("scores a centred full trace as Perfect", () => {
    expect(calculateCutterQuality({ points: trace(0), from, to })).toBe(100);
  });

  it("forgives a small natural wobble", () => {
    expect(calculateCutterQuality({ points: trace((t) => Math.sin(t * 20) * 3), from, to })).toBe(100);
  });

  it("reduces the score for moderate deviation", () => {
    const quality = calculateCutterQuality({ points: trace(18), from, to });
    expect(quality).toBeLessThan(90);
    expect(quality).toBeGreaterThan(50);
  });

  it("reduces the score for an incomplete line", () => {
    const quality = calculateCutterQuality({ points: trace(0, 0, 0.5), from, to });
    expect(quality).toBeLessThan(90);
    expect(quality).toBeGreaterThan(70);
  });

  it("scores extreme deviation low", () => {
    expect(calculateCutterQuality({ points: trace(60), from, to })).toBeLessThanOrEqual(30);
  });

  it("penalises scrubbing back and forth", () => {
    const scrub = [...trace(0, 0, 0.8), ...trace(0, 0.8, 0.2), ...trace(0, 0.2, 1)];
    expect(calculateCutterQuality({ points: scrub, from, to })).toBeLessThan(100);
  });

  it("is deterministic and stays within 0–100", () => {
    const points = trace((t) => (t - 0.5) * 300);
    const first = calculateCutterQuality({ points, from, to });
    expect(calculateCutterQuality({ points, from, to })).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(100);
    expect(calculateCutterQuality({ points: [], from, to })).toBe(0);
  });

  it("treats a tiny drag as a slip rather than an attempt", () => {
    expect(isCutAttempt({ points: trace(0, 0, 0.1), from, to })).toBe(false);
    expect(isCutAttempt({ points: trace(0, 0, 0.5), from, to })).toBe(true);
  });
});

describe("cutter geometry", () => {
  it("always teaches with the vertical cut", () => {
    expect(pickCutPattern("any-run", true).id).toBe("vertical");
  });

  it("picks a stable pattern per run", () => {
    expect(pickCutPattern("run-a", false, 5)).toBe(pickCutPattern("run-a", false, 5));
    expect(cutPatterns).toContain(pickCutPattern("run-b", false, 5));
  });

  it("keeps double cuts back until their level", () => {
    const ids = (level: number) =>
      new Set(Array.from({ length: 200 }, (_, i) => pickCutPattern(`run-${i}`, false, level).id));
    expect([...ids(1)].some((id) => id.startsWith("double"))).toBe(false);
    expect(ids(2).has("doubleVertical")).toBe(true);
    expect(ids(2).has("doubleHorizontal")).toBe(true);
  });

  it("scores each cut of a double pattern on its own guide", () => {
    const pattern = getCutPattern("doubleVertical")!;
    expect(pattern.segments).toHaveLength(2);
    const along = (s: { from: Point; to: Point }, offset: number) =>
      Array.from({ length: 41 }, (_, i) => ({
        x: s.from.x + offset,
        y: s.from.y + ((s.to.y - s.from.y) * i) / 40,
      }));
    const clean = calculateCutterQuality({ points: along(pattern.segments[0], 0), ...pattern.segments[0] });
    const crooked = calculateCutterQuality({ points: along(pattern.segments[1], 20), ...pattern.segments[1] });
    expect(clean).toBe(100);
    expect(crooked).toBeLessThan(90);
    // Tracing the first guide while the second is on offer is a miss, not a pass.
    expect(calculateCutterQuality({ points: along(pattern.segments[0], 0), ...pattern.segments[1] })).toBeLessThan(40);
  });

  it("slides pieces apart only along cuts that are made", () => {
    // Two cuts, three pieces.
    expect([0, 1, 2].map((i) => pieceShift(i, 0))).toEqual([0, 0, 0]);
    expect([0, 1, 2].map((i) => pieceShift(i, 1))).toEqual([1, -1, -1]);
    expect([0, 1, 2].map((i) => pieceShift(i, 2))).toEqual([2, 0, -2]);
  });

  it("splits the stage into two sides with a unit normal", () => {
    const halves = splitAlong(from, to);
    expect(Math.hypot(halves.normal.x, halves.normal.y)).toBeCloseTo(1);
    expect(halves.sideA).not.toBe(halves.sideB);
  });
});

describe("packager scoring", () => {
  const a: Point = { x: 70, y: 150 };
  const b: Point = { x: 330, y: 150 };
  const tape = (offset: number, end = 1): Point[] =>
    Array.from({ length: 41 }, (_, i) => ({ x: a.x + ((b.x - a.x) * end * i) / 40, y: a.y + offset }));

  it("scores centred tape as Perfect", () => {
    expect(calculatePackagerQuality({ points: tape(0), from: a, to: b })).toBe(100);
  });

  it("scores slightly crooked tape high but not Perfect", () => {
    const quality = calculatePackagerQuality({ points: tape(12), from: a, to: b });
    expect(quality).toBeGreaterThanOrEqual(70);
    expect(quality).toBeLessThan(100);
  });

  it("scores partial tape lower", () => {
    const partial = calculatePackagerQuality({ points: tape(0, 0.5), from: a, to: b });
    expect(partial).toBeLessThan(85);
    expect(partial).toBeLessThan(calculatePackagerQuality({ points: tape(0, 0.9), from: a, to: b }));
  });
});

describe("stamper scoring", () => {
  it("scores the exact center as Perfect", () => {
    expect(calculateStamperQuality(0.5)).toBe(100);
  });

  it("keeps a small Perfect zone around the center", () => {
    expect(calculateStamperQuality(0.52)).toBe(100);
    expect(calculateStamperQuality(0.48)).toBe(100);
  });

  it("scores near the center high and is symmetric", () => {
    expect(calculateStamperQuality(0.58)).toBeGreaterThanOrEqual(85);
    expect(calculateStamperQuality(0.58)).toBeLessThan(100);
    expect(calculateStamperQuality(0.4)).toBe(calculateStamperQuality(0.6));
  });

  it("scores the edge lowest", () => {
    expect(calculateStamperQuality(0.85)).toBeLessThan(calculateStamperQuality(0.65));
    expect(calculateStamperQuality(0)).toBe(0);
    expect(calculateStamperQuality(1)).toBe(0);
  });

  it("sweeps the marker left to right and back at constant speed", () => {
    expect(markerPosition(0, 2000)).toBe(0);
    expect(markerPosition(500, 2000)).toBe(0.5);
    expect(markerPosition(1000, 2000)).toBe(1);
    expect(markerPosition(1500, 2000)).toBe(0.5);
    expect(markerPosition(2000, 2000)).toBe(0);
  });
});

describe("polisher scoring", () => {
  const size = polisherTuning.cols * polisherTuning.rows;
  const cells = (polishedShare: number, value = 1) =>
    Array.from({ length: size }, (_, i) => (i < size * polishedShare ? value : 0));

  it("scores a fully polished surface as Perfect", () => {
    expect(calculatePolisherQuality({ cells: cells(1), durationMs: 8000 })).toBe(100);
  });

  it("barely penalises taking your time", () => {
    expect(calculatePolisherQuality({ cells: cells(1), durationMs: 60_000 })).toBe(95);
  });

  it("scores partial coverage lower", () => {
    const half = calculatePolisherQuality({ cells: cells(0.5), durationMs: 8000 });
    const most = calculatePolisherQuality({ cells: cells(0.9), durationMs: 8000 });
    expect(half).toBeLessThan(most);
    expect(most).toBeLessThan(100);
  });

  it("scores an untouched surface low", () => {
    expect(calculatePolisherQuality({ cells: cells(0), durationMs: 8000 })).toBeLessThanOrEqual(30);
  });
});

describe("paint booth scoring", () => {
  const size = paintBoothTuning.cols * paintBoothTuning.rows;
  const coat = (share: number, thickness = 0.9) =>
    Array.from({ length: size }, (_, i) => (i < size * share ? thickness : 0));

  /** Sprays back and forth across the tile at a steady speed, 16 ms per frame. */
  function sweep(speed: number, rowGap = 22) {
    const cells = new Float32Array(size);
    const { x, y, w, h } = PRODUCT_RECT;
    const step = (speed * 16) / 1000;
    let row = 0;
    for (let py = y + 10; py <= y + h - 8; py += rowGap, row++) {
      for (let travelled = 0; travelled <= w - 16; travelled += step) {
        const px = row % 2 ? x + w - 8 - travelled : x + 8 + travelled;
        depositPaint(cells, { x: px, y: py }, 16);
      }
    }
    return cells;
  }

  it("scores a full, even coat as Perfect", () => {
    expect(calculatePaintBoothQuality({ cells: coat(1), oversprayMs: 0 })).toBe(100);
  });

  it("scores bare patches lower", () => {
    const most = calculatePaintBoothQuality({ cells: coat(0.8), oversprayMs: 0 });
    const half = calculatePaintBoothQuality({ cells: coat(0.5), oversprayMs: 0 });
    expect(most).toBeLessThan(100);
    expect(half).toBeLessThan(most);
    expect(calculatePaintBoothQuality({ cells: coat(0), oversprayMs: 0 })).toBeLessThanOrEqual(20);
  });

  it("scores pooled paint lower", () => {
    expect(calculatePaintBoothQuality({ cells: coat(1, 2.6), oversprayMs: 0 })).toBe(70);
  });

  it("scores overspray lower, after a short grace period", () => {
    expect(calculatePaintBoothQuality({ cells: coat(1), oversprayMs: 300 })).toBe(100);
    expect(calculatePaintBoothQuality({ cells: coat(1), oversprayMs: 5000 })).toBe(85);
  });

  it("rewards one smooth pass", () => {
    const cells = sweep(150);
    expect(paintCoverage(cells)).toBeGreaterThanOrEqual(paintBoothTuning.fullCoverage);
    expect(calculatePaintBoothQuality({ cells, oversprayMs: 0 })).toBe(100);
  });

  it("lets a fast, thin pass be topped up without pooling", () => {
    const { x, y, w, h } = PRODUCT_RECT;
    const cells = sweep(300);
    expect(paintCoverage(cells)).toBeLessThan(paintBoothTuning.releaseFinishCoverage);
    // A second quick pass over the same rows.
    for (let py = y + 10; py <= y + h - 8; py += 22) {
      for (let px = x + 8; px <= x + w - 8; px += 4.8) depositPaint(cells, { x: px, y: py }, 16);
    }
    expect(calculatePaintBoothQuality({ cells, oversprayMs: 0 })).toBe(100);
  });

  it("pools paint when the spray crawls", () => {
    const slow = calculatePaintBoothQuality({ cells: sweep(60), oversprayMs: 0 });
    expect(slow).toBeLessThan(90);
  });

  it("pools paint when the nozzle is held still", () => {
    const cells = new Float32Array(size);
    const center = { x: PRODUCT_RECT.x + PRODUCT_RECT.w / 2, y: PRODUCT_RECT.y + PRODUCT_RECT.h / 2 };
    for (let ms = 0; ms < 900; ms += 16) depositPaint(cells, center, 16);
    expect(Math.max(...cells)).toBeGreaterThan(paintBoothTuning.thickThreshold);
    expect(Math.max(...cells)).toBeLessThanOrEqual(paintBoothTuning.maxThickness);
  });

  it("reports the nozzle being off the tile", () => {
    const cells = new Float32Array(size);
    expect(depositPaint(cells, { x: PRODUCT_RECT.x + 20, y: PRODUCT_RECT.y + 20 }, 16)).toBe(false);
    expect(depositPaint(cells, { x: PRODUCT_RECT.x - 3, y: PRODUCT_RECT.y + 20 }, 16)).toBe(false);
    expect(depositPaint(cells, { x: PRODUCT_RECT.x - 30, y: PRODUCT_RECT.y + 20 }, 16)).toBe(true);
  });
});

describe("sorter scoring", () => {
  const picks = (correct: boolean[], reactionMs = 800) => correct.map((c) => ({ correct: c, reactionMs }));

  it("scores every gem in the right bin at a relaxed pace as Perfect", () => {
    expect(calculateSorterQuality(picks([true, true, true, true, true]))).toBe(100);
    expect(calculateSorterQuality(picks([true, true, true, true, true], 1500))).toBe(100);
  });

  it("caps one wrong bin out of five at 84", () => {
    expect(calculateSorterQuality(picks([true, true, false, true, true]))).toBe(84);
  });

  it("scores all wrong low", () => {
    expect(calculateSorterQuality(picks([false, false, false, false, false]))).toBe(20);
    expect(calculateSorterQuality([])).toBe(0);
  });

  it("only ever costs the speed share for taking your time", () => {
    expect(calculateSorterQuality(picks([true, true, true, true, true], 60_000))).toBe(80);
    expect(calculateSorterQuality(picks([true, true, true, true, true], 2750))).toBe(90);
  });

  it("builds a stable, mixed queue for each run", () => {
    expect(createSortQueue("run-a")).toEqual(createSortQueue("run-a"));
    for (let i = 0; i < 200; i++) {
      const queue = createSortQueue(`run-${i}`);
      expect(queue).toHaveLength(sorterTuning.itemCount);
      expect(new Set(queue).size).toBe(2);
      let run = 1;
      for (let j = 1; j < queue.length; j++) {
        run = queue[j] === queue[j - 1] ? run + 1 : 1;
        expect(run).toBeLessThanOrEqual(sorterTuning.maxRun);
      }
    }
    expect(new Set(createSortQueue("short", 2)).size).toBe(2);
  });
});
