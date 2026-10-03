import { clamp, distance, type Point } from "@/lib/math";
import { STAGE } from "../shared";

export const assemblerTuning = {
  /** How close to a loose part a press must land to pick it up, in stage units. Generous for touch. */
  grabRadius: 38,
  /** A part released within this distance of a socket snaps into it. */
  snapRadius: 26,
  /** Drops this close to the socket's center count as exact. */
  perfectRadius: 9,
  precisionWeight: 0.75,
  handlingWeight: 0.25,
  /** Share of the handling score lost per part dropped on the wrong socket. */
  wrongDropCost: 1 / 3,
} as const;

export type RobotPartKind = "head" | "arm" | "leg";

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

const cx = STAGE.w / 2;

/** The torso is already on the bench; every other part attaches around it. Stage units. */
export const ROBOT_TORSO: Point = { x: cx, y: 124 };

/** The space the finished robot occupies on the stage, used to fit it into boxes and icons. */
export const ROBOT_BOUNDS = { x: 130, y: 6, w: 140, h: 226 } as const;

/** Where each part belongs on the robot. */
export const robotSockets: RobotSocket[] = [
  { id: "head", kind: "head", at: { x: cx, y: 54 } },
  { id: "armLeft", kind: "arm", at: { x: cx - 53, y: 124 } },
  { id: "armRight", kind: "arm", at: { x: cx + 53, y: 124 } },
  { id: "legLeft", kind: "leg", at: { x: cx - 21, y: 197 } },
  { id: "legRight", kind: "leg", at: { x: cx + 21, y: 197 } },
];

/** The loose parts, split between a tray on each side. Arms are interchangeable, and so are legs. */
export const robotParts: RobotPart[] = [
  { id: "legA", kind: "leg", tray: { x: 56, y: 82 } },
  { id: "armA", kind: "arm", tray: { x: 56, y: 196 } },
  { id: "head", kind: "head", tray: { x: 344, y: 62 } },
  { id: "armB", kind: "arm", tray: { x: 344, y: 150 } },
  { id: "legB", kind: "leg", tray: { x: 344, y: 238 } },
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

  const free = robotSockets.filter((socket) => !filledSocketIds.includes(socket.id));
  const nearestOf = (sockets: RobotSocket[]) =>
    sockets.reduce<{ socket: RobotSocket; d: number } | null>((best, socket) => {
      const d = distance(socket.at, point);
      return !best || d < best.d ? { socket, d } : best;
    }, null);

  // A socket of the part's own kind wins if it is in reach, so a leg dropped
  // between the two leg sockets never counts as a mistake.
  const own = nearestOf(free.filter((socket) => socket.kind === part.kind));
  if (own && own.d <= assemblerTuning.snapRadius) return { kind: "placed", socketId: own.socket.id, offset: own.d };

  const other = nearestOf(free);
  if (other && other.d <= assemblerTuning.snapRadius) return { kind: "wrong", socketId: other.socket.id };
  return { kind: "miss" };
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
