import { clamp, distance, type Point } from "@/lib/math";
import { PRODUCT_RECT } from "../shared";

export const assemblerTuning = {
  /** How close to a loose part a press must land to pick it up, in stage units. Generous for touch. */
  grabRadius: 34,
  /** A part released within this distance of a socket snaps into it. */
  snapRadius: 26,
  /** Drops this close to the socket's center count as exact. */
  perfectRadius: 9,
  precisionWeight: 0.75,
  handlingWeight: 0.25,
  /** Share of the handling score lost per part dropped on the wrong socket. */
  wrongDropCost: 1 / 3,
} as const;

export type RobotPartKind = "eye" | "mouth" | "antenna";

export interface RobotSocket {
  id: string;
  kind: RobotPartKind;
  at: Point;
}

export interface RobotPart {
  id: string;
  kind: RobotPartKind;
  /** Where the part waits before it is picked up. */
  tray: Point;
}

const { x, y, w, h } = PRODUCT_RECT;
const cx = x + w / 2;
const TRAY_Y = y + h + 46;

/** Where each part belongs on the robot head, in stage units. */
export const robotSockets: RobotSocket[] = [
  { id: "eyeLeft", kind: "eye", at: { x: cx - 42, y: y + 44 } },
  { id: "eyeRight", kind: "eye", at: { x: cx + 42, y: y + 44 } },
  { id: "mouth", kind: "mouth", at: { x: cx, y: y + 96 } },
  { id: "antenna", kind: "antenna", at: { x: cx, y: y - 14 } },
];

/** The loose parts, mixed up along the tray. The two eyes are interchangeable. */
export const robotParts: RobotPart[] = [
  { id: "mouth", kind: "mouth", tray: { x: cx - 112, y: TRAY_Y } },
  { id: "eyeA", kind: "eye", tray: { x: cx - 38, y: TRAY_Y } },
  { id: "antenna", kind: "antenna", tray: { x: cx + 30, y: TRAY_Y - 4 } },
  { id: "eyeB", kind: "eye", tray: { x: cx + 100, y: TRAY_Y } },
];

export type DropOutcome =
  | { kind: "placed"; socketId: string; offset: number }
  /** Released on a free socket that takes a different kind of part. */
  | { kind: "wrong"; socketId: string }
  /** Released nowhere near a free socket. */
  | { kind: "miss" };

/** Decides what happens when `partId` is let go at `point`. Pure. */
export function resolveDrop(partId: string, point: Point, filledSocketIds: readonly string[]): DropOutcome {
  const part = robotParts.find((p) => p.id === partId);
  if (!part) return { kind: "miss" };

  let nearest: RobotSocket | null = null;
  let nearestDistance = Infinity;
  for (const socket of robotSockets) {
    if (filledSocketIds.includes(socket.id)) continue;
    const d = distance(socket.at, point);
    if (d < nearestDistance) {
      nearest = socket;
      nearestDistance = d;
    }
  }

  if (!nearest || nearestDistance > assemblerTuning.snapRadius) return { kind: "miss" };
  if (nearest.kind !== part.kind) return { kind: "wrong", socketId: nearest.id };
  return { kind: "placed", socketId: nearest.id, offset: nearestDistance };
}

/** The loose part a press at `point` would pick up, if any. */
export function partAt(point: Point, placedPartIds: readonly string[]): RobotPart | null {
  let nearest: RobotPart | null = null;
  let nearestDistance: number = assemblerTuning.grabRadius;
  for (const part of robotParts) {
    if (placedPartIds.includes(part.id)) continue;
    const d = distance(part.tray, point);
    if (d <= nearestDistance) {
      nearest = part;
      nearestDistance = d;
    }
  }
  return nearest;
}

export interface AssemblerInput {
  /** Distance from the socket's center for each part that was placed. */
  offsets: number[];
  wrongDrops: number;
}

export function calculateAssemblerQuality({ offsets, wrongDrops }: AssemblerInput): number {
  const t = assemblerTuning;
  const total = robotParts.length;

  // Parts never placed contribute nothing, so an unfinished robot cannot score well.
  const precision =
    offsets
      .slice(0, total)
      .reduce((sum, offset) => sum + (1 - clamp((offset - t.perfectRadius) / (t.snapRadius - t.perfectRadius), 0, 1)), 0) /
    total;
  const handling = 1 - clamp(Math.max(0, wrongDrops) * t.wrongDropCost, 0, 1);

  return Math.round(clamp(100 * (precision * t.precisionWeight + handling * t.handlingWeight), 0, 100));
}
