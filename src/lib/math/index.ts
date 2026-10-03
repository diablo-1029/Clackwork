export interface Point {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Small deterministic hash so a run id can pick stable "random" variations. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TraceMetrics {
  /** Mean perpendicular distance from the guide line, in input units. */
  averageDeviation: number;
  /** 0–1 share of the guide segment the trace spanned. */
  coverage: number;
  /** Total distance travelled backwards along the guide, in input units. */
  backtrack: number;
  /** Perpendicular distance of the final point from the guide line. */
  endDeviation: number;
  /** 0–1 position of the final point along the guide. */
  endProgress: number;
}

/**
 * Measures how well a freehand trace follows the straight guide from `a` to `b`.
 * Shared by every "drag along a line" machine; pure and deterministic.
 */
export function measureTrace(points: Point[], a: Point, b: Point): TraceMetrics {
  const length = distance(a, b);
  if (points.length === 0 || length === 0) {
    return { averageDeviation: 0, coverage: 0, backtrack: 0, endDeviation: 0, endProgress: 0 };
  }

  const dx = (b.x - a.x) / length;
  const dy = (b.y - a.y) / length;

  let deviationSum = 0;
  let minT = Infinity;
  let maxT = -Infinity;
  let backtrack = 0;
  let previousAlong = 0;
  let endDeviation = 0;
  let endProgress = 0;

  points.forEach((p, i) => {
    const rx = p.x - a.x;
    const ry = p.y - a.y;
    const along = rx * dx + ry * dy;
    const perpendicular = Math.abs(rx * -dy + ry * dx);
    const t = clamp(along / length, 0, 1);

    deviationSum += perpendicular;
    minT = Math.min(minT, t);
    maxT = Math.max(maxT, t);
    if (i > 0 && along < previousAlong) backtrack += previousAlong - along;
    previousAlong = along;
    endDeviation = perpendicular;
    endProgress = t;
  });

  return {
    averageDeviation: deviationSum / points.length,
    coverage: clamp(maxT - minT, 0, 1),
    backtrack,
    endDeviation,
    endProgress,
  };
}
