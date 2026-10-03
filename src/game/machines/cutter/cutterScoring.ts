import { clamp, measureTrace, type Point } from "@/lib/math";

/** All distances are in machine viewBox units (the stage is 400 × 300). */
export const cutterTuning = {
  /** Average wobble below this still counts as a flawless cut. */
  deadZone: 5,
  /** Average wobble at or beyond this scores zero accuracy. */
  maxDeviation: 38,
  /** Share of the guide that counts as a complete cut. */
  fullCoverage: 0.95,
  /** A release below this coverage is treated as a slip and simply retried. */
  minCoverage: 0.2,
  backtrackAllowance: 6,
  backtrackFactor: 0.25,
  maxBacktrackPenalty: 20,
  accuracyWeight: 0.7,
  coverageWeight: 0.3,
} as const;

export interface CutterInput {
  points: Point[];
  from: Point;
  to: Point;
}

export function calculateCutterQuality({ points, from, to }: CutterInput): number {
  if (points.length < 2) return 0;
  const t = cutterTuning;
  const trace = measureTrace(points, from, to);

  const wobble = clamp((trace.averageDeviation - t.deadZone) / (t.maxDeviation - t.deadZone), 0, 1);
  const accuracyScore = 100 * (1 - wobble);
  const coverageScore = 100 * clamp(trace.coverage / t.fullCoverage, 0, 1);
  const backtrackPenalty = clamp(
    (trace.backtrack - t.backtrackAllowance) * t.backtrackFactor,
    0,
    t.maxBacktrackPenalty,
  );

  return Math.round(
    clamp(accuracyScore * t.accuracyWeight + coverageScore * t.coverageWeight - backtrackPenalty, 0, 100),
  );
}

/** Whether a released drag covered enough of the guide to count as an attempt. */
export function isCutAttempt({ points, from, to }: CutterInput): boolean {
  return measureTrace(points, from, to).coverage >= cutterTuning.minCoverage;
}
