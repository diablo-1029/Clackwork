import { describe, expect, it } from "vitest";
import type { Point } from "@/lib/math";
import { calculateCutterQuality, isCutAttempt } from "./cutter/cutterScoring";
import { cutPatterns, pickCutPattern, splitAlong } from "./cutter/cutterGeometry";
import { calculatePackagerQuality } from "./packager/packagerScoring";
import { calculatePolisherQuality, polisherTuning } from "./polisher/polisherScoring";
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
    expect(pickCutPattern("run-a", false)).toBe(pickCutPattern("run-a", false));
    expect(cutPatterns).toContain(pickCutPattern("run-b", false));
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
