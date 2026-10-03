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

export type SortShapeId = "round" | "square";

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
 * One bin per shape, left to right. Shape is the cue: the gems share a colour,
 * so sorting never depends on telling colours apart.
 */
export const sortShapes: SortShape[] = [
  {
    id: "round",
    label: "Round",
    path: "M 0 -20 A 20 20 0 1 1 0 20 A 20 20 0 1 1 0 -20 Z",
    facets: "M 0 -11 L 9.5 -5.5 L 9.5 5.5 L 0 11 L -9.5 5.5 L -9.5 -5.5 Z M 0 -11 L 0 -20 M 9.5 5.5 L 17.3 10 M -9.5 5.5 L -17.3 10",
  },
  {
    id: "square",
    label: "Square",
    path: "M -15 -19 L 15 -19 L 19 -15 L 19 15 L 15 19 L -15 19 L -19 15 L -19 -15 Z",
    facets: "M -9 -9 L 9 -9 L 9 9 L -9 9 Z M -9 -9 L -17 -17 M 9 -9 L 17 -17 M 9 9 L 17 17 M -9 9 L -17 17",
  },
];

/** The order gems arrive in: stable for a run, mixed, and never one shape only. */
export function createSortQueue(runId: string, count: number = sorterTuning.itemCount): SortShapeId[] {
  const random = seededRandom(hashString(`sort:${runId}`));
  const ids = sortShapes.map((shape) => shape.id);
  const other = (id: SortShapeId) => ids.find((candidate) => candidate !== id) ?? id;
  const queue: SortShapeId[] = [];

  for (let i = 0; i < count; i++) {
    let next = ids[Math.floor(random() * ids.length)];
    const run = queue.slice(-sorterTuning.maxRun);
    if (run.length === sorterTuning.maxRun && run.every((id) => id === next)) next = other(next);
    queue.push(next);
  }

  // Short queues can still come out all one shape; make sure there is something to sort.
  if (count > 1 && queue.every((id) => id === queue[0])) queue[count - 1] = other(queue[0]);
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
