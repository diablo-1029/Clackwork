"use client";

import { motion } from "framer-motion";
import { Meter } from "@/components/ui/Chunky";
import { Icon } from "@/components/ui/Icon";
import { economy } from "@/config/economy";
import { comboMultiplier, type ShiftState } from "@/game/core/shift";

/** The shift's clock, score and combo, shown above the stage. */
export function ShiftHud({ shift }: { shift: ShiftState }) {
  const seconds = shift.timeLeftMs / 1000;
  const low = shift.started && shift.timeLeftMs <= economy.shift.lowMs;
  const multiplier = comboMultiplier(shift.combo);
  const waiting = !shift.started && !shift.expired;

  return (
    <div className="flex items-center gap-2 px-1" role="group" aria-label="Shift">
      <div
        className={`sf-raised flex h-10 w-[4.75rem] shrink-0 items-center justify-center gap-1 rounded-xl text-lg font-black tabular-nums ${
          low ? "sf-clock-low !border-orange text-orange" : ""
        }`}
        role="timer"
        aria-label={`${Math.ceil(seconds)} seconds left`}
      >
        <span aria-hidden>{shift.expired ? "0.0" : seconds.toFixed(1)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <Meter
          value={shift.timeLeftMs}
          max={economy.shift.maxMs}
          label="Time left"
          tone={low ? "orange" : "blue"}
          className="h-4"
        />
        <p className="mt-0.5 truncate text-[10px] font-black tracking-wider text-muted uppercase">
          {waiting
            ? shift.warmup
              ? "Warm-up: the clock starts after your first product"
              : "The clock starts on your first move"
            : shift.expired
              ? "Time! Finish this one"
              : `${shift.products} made`}
        </p>
      </div>
      <motion.div
        key={shift.score}
        initial={{ scale: 1.12 }}
        animate={{ scale: 1 }}
        className="sf-chip sf-tone-blue flex h-10 shrink-0 flex-col items-center justify-center rounded-xl px-2.5 leading-none"
        aria-label={`Score ${shift.score}, combo times ${multiplier.toFixed(1)}`}
      >
        <span className="text-base font-black tabular-nums" aria-hidden>
          {shift.score.toLocaleString("en-US")}
        </span>
        <span className="flex items-center gap-0.5 text-[10px] font-black text-orange" aria-hidden>
          <Icon name="streak" size={10} fill="currentColor" strokeWidth={0} />x{multiplier.toFixed(1)}
        </span>
      </motion.div>
    </div>
  );
}
