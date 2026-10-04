"use client";

import { useEffect } from "react";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { Button } from "@/components/ui/Button";
import { useParticles } from "@/game/effects/particles/useParticles";
import { machineComponents } from "@/game/machines/registry";
import { STAGE, type MachineProps } from "@/game/machines/shared";
import { useUiStore } from "@/stores/uiStore";
import type { MachineId } from "@/types/game";

type StageProps = Omit<MachineProps, "burst"> & {
  machineId: MachineId;
  /** Changes each time a Perfect lands on this machine; each change throws a shower of sparks. */
  celebrate?: number;
};

/** Stands in for a machine that has no module (or whose module crashed). */
function FallbackMachine({ label, onRun }: { label: string; onRun: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm font-bold text-stage-soft">{label}</p>
      <Button variant="secondary" onClick={onRun}>
        Run machine
      </Button>
    </div>
  );
}

/** The 4:3 box a machine lives in, with its particle layer and crash containment. */
export function MachineStage({ machineId, celebrate = 0, ...props }: StageProps) {
  const { burst, layer } = useParticles();

  useEffect(() => {
    if (celebrate === 0) return;
    const colors = ["var(--sf-gold-400)", "#ffffff", "var(--fx-accent)", "var(--fx-accent-2)"];
    burst({ x: STAGE.w / 2, y: STAGE.h * 0.5 }, { count: 20, spread: 170, shape: "spark", colors });
    burst({ x: STAGE.w / 2, y: STAGE.h * 0.5 }, { count: 10, spread: 110, shape: "chip", colors });
  }, [celebrate, burst]);
  const Machine = machineComponents[machineId];
  const stressBursts = useUiStore((s) => s.debug.stressBursts);

  // Debug-only: hammer the particle system to confirm the cap holds.
  useEffect(() => {
    if (stressBursts === 0) return;
    let fired = 0;
    const timer = window.setInterval(() => {
      burst({ x: Math.random() * STAGE.w, y: Math.random() * STAGE.h }, { count: 24, spread: 120, shape: "spark" });
      if (++fired >= 30) window.clearInterval(timer);
    }, 60);
    return () => window.clearInterval(timer);
  }, [stressBursts, burst]);

  const skip = () => props.onComplete({ quality: 80, durationMs: 0, metadata: { fallback: true } });

  return (
    <div className="relative h-full w-full">
      <ErrorBoundary
        fallback={(retry) => (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm font-bold text-stage-soft">This machine jammed. Your progress is safe.</p>
            <Button variant="secondary" onClick={retry}>
              Try again
            </Button>
          </div>
        )}
      >
        {Machine ? (
          <Machine {...props} burst={burst} />
        ) : (
          <FallbackMachine label="This machine is still being built." onRun={skip} />
        )}
      </ErrorBoundary>
      {layer}
    </div>
  );
}
