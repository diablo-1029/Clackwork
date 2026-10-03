"use client";

import { Fragment } from "react";
import { Icon } from "@/components/ui/Icon";
import { machines } from "@/config/machines";
import { products } from "@/config/products";
import { stepName } from "@/game/progression/unlocks";
import type { ProductionRun, RunPhase } from "@/types/game";

/** Compact strip showing where the product is in its chain: done ✓, active ●, upcoming ○. */
export function ProductionProgress({ run, phase }: { run: ProductionRun; phase: RunPhase }) {
  const finished = phase === "PRODUCT_COMPLETE" || phase === "REWARD_SUMMARY";
  const product = products[run.productId];
  // Long chains drop the names of steps that are not in progress, so the strip stays on one line.
  const compact = run.machineSequence.length > 5;

  return (
    <ol className={`flex items-center justify-center px-1 ${compact ? "gap-1" : "gap-1 sm:gap-2"}`} aria-label="Production chain">
      {run.machineSequence.map((id, index) => {
        const done = finished || index < run.results.length;
        const active = !done && index === run.currentMachineIndex && phase !== "ORDER_INTRO";
        const machine = machines[id];
        const name = product ? stepName(product, run.machineSequence, index) : machine.name;
        const state = done ? "done" : active ? "current step" : "upcoming";

        return (
          <Fragment key={`${id}-${index}`}>
            {index > 0 && (
              <li
                aria-hidden
                className={`h-1 min-w-1 shrink rounded-full ${compact ? "w-2 sm:w-4" : "w-3 sm:w-8"} ${
                  done || active ? "bg-brand" : "bg-line"
                }`}
              />
            )}
            <li
              aria-current={active ? "step" : undefined}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-extrabold transition-colors duration-200 sm:px-3 sm:text-sm ${
                done
                  ? "bg-success/15 text-success"
                  : active
                    ? "bg-brand-deep text-white shadow-sm"
                    : "bg-surface-2 text-muted"
              }`}
            >
              <Icon name={done ? "check" : id} size={16} strokeWidth={done ? 3 : 2} />
              <span className={active ? "" : compact ? "max-lg:sr-only" : "max-[420px]:sr-only"}>{name}</span>
              <span className="sr-only">, {state}</span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
