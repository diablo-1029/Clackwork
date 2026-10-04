"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Ribbon } from "@/components/ui/Chunky";
import { Icon } from "@/components/ui/Icon";
import { useAnimatedNumber } from "@/components/ui/useAnimatedNumber";
import { comboMultiplier, type ShiftSummary as Summary } from "@/game/core/shift";

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="sf-inset flex min-w-0 flex-1 flex-col items-center rounded-2xl px-1 py-2">
      <span className="flex items-center gap-1 text-lg leading-tight font-black tabular-nums">
        {icon}
        {value}
      </span>
      <span className="text-[10px] font-black tracking-wider text-muted uppercase">{label}</span>
    </div>
  );
}

interface ShiftSummaryProps {
  summary: Summary;
  /** Level-ups are waiting: the main button leads to them first. */
  levelUpsPending: boolean;
  onContinue: () => void;
  onPlayAgain: () => void;
  onFreePlay: () => void;
}

/** The end of a shift: the score to beat, what was earned, and straight back in. */
export function ShiftSummary({ summary, levelUpsPending, onContinue, onPlayAgain, onFreePlay }: ShiftSummaryProps) {
  const score = useAnimatedNumber(summary.score, 700);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 14 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 24 }}
        className={`sf-raised relative flex max-h-full w-full max-w-sm flex-col items-center gap-3 overflow-x-hidden overflow-y-auto rounded-3xl p-5 text-ink ${
          summary.isBest ? "!border-gold ring-4 ring-gold" : ""
        }`}
        role="status"
      >
        <Ribbon tone={summary.isBest ? "gold" : "deep"} className="text-sm">
          {summary.isBest ? "New best!" : "Shift over"}
        </Ribbon>

        <div className="relative flex flex-col items-center">
          {summary.isBest && <span className="sf-rays sf-tone-gold absolute -inset-x-16 -inset-y-10" aria-hidden />}
          <span className="relative text-5xl leading-none font-black tabular-nums">{score.toLocaleString("en-US")}</span>
          <span className="relative mt-1 text-xs font-black tracking-wider text-muted uppercase">
            {summary.isBest
              ? summary.previousBest > 0
                ? `Old best ${summary.previousBest.toLocaleString("en-US")}`
                : "Your first score"
              : `Best ${summary.previousBest.toLocaleString("en-US")}`}
          </span>
        </div>

        <div className="flex w-full gap-2">
          <Stat
            icon={<Icon name="product" size={17} className="text-brand-deep" />}
            value={String(summary.products)}
            label="Made"
          />
          <Stat
            icon={<Icon name="streak" size={16} fill="currentColor" strokeWidth={0} className="text-orange" />}
            value={`x${comboMultiplier(summary.bestCombo).toFixed(1)}`}
            label="Best combo"
          />
          <Stat icon={<Icon name="coin" size={18} />} value={`+${summary.coins}`} label="Coins" />
          <Stat
            icon={<Icon name="xp" size={16} fill="currentColor" strokeWidth={0} className="text-brand" />}
            value={`+${summary.xp}`}
            label="XP"
          />
        </div>

        {levelUpsPending ? (
          <Button onClick={onContinue} className="w-full text-lg" autoFocus>
            Continue
          </Button>
        ) : (
          <>
            <Button onClick={onPlayAgain} className="w-full text-lg" autoFocus>
              Play again
            </Button>
            <Button variant="ghost" onClick={onFreePlay} className="min-h-11 w-full">
              Free play
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
}
