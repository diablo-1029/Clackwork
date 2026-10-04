import { useSettingsStore } from "@/stores/settingsStore";

/** Short vibration patterns in ms, for phones that support them. */
export type HapticKind = "perfect" | "poor" | "tick" | "shiftEnd" | "levelUp";

const patterns: Record<HapticKind, number | number[]> = {
  perfect: 14,
  poor: [24, 40, 24],
  tick: 6,
  shiftEnd: [40, 60, 40, 60, 90],
  levelUp: [20, 40, 20, 40, 60],
};

/** Vibrates if the device can and the player has not turned it off. Never throws. */
export function vibrate(kind: HapticKind): void {
  const { vibration, reducedMotion } = useSettingsStore.getState();
  if (!vibration || reducedMotion) return;
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(patterns[kind]);
  } catch {
    // Some browsers block vibration outside a user gesture; that is fine.
  }
}
