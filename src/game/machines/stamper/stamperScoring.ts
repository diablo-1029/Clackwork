import { clamp } from "@/lib/math";

export const stamperTuning = {
  /** Full sweep there and back, in ms. */
  periodMs: 1900,
  /** Half-width of the Perfect zone, as a share of the distance from center to edge. */
  perfectZone: 0.08,
  /** Easing exponent: below 1 keeps near-misses feeling fair. */
  easing: 0.65,
} as const;

/** Constant-speed back-and-forth sweep. Returns 0–1, starting at the left edge. */
export function markerPosition(elapsedMs: number, periodMs: number = stamperTuning.periodMs): number {
  if (periodMs <= 0) return 0.5;
  const phase = (((elapsedMs % periodMs) + periodMs) % periodMs) / periodMs;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

/** `position` is where the marker was when the press fired: 0 = left edge, 0.5 = center. */
export function calculateStamperQuality(position: number): number {
  const { perfectZone, easing } = stamperTuning;
  const distance = clamp(Math.abs(clamp(position, 0, 1) - 0.5) / 0.5, 0, 1);
  if (distance <= perfectZone) return 100;

  const outside = (distance - perfectZone) / (1 - perfectZone);
  // Anything outside the Perfect zone tops out at 99 so PERFECT stays meaningful.
  return Math.round(clamp(99 * Math.pow(1 - outside, easing), 0, 99));
}
