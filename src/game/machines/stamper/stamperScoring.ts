import { clamp, hashString } from "@/lib/math";

export const stamperTuning = {
  /** Full sweep there and back, in ms. */
  periodMs: 1900,
  /** The same sweep for the "quick" variant. */
  quickPeriodMs: 1250,
  /** Half-width of the Perfect zone, as a share of half the track. */
  perfectZone: 0.08,
  /** Easing exponent: below 1 keeps near-misses feeling fair. */
  easing: 0.65,
  /** Where an off-centre or double mark sits along the track (0 = left edge, 1 = right edge). */
  sideTargets: [0.3, 0.7],
} as const;

/** Constant-speed back-and-forth sweep. Returns 0–1, starting at the left edge. */
export function markerPosition(elapsedMs: number, periodMs: number = stamperTuning.periodMs): number {
  if (periodMs <= 0) return 0.5;
  const phase = (((elapsedMs % periodMs) + periodMs) % periodMs) / periodMs;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

/**
 * `position` is where the marker was when the press fired and `target` where it
 * should have been, both 0–1 along the track. The tolerance is the same wherever
 * the target sits.
 */
export function calculateStamperQuality(position: number, target = 0.5): number {
  const { perfectZone, easing } = stamperTuning;
  const distance = clamp(Math.abs(clamp(position, 0, 1) - target) / 0.5, 0, 1);
  if (distance <= perfectZone) return 100;

  const outside = (distance - perfectZone) / (1 - perfectZone);
  // Anything outside the Perfect zone tops out at 99 so PERFECT stays meaningful.
  return Math.round(clamp(99 * Math.pow(1 - outside, easing), 0, 99));
}

export interface StampPlan {
  periodMs: number;
  /** One press per target. */
  targets: number[];
}

/** What a Stamper variant asks for. Stable per run, so a remount shows the same marks. */
export function stampPlan(variant: string, runId: string): StampPlan {
  const { periodMs, quickPeriodMs, sideTargets } = stamperTuning;
  switch (variant) {
    case "quick":
      return { periodMs: quickPeriodMs, targets: [0.5] };
    case "offset":
      return { periodMs, targets: [sideTargets[hashString(`stamp:${runId}`) % sideTargets.length]] };
    case "double":
      return { periodMs, targets: [...sideTargets] };
    default:
      return { periodMs, targets: [0.5] };
  }
}

/** The target a press at `position` is aiming for: the nearest one not yet stamped. */
export function nearestTarget(position: number, remaining: number[]): number {
  return remaining.reduce((best, target) => (Math.abs(target - position) < Math.abs(best - position) ? target : best), remaining[0] ?? 0.5);
}
