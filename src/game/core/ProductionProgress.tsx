"use client";

import { Fragment } from "react";
import { Icon } from "@/components/ui/Icon";
import { machines } from "@/config/machines";
import type { ProductionRun, RunPhase } from "@/types/game";

/** Compact strip showing where the product is in its chain: done ✓, active ●, upcoming ○. */
export function ProductionProgress({ run, phase }: { run: ProductionRun; phase: RunPhase }) {
  const finished = phase === "PRODUCT_COMPLETE" || phase === "REWARD_SUMMARY";

  return (
    <ol className="flex items-center justify-center gap-1 px-1 sm:gap-2" aria-label="Production chain">
      {run.machineSequence.map((id, index) => {
        const done = finished || index < run.results.length;
        const active = !done && index === run.currentMachineIndex && phase !== "ORDER_INTRO";
        const machine = machines[id];
        const state = done ? "done" : active ? "current step" : "upcoming";

        return (
          <Fragment key={`${id}-${index}`}>
            {index > 0 && (
              <li aria-hidden className={`h-1 w-3 rounded-full sm:w-8 ${done || active ? "bg-brand" : "bg-line"}`} />
            )}
            <li
              aria-current={active ? "step" : undefined}
              className={`flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-extrabold transition-colors duration-200 sm:px-3 sm:text-sm ${
                done
                  ? "bg-success/15 text-success"
                  : active
                    ? "bg-brand-deep text-white shadow-sm"
                    : "bg-surface-2 text-muted"
              }`}
            >
              <Icon name={done ? "check" : id} size={16} strokeWidth={done ? 3 : 2} />
              <span className={active ? "" : "max-[420px]:sr-only"}>{machine.name}</span>
              <span className="sr-only">, {state}</span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
