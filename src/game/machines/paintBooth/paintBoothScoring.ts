import { clamp, type Point } from "@/lib/math";
import { PRODUCT_RECT } from "../shared";

export const paintBoothTuning = {
  /** Grid resolution used to track how thick the paint is on each patch of the tile. */
  cols: 20,
  rows: 13,
  /** Spray radius, in stage units. */
  nozzleRadius: 28,
  /** Thickness laid down per millisecond directly under the nozzle. */
  flowPerMs: 0.0035,
  /** A cell counts as painted from this thickness upwards. */
  coveredThreshold: 0.45,
  /** Above this the paint has pooled: the spray lingered too long. */
  thickThreshold: 2.2,
  maxThickness: 3,
  /** Coverage that counts as a completely painted tile. */
  fullCoverage: 0.97,
  /** Painting finishes by itself at this coverage… */
  autoFinishCoverage: 0.985,
  /** …or when the nozzle is lifted at or above this coverage. */
  releaseFinishCoverage: 0.9,
  /** A few pooled cells are forgiven. */
  thickDeadZone: 0.03,
  /** Share of pooled cells at which the uniformity score reaches zero. */
  thickLimit: 0.45,
  /** How far past the tile edge the nozzle may stray before it counts as overspray, in stage units. */
  oversprayMargin: 6,
  /** Time spent spraying off the tile: forgiven up to the dead zone, zero score at the limit. */
  oversprayDeadZoneMs: 400,
  oversprayLimitMs: 2500,
  coverageWeight: 0.55,
  uniformityWeight: 0.3,
  oversprayWeight: 0.15,
} as const;

export const PAINT_CELL = {
  w: PRODUCT_RECT.w / paintBoothTuning.cols,
  h: PRODUCT_RECT.h / paintBoothTuning.rows,
} as const;

/** Stage position of the middle of a grid cell. */
export function paintCellCenter(index: number): Point {
  const { cols } = paintBoothTuning;
  return {
    x: PRODUCT_RECT.x + ((index % cols) + 0.5) * PAINT_CELL.w,
    y: PRODUCT_RECT.y + (Math.floor(index / cols) + 0.5) * PAINT_CELL.h,
  };
}

/**
 * Sprays for `dtMs` with the nozzle at `at`, thickening every cell in reach.
 * Paint flows for as long as the nozzle is held, moving or not, which is what
 * makes lingering pool. Returns true when the nozzle was off the tile.
 */
export function depositPaint(cells: Float32Array | number[], at: Point, dtMs: number): boolean {
  const t = paintBoothTuning;
  const { x, y, w, h } = PRODUCT_RECT;
  const reach = t.nozzleRadius;

  const minCol = Math.max(0, Math.floor((at.x - reach - x) / PAINT_CELL.w));
  const maxCol = Math.min(t.cols - 1, Math.floor((at.x + reach - x) / PAINT_CELL.w));
  const minRow = Math.max(0, Math.floor((at.y - reach - y) / PAINT_CELL.h));
  const maxRow = Math.min(t.rows - 1, Math.floor((at.y + reach - y) / PAINT_CELL.h));

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const index = row * t.cols + col;
      const center = paintCellCenter(index);
      const d = Math.hypot(center.x - at.x, center.y - at.y);
      if (d > reach) continue;
      const falloff = 1 - (d / reach) ** 2;
      cells[index] = Math.min(t.maxThickness, cells[index] + falloff * t.flowPerMs * dtMs);
    }
  }

  const m = t.oversprayMargin;
  return at.x < x - m || at.x > x + w + m || at.y < y - m || at.y > y + h + m;
}

export function paintCoverage(cells: ArrayLike<number>): number {
  if (cells.length === 0) return 0;
  let covered = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] >= paintBoothTuning.coveredThreshold) covered++;
  }
  return covered / cells.length;
}

/** Share of the painted cells where the paint has pooled. */
export function pooledShare(cells: ArrayLike<number>): number {
  let covered = 0;
  let pooled = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] >= paintBoothTuning.coveredThreshold) covered++;
    if (cells[i] > paintBoothTuning.thickThreshold) pooled++;
  }
  return covered === 0 ? 0 : pooled / covered;
}

export interface PaintBoothInput {
  /** Paint thickness per grid cell. */
  cells: ArrayLike<number>;
  /** Total time the nozzle sprayed while off the tile. */
  oversprayMs: number;
}

export function calculatePaintBoothQuality({ cells, oversprayMs }: PaintBoothInput): number {
  if (cells.length === 0) return 0;
  const t = paintBoothTuning;

  const coverageScore = clamp(paintCoverage(cells) / t.fullCoverage, 0, 1);
  const uniformityScore = 1 - clamp((pooledShare(cells) - t.thickDeadZone) / (t.thickLimit - t.thickDeadZone), 0, 1);
  const oversprayScore =
    1 - clamp((oversprayMs - t.oversprayDeadZoneMs) / (t.oversprayLimitMs - t.oversprayDeadZoneMs), 0, 1);

  return Math.round(
    clamp(
      100 *
        (coverageScore * t.coverageWeight +
          // An unpainted tile is not "even": uniformity only counts for what was painted.
          uniformityScore * coverageScore * t.uniformityWeight +
          oversprayScore * t.oversprayWeight),
      0,
      100,
    ),
  );
}
