import { hashString, type Point } from "@/lib/math";
import { PRODUCT_RECT } from "../shared";

export interface CutSegment {
  from: Point;
  to: Point;
}

export type CutPatternId =
  | "vertical"
  | "diagonalRight"
  | "diagonalLeft"
  | "horizontal"
  | "doubleVertical"
  | "doubleHorizontal"
  | "doubleDiagonal"
  | "tripleVertical";

export interface CutPattern {
  id: CutPatternId;
  /**
   * One guide per cut, made in order. Multi-cut patterns must be parallel and
   * ordered so each segment's normal (see `splitAlong`) points at the pieces
   * already cut off.
   */
  segments: CutSegment[];
  /** Factory Level from which this pattern can appear. */
  minLevel: number;
  /** Set on patterns worth announcing when they unlock. Patterns sharing a name are announced once. */
  name?: string;
}

const { x, y, w, h } = PRODUCT_RECT;
const cx = x + w / 2;
const cy = y + h / 2;
/** How far the guide overhangs the product on each side. */
const OVERHANG = 16;

const down = (atX: number, lean = 0): CutSegment => ({
  from: { x: atX - lean, y: y - OVERHANG },
  to: { x: atX + lean, y: y + h + OVERHANG },
});
const across = (atY: number): CutSegment => ({
  from: { x: x - OVERHANG, y: atY },
  to: { x: x + w + OVERHANG, y: atY },
});

/** Straight cuts only for now; curves are a post-MVP pattern. */
export const cutPatterns: CutPattern[] = [
  { id: "vertical", segments: [down(cx)], minLevel: 1 },
  { id: "diagonalRight", segments: [down(cx, 42)], minLevel: 1 },
  { id: "diagonalLeft", segments: [down(cx, -42)], minLevel: 1 },
  { id: "horizontal", segments: [across(cy)], minLevel: 1 },
  { id: "doubleVertical", segments: [down(cx - 34), down(cx + 34)], minLevel: 2, name: "Double cut" },
  { id: "doubleHorizontal", segments: [across(cy + 22), across(cy - 22)], minLevel: 2, name: "Double cut" },
  { id: "doubleDiagonal", segments: [down(cx - 32, 30), down(cx + 32, 30)], minLevel: 6, name: "Angled double cut" },
  { id: "tripleVertical", segments: [down(cx - 50), down(cx), down(cx + 50)], minLevel: 9, name: "Triple cut" },
];

export function getCutPattern(id: unknown): CutPattern | undefined {
  return cutPatterns.find((pattern) => pattern.id === id);
}

/** Stable per run (so a remount shows the same cut); always the simplest cut while learning. */
export function pickCutPattern(runId: string, onboarding: boolean, factoryLevel = 1): CutPattern {
  if (onboarding) return cutPatterns[0];
  const pool = cutPatterns.filter((pattern) => pattern.minLevel <= factoryLevel);
  return pool[hashString(runId) % pool.length] ?? cutPatterns[0];
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

/**
 * How far piece `index` (0 = first piece cut off) has slid along the cut normal
 * once `cutsDone` cuts are made, in units of one separation step. Pieces that
 * are not cut apart yet move together.
 */
export function pieceShift(index: number, cutsDone: number): number {
  return cutsDone - 2 * Math.min(index, cutsDone);
}
