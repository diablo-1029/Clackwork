import { clamp, hashString, seededRandom } from "@/lib/math";

export const sorterTuning = {
  /** Gems to sort per product. */
  itemCount: 5,
  /** The same shape never arrives more than this many times in a row. */
  maxRun: 3,
  /** Average answers up to this are full marks for speed… */
  relaxedMs: 1500,
  /** …and from this average the speed share is gone. Being slow is never a failure. */
  slowMs: 4000,
  accuracyWeight: 0.8,
  speedWeight: 0.2,
} as const;

export type SortShapeId = "round" | "hex" | "square";

export interface SortShape {
  id: SortShapeId;
  /** Shown on the bin and read out to assistive tech. */
  label: string;
  /** Outline centred on 0,0, about 40 units across. */
  path: string;
  /** Inner facet lines, drawn over the fill. */
  facets: string;
}

/**
 * Shape is the cue: the pieces share a colour, so sorting never depends on
 * telling colours apart.
 */
const allSortShapes: SortShape[] = [
  {
    id: "round",
    label: "Round",
    path: "M 0 -20 A 20 20 0 1 1 0 20 A 20 20 0 1 1 0 -20 Z",
    facets: "M 0 -11 L 9.5 -5.5 L 9.5 5.5 L 0 11 L -9.5 5.5 L -9.5 -5.5 Z M 0 -11 L 0 -20 M 9.5 5.5 L 17.3 10 M -9.5 5.5 L -17.3 10",
  },
  {
    id: "hex",
    label: "Hex",
    path: "M 0 -21 L 18.2 -10.5 L 18.2 10.5 L 0 21 L -18.2 10.5 L -18.2 -10.5 Z",
    facets: "M -9 -9 L 9 -9 L 14 0 L 9 9 L -9 9 L -14 0 Z M -9 -9 L 0 -21 L 9 -9 M -9 9 L 0 21 L 9 9",
  },
  {
    id: "square",
    label: "Square",
    path: "M -15 -19 L 15 -19 L 19 -15 L 19 15 L 15 19 L -15 19 L -19 15 L -19 -15 Z",
    facets: "M -9 -9 L 9 -9 L 9 9 L -9 9 Z M -9 -9 L -17 -17 M 9 -9 L 17 -17 M 9 9 L 17 17 M -9 9 L -17 17",
  },
];

const shapeById = (id: SortShapeId) => allSortShapes.find((shape) => shape.id === id)!;

/** The usual two bins, left to right. */
export const sortShapes: SortShape[] = [shapeById("round"), shapeById("square")];

/** The bins a Sorter variant uses, left to right, and how many pieces arrive. */
export function sortPlan(variant: string): { bins: SortShape[]; count: number } {
  if (variant === "three") {
    return { bins: [shapeById("round"), shapeById("hex"), shapeById("square")], count: sorterTuning.itemCount + 1 };
  }
  return { bins: sortShapes, count: sorterTuning.itemCount };
}

/** The order pieces arrive in: stable for a run, mixed, and with every bin's shape appearing. */
export function createSortQueue(
  runId: string,
  count: number = sorterTuning.itemCount,
  ids: SortShapeId[] = sortShapes.map((shape) => shape.id),
): SortShapeId[] {
  const random = seededRandom(hashString(`sort:${runId}`));
  const other = (id: SortShapeId) => ids[(ids.indexOf(id) + 1) % ids.length];
  const queue: SortShapeId[] = [];

  for (let i = 0; i < count; i++) {
    let next = ids[Math.floor(random() * ids.length)];
    const run = queue.slice(-sorterTuning.maxRun);
    if (run.length === sorterTuning.maxRun && run.every((id) => id === next)) next = other(next);
    queue.push(next);
  }

  // Every bin should get at least one piece when there are enough to go round:
  // swap a missing shape in for one that appears more than once.
  if (count >= ids.length) {
    for (const missing of ids.filter((id) => !queue.includes(id))) {
      const spare = queue.findIndex((id, index) => queue.indexOf(id) !== index || queue.lastIndexOf(id) !== index);
      if (spare >= 0) queue[spare] = missing;
    }
  }
  return queue;
}

export interface SortPick {
  correct: boolean;
  /** Time from the gem reaching the gate to the bin being chosen. */
  reactionMs: number;
}

export function calculateSorterQuality(picks: SortPick[]): number {
  if (picks.length === 0) return 0;
  const t = sorterTuning;

  const accuracy = picks.filter((pick) => pick.correct).length / picks.length;
  const averageMs = picks.reduce((sum, pick) => sum + Math.max(0, pick.reactionMs), 0) / picks.length;
  const speed = 1 - clamp((averageMs - t.relaxedMs) / (t.slowMs - t.relaxedMs), 0, 1);

  return Math.round(clamp(100 * (accuracy * t.accuracyWeight + speed * t.speedWeight), 0, 100));
}
