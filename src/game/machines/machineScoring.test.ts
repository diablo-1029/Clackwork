import { describe, expect, it } from "vitest";
import type { Point } from "@/lib/math";
import { calculateCutterQuality, isCutAttempt } from "./cutter/cutterScoring";
import {
  assemblerTuning,
  calculateAssemblerQuality,
  partAt,
  resolveDrop,
  robotStages,
  stageForStep,
} from "./assembler/assemblerScoring";
import { cutPatterns, getCutPattern, pickCutPattern, pieceShift, splitAlong } from "./cutter/cutterGeometry";
import { calculatePackagerQuality, tapeRuns } from "./packager/packagerScoring";
import {
  calculatePaintBoothQuality,
  depositPaint,
  paintBoothTuning,
  paintCoverage,
  paintNozzles,
  type PaintNozzle,
} from "./paintBooth/paintBoothScoring";
import { calculatePolisherQuality, initialPolish, polishCoverage, polisherTuning } from "./polisher/polisherScoring";
import { PRODUCT_RECT } from "./shared";
import { calculateSorterQuality, createSortQueue, sortPlan, sorterTuning } from "./sorter/sorterScoring";
import { calculateStamperQuality, markerPosition, nearestTarget, stampPlan } from "./stamper/stamperScoring";
import { machineVariants, pickVariant } from "./variants";

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
  function sweep(speed: number, rowGap = 22, nozzle?: PaintNozzle) {
    const cells = new Float32Array(size);
    const { x, y, w, h } = PRODUCT_RECT;
    const step = (speed * 16) / 1000;
    let row = 0;
    for (let py = y + 10; py <= y + h - 8; py += rowGap, row++) {
      for (let travelled = 0; travelled <= w - 16; travelled += step) {
        const px = row % 2 ? x + w - 8 - travelled : x + 8 + travelled;
        depositPaint(cells, { x: px, y: py }, 16, nozzle);
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

  it("counts one long pause as one slow pick, not a slow run", () => {
    const paused = [
      { correct: true, reactionMs: 120_000 },
      ...picks([true, true, true, true]),
    ];
    // (4000 + 4 x 800) / 5 = 1440 ms on average: still inside the relaxed pace.
    expect(calculateSorterQuality(paused)).toBe(100);
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

describe("assembler scoring", () => {
  const stage = (id: string) => robotStages.find((s) => s.id === id)!;
  const final = stage("final");
  const head = stage("head");
  const socket = (st: typeof final, id: string) => st.sockets.find((s) => s.id === id)!.at;
  const socketOfKind = (st: typeof final, kind: string, nth = 0) => st.sockets.filter((s) => s.kind === kind)[nth];
  const partOfKind = (st: typeof final, kind: string, nth = 0) => st.parts.filter((p) => p.kind === kind)[nth];

  it("builds the robot in five steps: head, arms, legs, torso, then the whole thing", () => {
    expect(robotStages.map((s) => s.id)).toEqual(["head", "arms", "legs", "torso", "final"]);
    expect(stageForStep(0).id).toBe("head");
    expect(stageForStep(4).id).toBe("final");
    expect(stageForStep(99).id).toBe("final");
    expect(stageForStep(-1).id).toBe("head");
  });

  it("gives every step exactly the parts its sockets need", () => {
    for (const st of robotStages) {
      expect(st.parts.map((p) => p.kind).sort()).toEqual(st.sockets.map((s) => s.kind).sort());
    }
    expect(head.parts.map((p) => p.kind).sort()).toEqual(["aerial", "eye", "eye", "mouth"]);
    expect(stage("arms").parts.map((p) => p.kind).sort()).toEqual(["gripper", "gripper", "shoulder", "shoulder"]);
    expect(stage("legs").parts.map((p) => p.kind).sort()).toEqual(["foot", "foot", "knee", "knee"]);
    expect(stage("torso").parts.map((p) => p.kind).sort()).toEqual(["belt", "buttons", "gauge", "neck"]);
    expect(final.parts.map((p) => p.kind).sort()).toEqual(["arm", "arm", "head", "leg", "leg"]);
  });

  it("keeps every step unambiguous to play", () => {
    for (const st of robotStages) {
      // Sockets for different parts never overlap in snapping range.
      for (const a of st.sockets) for (const b of st.sockets) {
        if (a.kind !== b.kind) {
          expect(Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y)).toBeGreaterThan(assemblerTuning.snapRadius * 2);
        }
      }
      // Loose parts are far enough apart to grab the one you mean.
      for (const a of st.parts) for (const b of st.parts) {
        if (a !== b) expect(Math.hypot(a.tray.x - b.tray.x, a.tray.y - b.tray.y)).toBeGreaterThan(50);
      }
      // Nothing waits in the tray within snapping range of a socket, and everything is on the stage.
      for (const part of st.parts) {
        expect(part.tray.x).toBeGreaterThan(20);
        expect(part.tray.x).toBeLessThan(380);
        expect(part.tray.y).toBeLessThan(290);
        for (const s of st.sockets) {
          expect(Math.hypot(part.tray.x - s.at.x, part.tray.y - s.at.y)).toBeGreaterThan(60);
        }
      }
    }
  });

  it("scores exact drops with no wrong sockets as Perfect", () => {
    expect(calculateAssemblerQuality(final, { offsets: [0, 3, 8, 9, 5], wrongDrops: 0 })).toBe(100);
    expect(calculateAssemblerQuality(head, { offsets: [0, 3, 8, 9], wrongDrops: 0 })).toBe(100);
  });

  it("scores sloppy but valid drops lower", () => {
    const sloppy = calculateAssemblerQuality(head, { offsets: [20, 20, 20, 20], wrongDrops: 0 });
    expect(sloppy).toBeLessThan(90);
    expect(sloppy).toBeGreaterThan(40);
    expect(calculateAssemblerQuality(head, { offsets: [26, 26, 26, 26], wrongDrops: 0 })).toBe(25);
  });

  it("charges for each wrong socket, up to a cap", () => {
    const exact = [0, 0, 0, 0];
    expect(calculateAssemblerQuality(head, { offsets: exact, wrongDrops: 1 })).toBe(92);
    expect(calculateAssemblerQuality(head, { offsets: exact, wrongDrops: 3 })).toBe(75);
    expect(calculateAssemblerQuality(head, { offsets: exact, wrongDrops: 30 })).toBe(75);
  });

  it("cannot score well with parts missing", () => {
    expect(calculateAssemblerQuality(final, { offsets: [0, 0], wrongDrops: 0 })).toBe(55);
    expect(calculateAssemblerQuality(final, { offsets: [], wrongDrops: 0 })).toBe(25);
  });

  it("places a part released on its own socket", () => {
    const at = socket(final, "head");
    expect(resolveDrop(final, "head", { x: at.x + 4, y: at.y }, [])).toEqual({ kind: "placed", socketId: "head", offset: 4 });
  });

  it("lets matching parts go in either of their sockets", () => {
    expect(resolveDrop(final, "armA", socket(final, "armRight"), [])).toMatchObject({ kind: "placed", socketId: "armRight" });
    expect(resolveDrop(final, "armB", socket(final, "armLeft"), ["armRight"])).toMatchObject({ kind: "placed", socketId: "armLeft" });

    const eye = partOfKind(head, "eye", 0);
    const farEyeSocket = socketOfKind(head, "eye", 1);
    expect(resolveDrop(head, eye.id, farEyeSocket.at, [])).toMatchObject({ kind: "placed", socketId: farEyeSocket.id });
  });

  it("never treats a leg dropped between the two leg sockets as a mistake", () => {
    const left = socket(final, "legLeft");
    const between = { x: (left.x + socket(final, "legRight").x) / 2, y: left.y };
    expect(resolveDrop(final, "legA", between, []).kind).toBe("placed");
    // With one side taken, it goes to the side that is still free.
    expect(resolveDrop(final, "legA", between, ["legLeft"])).toMatchObject({ kind: "placed", socketId: "legRight" });
  });

  it("reports a wrong socket, and a miss in empty space", () => {
    expect(resolveDrop(final, "head", socket(final, "armLeft"), [])).toEqual({ kind: "wrong", socketId: "armLeft" });
    const mouth = partOfKind(head, "mouth");
    const eyeSocket = socketOfKind(head, "eye");
    expect(resolveDrop(head, mouth.id, eyeSocket.at, [])).toEqual({ kind: "wrong", socketId: eyeSocket.id });
    expect(resolveDrop(final, "head", { x: 200, y: 292 }, [])).toEqual({ kind: "miss" });
    expect(resolveDrop(final, "nonsense", socket(final, "head"), [])).toEqual({ kind: "miss" });
    // A part from another step does not exist here.
    expect(resolveDrop(head, "armA", socketOfKind(head, "eye").at, [])).toEqual({ kind: "miss" });
  });

  it("does not reuse a filled socket", () => {
    expect(resolveDrop(final, "head", socket(final, "head"), ["head"])).toEqual({ kind: "miss" });
  });

  it("picks up the nearest loose part, never a placed one", () => {
    const part = final.parts.find((p) => p.id === "head")!;
    expect(partAt(final, { x: part.tray.x + 5, y: part.tray.y }, [])?.id).toBe("head");
    expect(partAt(final, { x: part.tray.x + 5, y: part.tray.y }, ["head"])).toBeNull();
    expect(partAt(final, { x: 200, y: 292 }, [])).toBeNull();
  });
});

describe("machine variants", () => {
  it("always teaches with the basic variant", () => {
    for (const id of Object.keys(machineVariants) as (keyof typeof machineVariants)[]) {
      expect(pickVariant(id, "any-run", 0, 99, true)).toBe(machineVariants[id][0]);
      expect(machineVariants[id][0].instruction).toBeNull();
    }
  });

  it("is stable for a step and differs between steps and runs", () => {
    expect(pickVariant("stamper", "run-a", 1, 20)).toBe(pickVariant("stamper", "run-a", 1, 20));
    const seen = new Set(Array.from({ length: 200 }, (_, i) => pickVariant("stamper", `run-${i}`, 1, 20).id));
    expect([...seen].sort()).toEqual(["double", "offset", "quick", "steady"]);
  });

  it("holds each variant back until its level", () => {
    const at = (machine: keyof typeof machineVariants, level: number) =>
      new Set(Array.from({ length: 300 }, (_, i) => pickVariant(machine, `run-${i}`, 0, level).id));
    expect([...at("packager", 2)]).toEqual(["across"]);
    expect(at("packager", 3).has("down")).toBe(true);
    expect(at("packager", 6).has("cross")).toBe(false);
    expect(at("packager", 7).has("cross")).toBe(true);
    expect(at("stamper", 5).has("offset")).toBe(false);
    expect(at("sorter", 11).has("three")).toBe(false);
    expect(at("sorter", 12).has("three")).toBe(true);
  });
});

describe("packager variants", () => {
  it("lays one strip, or two for a cross", () => {
    expect(tapeRuns("across")).toHaveLength(1);
    expect(tapeRuns("down")).toHaveLength(1);
    expect(tapeRuns("cross")).toHaveLength(2);
    expect(tapeRuns("unknown")).toEqual(tapeRuns("across"));
  });

  it("scores a strip pulled straight down its own guide as Perfect", () => {
    const [down] = tapeRuns("down");
    const points = Array.from({ length: 41 }, (_, i) => ({
      x: down.from.x,
      y: down.from.y + ((down.to.y - down.from.y) * i) / 40,
    }));
    expect(calculatePackagerQuality({ points, ...down })).toBe(100);
    // The same pull judged against the sideways guide is a miss.
    expect(calculatePackagerQuality({ points, ...tapeRuns("across")[0] })).toBeLessThan(40);
  });
});

describe("stamper variants", () => {
  it("scores against wherever the mark is", () => {
    expect(calculateStamperQuality(0.3, 0.3)).toBe(100);
    expect(calculateStamperQuality(0.5, 0.3)).toBeLessThan(80);
    expect(calculateStamperQuality(0.2, 0.3)).toBe(calculateStamperQuality(0.4, 0.3));
  });

  it("plans one mark, a moved mark, or two", () => {
    expect(stampPlan("steady", "r")).toEqual({ periodMs: 1900, targets: [0.5] });
    expect(stampPlan("quick", "r").periodMs).toBeLessThan(1900);
    expect([0.3, 0.7]).toContain(stampPlan("offset", "r").targets[0]);
    expect(stampPlan("offset", "r")).toEqual(stampPlan("offset", "r"));
    expect(stampPlan("double", "r").targets).toEqual([0.3, 0.7]);
  });

  it("aims each press of a double at the nearest mark still open", () => {
    expect(nearestTarget(0.35, [0.3, 0.7])).toBe(0.3);
    expect(nearestTarget(0.6, [0.3, 0.7])).toBe(0.7);
    expect(nearestTarget(0.35, [0.7])).toBe(0.7);
  });
});

describe("polisher variants", () => {
  it("starts fully dull by default", () => {
    expect(polishCoverage(initialPolish("full", "run"))).toBe(0);
  });

  it("starts partly clean for patches and edges, the same way each time", () => {
    for (const variant of ["patches", "edges"]) {
      const start = polishCoverage(initialPolish(variant, "run-a"));
      expect(start).toBeGreaterThan(0.2);
      expect(start).toBeLessThan(0.9);
      expect(initialPolish(variant, "run-a")).toEqual(initialPolish(variant, "run-a"));
    }
  });

  it("still needs work, and still scores a finished surface as Perfect", () => {
    const cells = initialPolish("patches", "run-b");
    expect(polishCoverage(cells)).toBeLessThan(polisherTuning.releaseFinishCoverage);
    cells.fill(1);
    expect(calculatePolisherQuality({ cells, durationMs: 4000 })).toBe(100);
  });
});

describe("paint booth nozzles", () => {
  const size = paintBoothTuning.cols * paintBoothTuning.rows;
  /** A steady back-and-forth at `speed` with rows `rowGap` apart, 16 ms per frame. */
  function sweep(nozzle: PaintNozzle, speed: number, rowGap: number) {
    const cells = new Float32Array(size);
    const { x, y, w, h } = PRODUCT_RECT;
    const step = (speed * 16) / 1000;
    let row = 0;
    for (let py = y + 8; py <= y + h - 6; py += rowGap, row++) {
      for (let travelled = 0; travelled <= w - 12; travelled += step) {
        depositPaint(cells, { x: row % 2 ? x + w - 6 - travelled : x + 6 + travelled, y: py }, 16, nozzle);
      }
    }
    return calculatePaintBoothQuality({ cells, oversprayMs: 0 });
  }

  it("lets every nozzle reach Perfect with a sweep that suits it", () => {
    expect(sweep(paintNozzles.standard, 150, 22)).toBe(100);
    expect(sweep(paintNozzles.fine, 150, 14)).toBe(100);
    expect(sweep(paintNozzles.wide, 150, 38)).toBe(100);
  });

  it("makes the nozzles behave differently", () => {
    // The fine nozzle leaves gaps at the standard spacing; the wide one pools at it.
    expect(sweep(paintNozzles.fine, 150, 30)).toBeLessThan(90);
    expect(sweep(paintNozzles.wide, 110, 16)).toBeLessThan(90);
  });
});

describe("sorter variants", () => {
  it("adds a third bin and a sixth piece", () => {
    expect(sortPlan("two").bins.map((b) => b.id)).toEqual(["round", "square"]);
    const three = sortPlan("three");
    expect(three.bins.map((b) => b.id)).toEqual(["round", "hex", "square"]);
    expect(three.count).toBe(sorterTuning.itemCount + 1);
  });

  it("sends at least one piece to every bin", () => {
    const { bins, count } = sortPlan("three");
    const ids = bins.map((b) => b.id);
    for (let i = 0; i < 200; i++) {
      const queue = createSortQueue(`run-${i}`, count, ids);
      expect(queue).toHaveLength(count);
      expect(new Set(queue).size).toBe(3);
    }
  });
});

describe("assembler tray shuffle", () => {
  it("deals the same parts into the same tray spots, in a run-specific order", () => {
    for (let step = 0; step < 5; step++) {
      const base = stageForStep(step);
      const shuffled = stageForStep(step, "run-a");
      expect(shuffled.sockets).toEqual(base.sockets);
      expect(shuffled.parts.map((p) => p.id)).toEqual(base.parts.map((p) => p.id));
      const spots = (st: typeof base) => st.parts.map((p) => `${p.tray.x},${p.tray.y}`).sort();
      expect(spots(shuffled)).toEqual(spots(base));
      expect(stageForStep(step, "run-a")).toEqual(shuffled);
    }
    const orders = new Set(
      Array.from({ length: 30 }, (_, i) => stageForStep(0, `run-${i}`).parts.map((p) => p.tray.x).join(",")),
    );
    expect(orders.size).toBeGreaterThan(3);
  });
});
