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

/** The four body sections, each built in its own assembly step. */
export type RobotShellKind = "head" | "arm" | "leg" | "torso";

/** Everything that can be picked up: small fittings, and finished sections for the final build. */
export type RobotPieceKind =
  | "eye"
  | "mouth"
  | "aerial"
  | "shoulder"
  | "gripper"
  | "knee"
  | "foot"
  | "gauge"
  | "buttons"
  | "neck"
  | "belt"
  | "head"
  | "arm"
  | "leg";

export interface RobotFeature {
  kind: RobotPieceKind;
  /** Position relative to the middle of the section it belongs to, at scale 1. */
  at: Point;
}

/**
 * Where each fitting sits on its section. This is the single source of truth:
 * the sockets of the assembly steps and the drawing of a finished section both use it.
 */
export const robotFeatures: Record<RobotShellKind, RobotFeature[]> = {
  head: [
    { kind: "eye", at: { x: -12, y: -5 } },
    { kind: "eye", at: { x: 12, y: -5 } },
    { kind: "mouth", at: { x: 0, y: 15.5 } },
    { kind: "aerial", at: { x: 0, y: -34 } },
  ],
  arm: [
    { kind: "shoulder", at: { x: 0, y: -27 } },
    { kind: "gripper", at: { x: 0, y: 29 } },
  ],
  leg: [
    { kind: "knee", at: { x: 0, y: -6 } },
    { kind: "foot", at: { x: 0, y: 21 } },
  ],
  torso: [
    { kind: "gauge", at: { x: -13, y: -7 } },
    { kind: "buttons", at: { x: 14, y: -4 } },
    { kind: "neck", at: { x: 0, y: -42 } },
    { kind: "belt", at: { x: 0, y: 39 } },
  ],
};

/** Pieces that tuck behind the section they attach to rather than sitting on top of it. */
const BEHIND: ReadonlySet<RobotPieceKind> = new Set(["aerial", "shoulder", "neck", "belt", "arm", "leg"]);
export const sitsBehind = (kind: RobotPieceKind) => BEHIND.has(kind);

export interface RobotSocket {
  id: string;
  kind: RobotPieceKind;
  at: Point;
}

export interface RobotPart {
  id: string;
  kind: RobotPieceKind;
  /** Where the part waits before it is picked up. */
  tray: Point;
}

export type AssemblyStageId = "head" | "arms" | "legs" | "torso" | "final";

export interface AssemblyStage {
  id: AssemblyStageId;
  /** Short name for the progress strip. */
  label: string;
  instruction: string;
  /** How much larger than the finished robot this step is drawn. */
  scale: number;
  /** The sections already on the bench. `complete` ones are drawn with all their fittings. */
  shells: { kind: RobotShellKind; at: Point; complete?: boolean }[];
  sockets: RobotSocket[];
  parts: RobotPart[];
}

/** A step that fits the small parts onto one kind of section, drawn enlarged. */
function fittingStage(
  stage: Pick<AssemblyStage, "id" | "label" | "instruction" | "scale">,
  shell: RobotShellKind,
  shellPositions: Point[],
  tray: { kind: RobotPieceKind; x: number }[],
  trayY: number,
): AssemblyStage {
  const sockets = shellPositions.flatMap((at, shellIndex) =>
    robotFeatures[shell].map((feature, featureIndex) => ({
      id: `${shell}${shellIndex}-${feature.kind}${featureIndex}`,
      kind: feature.kind,
      at: { x: at.x + feature.at.x * stage.scale, y: at.y + feature.at.y * stage.scale },
    })),
  );
  return {
    ...stage,
    shells: shellPositions.map((at) => ({ kind: shell, at })),
    sockets,
    parts: tray.map((spot, index) => ({ id: `${spot.kind}${index}`, kind: spot.kind, tray: { x: spot.x, y: trayY } })),
  };
}

const cx = STAGE.w / 2;

/** The torso stands on the bench for the final build; every other section attaches around it. */
export const ROBOT_TORSO: Point = { x: cx, y: 124 };

/** The space the finished robot occupies on the stage, used to fit it into boxes and icons. */
export const ROBOT_BOUNDS = { x: 130, y: 6, w: 140, h: 226 } as const;

/** Where each finished section goes in the final build. */
export const finalSockets: RobotSocket[] = [
  { id: "head", kind: "head", at: { x: cx, y: 54 } },
  { id: "armLeft", kind: "arm", at: { x: cx - 53, y: 124 } },
  { id: "armRight", kind: "arm", at: { x: cx + 53, y: 124 } },
  { id: "legLeft", kind: "leg", at: { x: cx - 21, y: 197 } },
  { id: "legRight", kind: "leg", at: { x: cx + 21, y: 197 } },
];

/**
 * The Toy Robot is built in five Assembler steps: each section gets its fittings,
 * then the finished sections are put together. Matching parts are interchangeable
 * (either eye in either eye socket, either arm on either side).
 */
export const robotStages: AssemblyStage[] = [
  fittingStage(
    { id: "head", label: "Head", instruction: "Fit the eyes, mouth and aerial.", scale: 2.4 },
    "head",
    [{ x: cx, y: 126 }],
    [
      { kind: "mouth", x: 70 },
      { kind: "eye", x: 150 },
      { kind: "aerial", x: 235 },
      { kind: "eye", x: 320 },
    ],
    262,
  ),
  fittingStage(
    { id: "arms", label: "Arms", instruction: "Fit a shoulder and a gripper to each arm.", scale: 2.2 },
    "arm",
    [
      { x: cx - 55, y: 128 },
      { x: cx + 55, y: 128 },
    ],
    [
      { kind: "gripper", x: 70 },
      { kind: "shoulder", x: 150 },
      { kind: "gripper", x: 250 },
      { kind: "shoulder", x: 330 },
    ],
    262,
  ),
  fittingStage(
    { id: "legs", label: "Legs", instruction: "Fit a knee guard and a foot to each leg.", scale: 2.2 },
    "leg",
    [
      { x: cx - 55, y: 118 },
      { x: cx + 55, y: 118 },
    ],
    [
      { kind: "foot", x: 75 },
      { kind: "knee", x: 165 },
      { kind: "foot", x: 250 },
      { kind: "knee", x: 335 },
    ],
    258,
  ),
  fittingStage(
    { id: "torso", label: "Torso", instruction: "Fit the gauge, buttons, neck and belt.", scale: 2 },
    "torso",
    [{ x: cx, y: 132 }],
    [
      { kind: "gauge", x: 50 },
      { kind: "buttons", x: 112 },
      { kind: "neck", x: 176 },
      { kind: "belt", x: 300 },
    ],
    268,
  ),
  {
    id: "final",
    label: "Build",
    instruction: "Attach the head, arms and legs.",
    scale: 1,
    shells: [{ kind: "torso", at: ROBOT_TORSO, complete: true }],
    sockets: finalSockets,
    parts: [
      { id: "legA", kind: "leg", tray: { x: 56, y: 82 } },
      { id: "armA", kind: "arm", tray: { x: 56, y: 196 } },
      { id: "head", kind: "head", tray: { x: 344, y: 62 } },
      { id: "armB", kind: "arm", tray: { x: 344, y: 150 } },
      { id: "legB", kind: "leg", tray: { x: 344, y: 238 } },
    ],
  },
];

/** The Assembler step for the nth time the machine appears in a product's chain. */
export function stageForStep(step: number): AssemblyStage {
  return robotStages[clamp(Math.floor(step), 0, robotStages.length - 1)];
}

export type DropOutcome =
  | { kind: "placed"; socketId: string; offset: number }
  /** Released on a free socket that takes a different kind of part. */
  | { kind: "wrong"; socketId: string }
  /** Released nowhere near a free socket. */
  | { kind: "miss" };

/** Decides what happens when `partId` is let go at `point`. Pure. */
export function resolveDrop(
  stage: AssemblyStage,
  partId: string,
  point: Point,
  filledSocketIds: readonly string[],
): DropOutcome {
  const part = stage.parts.find((p) => p.id === partId);
  if (!part) return { kind: "miss" };

  const free = stage.sockets.filter((socket) => !filledSocketIds.includes(socket.id));
  const nearestOf = (sockets: RobotSocket[]) =>
    sockets.reduce<{ socket: RobotSocket; d: number } | null>((best, socket) => {
      const d = distance(socket.at, point);
      return !best || d < best.d ? { socket, d } : best;
    }, null);

  // A socket of the part's own kind wins if it is in reach, so a part dropped
  // between two sockets, one of them its own, never counts as a mistake.
  const own = nearestOf(free.filter((socket) => socket.kind === part.kind));
  if (own && own.d <= assemblerTuning.snapRadius) return { kind: "placed", socketId: own.socket.id, offset: own.d };

  const other = nearestOf(free);
  if (other && other.d <= assemblerTuning.snapRadius) return { kind: "wrong", socketId: other.socket.id };
  return { kind: "miss" };
}

/** The loose part a press at `point` would pick up, if any. */
export function partAt(stage: AssemblyStage, point: Point, placedPartIds: readonly string[]): RobotPart | null {
  let nearest: RobotPart | null = null;
  let nearestDistance: number = assemblerTuning.grabRadius;
  for (const part of stage.parts) {
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

export function calculateAssemblerQuality(stage: AssemblyStage, { offsets, wrongDrops }: AssemblerInput): number {
  const t = assemblerTuning;
  const total = stage.parts.length;
  if (total === 0) return 0;

  // Parts never placed contribute nothing, so an unfinished step cannot score well.
  const precision =
    offsets
      .slice(0, total)
      .reduce((sum, offset) => sum + (1 - clamp((offset - t.perfectRadius) / (t.snapRadius - t.perfectRadius), 0, 1)), 0) /
    total;
  const handling = 1 - clamp(Math.max(0, wrongDrops) * t.wrongDropCost, 0, 1);

  return Math.round(clamp(100 * (precision * t.precisionWeight + handling * t.handlingWeight), 0, 100));
}
