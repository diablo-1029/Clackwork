import { hashString, type Point } from "@/lib/math";
import { PRODUCT_RECT } from "../shared";

export interface CutPattern {
  id: "vertical" | "diagonalRight" | "diagonalLeft" | "horizontal";
  from: Point;
  to: Point;
}

const { x, y, w, h } = PRODUCT_RECT;
const cx = x + w / 2;
const cy = y + h / 2;
/** How far the guide overhangs the product on each side. */
const OVERHANG = 16;

/** Straight cuts only for now; curves are a post-MVP pattern. */
export const cutPatterns: CutPattern[] = [
  { id: "vertical", from: { x: cx, y: y - OVERHANG }, to: { x: cx, y: y + h + OVERHANG } },
  { id: "diagonalRight", from: { x: cx - 42, y: y - OVERHANG }, to: { x: cx + 42, y: y + h + OVERHANG } },
  { id: "diagonalLeft", from: { x: cx + 42, y: y - OVERHANG }, to: { x: cx - 42, y: y + h + OVERHANG } },
  { id: "horizontal", from: { x: x - OVERHANG, y: cy }, to: { x: x + w + OVERHANG, y: cy } },
];

/** Stable per run (so a remount shows the same cut); always the simplest cut while learning. */
export function pickCutPattern(runId: string, onboarding: boolean): CutPattern {
  if (onboarding) return cutPatterns[0];
  return cutPatterns[hashString(runId) % cutPatterns.length];
}

export interface CutHalves {
  /** SVG polygon point lists covering each side of the cut line. */
  sideA: string;
  sideB: string;
  /** Unit normal pointing into side A; the halves separate along ±normal. */
  normal: Point;
}

/** Two huge quads, one per side of the cut, used as clip paths for the product halves. */
export function splitAlong(from: Point, to: Point): CutHalves {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const d = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  const normal = { x: -d.y, y: d.x };
  const far = 1000;

  const a = { x: from.x - d.x * far, y: from.y - d.y * far };
  const b = { x: to.x + d.x * far, y: to.y + d.y * far };
  const quad = (sign: 1 | -1) =>
    [
      a,
      b,
      { x: b.x + normal.x * far * sign, y: b.y + normal.y * far * sign },
      { x: a.x + normal.x * far * sign, y: a.y + normal.y * far * sign },
    ]
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");

  return { sideA: quad(1), sideB: quad(-1), normal };
}
