/** One finished shift, as kept in the player's own top list. */
export interface ShiftRecord {
  score: number;
  products: number;
  /** When it was played, as an ISO timestamp. */
  at: string;
}

export const LOCAL_BOARD_SIZE = 10;
export const NAME_MAX_LENGTH = 16;

/** Adds a shift to the player's own list: best first, the top ten only, nothing for a zero score. */
export function addShiftRecord(list: ShiftRecord[], record: ShiftRecord): ShiftRecord[] {
  if (!(record.score > 0)) return list;
  return [...list, record]
    .sort((a, b) => b.score - a.score || a.at.localeCompare(b.at))
    .slice(0, LOCAL_BOARD_SIZE);
}

/** A display name as the shared board accepts it: printable, single-spaced, at most 16 characters. */
export function cleanName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX_LENGTH)
    .trim();
}
