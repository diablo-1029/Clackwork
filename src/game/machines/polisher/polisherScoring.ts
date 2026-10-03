import { clamp, hashString, seededRandom } from "@/lib/math";

export const polisherTuning = {
  /** Grid resolution used to track how polished each patch of the surface is. */
  cols: 20,
  rows: 13,
  /** A cell counts as polished from this value (0–1) upwards. */
  polishedThreshold: 0.6,
  /** Coverage that counts as a completely polished surface. */
  fullCoverage: 0.98,
  /** Polishing finishes by itself at this coverage… */
  autoFinishCoverage: 0.99,
  /** …or when the pad is lifted at or above this coverage. */
  releaseFinishCoverage: 0.93,
  /** Unevenness below this spread is not penalised. */
  evennessDeadZone: 0.14,
  evennessRange: 0.36,
  /** Time only matters a little: full marks up to here, none from `slowMs`. */
  relaxedMs: 15_000,
  slowMs: 40_000,
  coverageWeight: 0.7,
  evennessWeight: 0.25,
  timeWeight: 0.05,
} as const;

export function polishCoverage(cells: ArrayLike<number>): number {
  if (cells.length === 0) return 0;
  let polished = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] >= polisherTuning.polishedThreshold) polished++;
  }
  return polished / cells.length;
}

export interface PolisherInput {
  /** Polish amount per grid cell, each 0–1. */
  cells: ArrayLike<number>;
  durationMs: number;
}

export function calculatePolisherQuality({ cells, durationMs }: PolisherInput): number {
  if (cells.length === 0) return 0;
  const t = polisherTuning;

  const coverageScore = clamp(polishCoverage(cells) / t.fullCoverage, 0, 1);

  let sum = 0;
  for (let i = 0; i < cells.length; i++) sum += clamp(cells[i], 0, 1);
  const mean = sum / cells.length;
  let variance = 0;
  for (let i = 0; i < cells.length; i++) variance += (clamp(cells[i], 0, 1) - mean) ** 2;
  const spread = Math.sqrt(variance / cells.length);
  const evennessScore = 1 - clamp((spread - t.evennessDeadZone) / t.evennessRange, 0, 1);

  const timeScore = 1 - clamp((durationMs - t.relaxedMs) / (t.slowMs - t.relaxedMs), 0, 1);

  return Math.round(
    clamp(
      100 * (coverageScore * t.coverageWeight + evennessScore * t.evennessWeight + timeScore * t.timeWeight),
      0,
      100,
    ),
  );
}

/**
 * The surface as it arrives: 0 where it is dull, 1 where it is already clean.
 * "patches" leaves a few blotches to find; "edges" a dull border around a clean middle.
 */
export function initialPolish(variant: string, runId: string): Float32Array {
  const { cols, rows } = polisherTuning;
  const cells = new Float32Array(cols * rows);
  if (variant === "patches") {
    cells.fill(1);
    const random = seededRandom(hashString(`polish:${runId}`));
    for (let blob = 0; blob < 4; blob++) {
      const cx = 2 + random() * (cols - 4);
      const cy = 2 + random() * (rows - 4);
      const radius = 2.6 + random() * 1.2;
      for (let i = 0; i < cells.length; i++) {
        if (Math.hypot((i % cols) - cx, Math.floor(i / cols) - cy) <= radius) cells[i] = 0;
      }
    }
  } else if (variant === "edges") {
    const border = 3;
    for (let i = 0; i < cells.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const inside = col >= border && col < cols - border && row >= border && row < rows - border;
      cells[i] = inside ? 1 : 0;
    }
  }
  return cells;
}
