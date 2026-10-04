/**
 * The debug tools in Settings are hidden from players. They are switched on, per
 * device, by typing a secret word anywhere in the game or by tapping the Settings
 * header icon several times. Only a hash of the word is kept here.
 */
const STORAGE_KEY = "clackwork-debug-tools";
const SECRET_HASH = 579366030;
const SECRET_LENGTH = 11;

/** Taps on the Settings icon, and how quickly they must come, to toggle the tools. */
export const SECRET_TAPS = 7;
export const SECRET_TAP_WINDOW_MS = 3000;

function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** Feeds one typed character in; returns the new buffer and whether it now ends with the secret word. */
export function typeSecret(buffer: string, key: string): { buffer: string; matched: boolean } {
  if (key.length !== 1) return { buffer, matched: false };
  const next = (buffer + key.toLowerCase()).slice(-SECRET_LENGTH);
  return { buffer: next, matched: next.length === SECRET_LENGTH && hash(next) === SECRET_HASH };
}

export function readDebugAccess(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function writeDebugAccess(enabled: boolean): void {
  try {
    if (enabled) window.localStorage.setItem(STORAGE_KEY, "on");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage is unavailable: the tools simply stay on for this visit only.
  }
}
