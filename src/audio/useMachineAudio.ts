import { useCallback, useEffect, useRef } from "react";
import type { LoopKey } from "@/types/game";
import { audio, type LoopHandle } from "./audioManager";

/**
 * A machine's continuous sound (blade, buffer, tape). The loop exists only
 * while the player is interacting and is always torn down on unmount, so no
 * sound outlives its machine.
 */
export function useLoopSound(key: LoopKey, tone?: number) {
  const handle = useRef<LoopHandle | null>(null);

  const start = useCallback(() => {
    handle.current ??= audio.startLoop(key, tone);
  }, [key, tone]);

  const setIntensity = useCallback((value: number) => {
    handle.current?.setIntensity(value);
  }, []);

  const stop = useCallback(() => {
    handle.current?.stop();
    handle.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  return { start, setIntensity, stop };
}
