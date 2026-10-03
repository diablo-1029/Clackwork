import { useEffect, useRef, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

/** Counts towards `value` over a short tween so totals tick up instead of jumping. */
export function useAnimatedNumber(value: number, durationMs = 450): number {
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const [display, setDisplay] = useState(value);
  const shown = useRef(value);

  useEffect(() => {
    const from = shown.current;
    if (from === value) return;

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = reducedMotion ? 1 : Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      shown.current = Math.round(from + (value - from) * eased);
      setDisplay(shown.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs, reducedMotion]);

  return display;
}
