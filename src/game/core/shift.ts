import { economy } from "@/config/economy";
import { clampQuality } from "@/game/economy/multipliers";

/**
 * A shift: a short run against the clock. Good results win time back, poor ones
 * cost it, and what comes back shrinks with every product, so a shift always
 * ends and a faster, cleaner player always gets further. Pure rules only; the
 * store and the screen live elsewhere.
 */
export interface ShiftState {
  timeLeftMs: number;
  /** The clock is running. It starts on the player's first move. */
  started: boolean;
  /** A first-ever shift: the clock waits until one product has been finished. */
  warmup: boolean;
  /** The clock has run out. The machine in progress may still be finished. */
  expired: boolean;
  score: number;
  /** Perfects in a row; drives the score multiplier. */
  combo: number;
  bestCombo: number;
  machines: number;
  products: number;
  coins: number;
  xp: number;
  /** What the last result did to the clock, for the result sign. */
  lastDeltaMs: number;
}

export function newShift(warmup = false): ShiftState {
  return {
    timeLeftMs: economy.shift.startMs,
    started: false,
    warmup,
    expired: false,
    score: 0,
    combo: 0,
    bestCombo: 0,
    machines: 0,
    products: 0,
    coins: 0,
    xp: 0,
    lastDeltaMs: 0,
  };
}

/** Starts the clock, unless this is a warm-up that has not finished its first product. */
export function startClock(state: ShiftState): ShiftState {
  if (state.started || state.expired || (state.warmup && state.products === 0)) return state;
  return { ...state, started: true };
}

/** Runs the clock forward. Nothing moves before it has started or after it has run out. */
export function tickShift(state: ShiftState, dtMs: number): ShiftState {
  if (!state.started || state.expired || !(dtMs > 0)) return state;
  const timeLeftMs = Math.max(0, state.timeLeftMs - dtMs);
  return { ...state, timeLeftMs, expired: timeLeftMs === 0 };
}

/** The share of a machine's normal length that a result of this quality wins back. Negative costs time. */
export function refundFactor(quality: number): number {
  const q = clampQuality(quality);
  const band = economy.shift.refund.find((entry) => q >= entry.min);
  return band ? band.factor : -economy.shift.poorPenalty;
}

/**
 * Time a result adds to (or takes from) the clock. It scales with how long the
 * machine normally takes, so a long machine is not a punishment, and gains
 * shrink with every product finished.
 */
export function refundMs(quality: number, parSeconds: number, productsDone: number): number {
  const { refundDecay, refundFloor, minPenaltyMs } = economy.shift;
  const factor = refundFactor(quality);
  const base = Math.max(0, parSeconds) * 1000 * factor;
  if (factor < 0) return Math.round(Math.min(base, -minPenaltyMs));
  const decay = Math.max(refundFloor, Math.pow(refundDecay, Math.max(0, productsDone)));
  return Math.round(base * decay);
}

export function comboMultiplier(combo: number): number {
  const { comboStep, comboMax } = economy.shift;
  return Math.min(comboMax, 1 + Math.max(0, combo) * comboStep);
}

/** Scores one machine result and moves the clock. */
export function applyShiftResult(state: ShiftState, quality: number, parSeconds: number): ShiftState {
  const q = clampQuality(quality);
  const combo = q >= 100 ? state.combo + 1 : q < economy.shift.poorQuality ? 0 : state.combo;
  const delta = refundMs(q, parSeconds, state.products);
  // Once the clock has run out, a buzzer-beater still scores but cannot buy the shift back.
  const timeLeftMs = state.expired
    ? 0
    : Math.min(economy.shift.maxMs, Math.max(0, state.timeLeftMs + (state.started ? delta : 0)));
  return {
    ...state,
    timeLeftMs,
    expired: state.expired || (state.started && timeLeftMs === 0),
    score: state.score + Math.round(q * comboMultiplier(combo)),
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    machines: state.machines + 1,
    lastDeltaMs: state.started && !state.expired ? delta : 0,
  };
}

/** A finished product: a score bonus, the totals for the summary, and the end of any warm-up. */
export function applyShiftProduct(state: ShiftState, coins: number, xp: number): ShiftState {
  const next: ShiftState = {
    ...state,
    products: state.products + 1,
    coins: state.coins + Math.max(0, coins),
    xp: state.xp + Math.max(0, xp),
    score: state.score + Math.round(economy.shift.productBonus * comboMultiplier(state.combo)),
  };
  return next.warmup && !next.started && !next.expired ? { ...next, started: true } : next;
}

export interface ShiftDifficulty {
  /** How many of a machine's unlocked variants are in rotation: the basic one first, more as the shift goes on. */
  variantCount: number;
  /** Speed multiplier for machines with a moving part. 1 is normal. */
  tempo: number;
}

export function shiftDifficulty(productsDone: number): ShiftDifficulty {
  const { productsPerVariant, tempoPerProduct, tempoMax } = economy.shift;
  const done = Math.max(0, Math.floor(productsDone));
  return {
    variantCount: 1 + Math.floor(done / productsPerVariant),
    tempo: Math.min(tempoMax, 1 + done * tempoPerProduct),
  };
}

export interface ShiftSummary {
  score: number;
  products: number;
  machines: number;
  bestCombo: number;
  coins: number;
  xp: number;
  /** The score beat the saved best. */
  isBest: boolean;
  /** The best score before this shift. */
  previousBest: number;
}

export function summarise(state: ShiftState, previousBest: number): ShiftSummary {
  return {
    score: state.score,
    products: state.products,
    machines: state.machines,
    bestCombo: state.bestCombo,
    coins: state.coins,
    xp: state.xp,
    isBest: state.score > previousBest,
    previousBest,
  };
}
