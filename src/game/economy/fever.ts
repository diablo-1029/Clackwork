import { economy } from "@/config/economy";
import { clampQuality } from "./multipliers";

/**
 * The fever meter. Perfects charge it; when it is full the factory goes into
 * Overdrive and the next few finished orders pay extra coins.
 */
export interface FeverState {
  /** Charges collected towards the next Overdrive, 0 to `economy.fever.size`. */
  charge: number;
  /** Orders still to be paid at the Overdrive rate. Above zero means Overdrive is on. */
  ordersLeft: number;
}

export const emptyFever: FeverState = { charge: 0, ordersLeft: 0 };

export function isOverdrive(fever: FeverState): boolean {
  return fever.ordersLeft > 0;
}

/** Keeps a stored meter inside its limits (e.g. after the config changes). */
export function clampFever(fever: FeverState): FeverState {
  const { size, orders } = economy.fever;
  const ordersLeft = Math.min(orders, Math.max(0, Math.floor(fever.ordersLeft)));
  // A meter cannot sit full: reaching `size` starts Overdrive and empties it.
  const charge = ordersLeft > 0 ? 0 : Math.min(size - 1, Math.max(0, Math.floor(fever.charge)));
  return { charge, ordersLeft };
}

export interface FeverStep {
  fever: FeverState;
  /** True on the result that filled the meter. */
  activated: boolean;
}

/** A Perfect adds a charge, a poor result removes one. Nothing moves during Overdrive. */
export function applyMachineResult(fever: FeverState, quality: number): FeverStep {
  if (isOverdrive(fever)) return { fever, activated: false };

  const { size, orders, poorQuality } = economy.fever;
  const q = clampQuality(quality);
  if (q >= 100) {
    const charge = fever.charge + 1;
    return charge >= size
      ? { fever: { charge: 0, ordersLeft: orders }, activated: true }
      : { fever: { ...fever, charge }, activated: false };
  }
  if (q < poorQuality) return { fever: { ...fever, charge: Math.max(0, fever.charge - 1) }, activated: false };
  return { fever, activated: false };
}

/** Each finished order uses up one Overdrive order. The order that filled the meter is the first. */
export function finishOrder(fever: FeverState): FeverState {
  return isOverdrive(fever) ? { ...fever, ordersLeft: fever.ordersLeft - 1 } : fever;
}

export function getOverdriveMultiplier(overdrive: boolean): number {
  return overdrive ? economy.fever.coinMultiplier : 1;
}
