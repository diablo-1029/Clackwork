import { clamp, measureTrace, type Point } from "@/lib/math";

/** All distances are in machine viewBox units (the stage is 400 × 300). */
export const packagerTuning = {
  deadZone: 5,
  maxDeviation: 34,
  fullCoverage: 0.95,
  /** A release below this coverage is treated as a slip and simply retried. */
  minCoverage: 0.2,
  endDeadZone: 6,
  maxEndDeviation: 32,
  /** The tape counts as reaching the far edge from this progress onwards. */
  endReached: 0.97,
  backtrackAllowance: 8,
  backtrackFactor: 0.2,
  maxBacktrackPenalty: 15,
  accuracyWeight: 0.55,
  coverageWeight: 0.3,
  endpointWeight: 0.15,
} as const;

export interface PackagerInput {
  points: Point[];
  from: Point;
  to: Point;
}

export function calculatePackagerQuality({ points, from, to }: PackagerInput): number {
  if (points.length < 2) return 0;
  const t = packagerTuning;
  const trace = measureTrace(points, from, to);

  const wobble = clamp((trace.averageDeviation - t.deadZone) / (t.maxDeviation - t.deadZone), 0, 1);
  const accuracyScore = 100 * (1 - wobble);
  const coverageScore = 100 * clamp(trace.coverage / t.fullCoverage, 0, 1);

  // The tape should land on the seam at the far edge, not just somewhere near it.
  const endOffset = clamp((trace.endDeviation - t.endDeadZone) / (t.maxEndDeviation - t.endDeadZone), 0, 1);
  const endpointScore = 100 * (1 - endOffset) * clamp(trace.endProgress / t.endReached, 0, 1);

  const backtrackPenalty = clamp(
    (trace.backtrack - t.backtrackAllowance) * t.backtrackFactor,
    0,
    t.maxBacktrackPenalty,
  );

  return Math.round(
    clamp(
      accuracyScore * t.accuracyWeight +
        coverageScore * t.coverageWeight +
        endpointScore * t.endpointWeight -
        backtrackPenalty,
      0,
      100,
    ),
  );
}

export function isTapeAttempt({ points, from, to }: PackagerInput): boolean {
  return measureTrace(points, from, to).coverage >= packagerTuning.minCoverage;
}

export interface TapeRun {
  from: Point;
  to: Point;
}

/** The box seam runs left to right across the middle of the stage. */
const TAPE_ACROSS: TapeRun = { from: { x: 68, y: 150 }, to: { x: 332, y: 150 } };
const TAPE_DOWN: TapeRun = { from: { x: 200, y: 52 }, to: { x: 200, y: 262 } };

/** The strips a Packager variant asks for, in the order they are laid. */
export function tapeRuns(variant: string): TapeRun[] {
  switch (variant) {
    case "down":
      return [TAPE_DOWN];
    case "cross":
      return [TAPE_ACROSS, TAPE_DOWN];
    default:
      return [TAPE_ACROSS];
  }
}
