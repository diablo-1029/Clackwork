"use client";

import { motion } from "framer-motion";
import { getQualityBand } from "@/game/economy/multipliers";
import type { MachineFeedback } from "@/stores/runStore";
import type { QualityTier } from "@/types/game";

/** Three feedback intensities; "low" stays neutral rather than scolding. */
const tierStyle: Record<QualityTier, string> = {
  perfect: "bg-orange text-navy",
  excellent: "bg-brand-deep text-white",
  good: "bg-surface text-ink",
  low: "bg-surface text-muted",
};

export function ResultFeedback({ feedback }: { feedback: MachineFeedback }) {
  const band = getQualityBand(feedback.quality);
  const perfect = band.tier === "perfect";

  return (
    <motion.div
      className="flex items-center justify-center gap-2.5"
      initial={{ scale: 0.7, opacity: 0, y: 8 }}
      animate={{ scale: perfect ? [0.7, 1.12, 1] : [0.7, 1.05, 1], opacity: 1, y: 0 }}
      transition={{ duration: perfect ? 0.34 : 0.26, ease: "easeOut" }}
      role="status"
    >
      <span className="text-2xl font-black tabular-nums text-stage-ink sm:text-3xl">{feedback.quality}%</span>
      <span
        className={`relative overflow-hidden rounded-xl px-3 py-1 text-lg font-black tracking-wide shadow-sm sm:text-xl ${tierStyle[band.tier]}`}
      >
        {band.label}
        {perfect && <span className="sf-shine pointer-events-none absolute inset-0" aria-hidden />}
      </span>
      <span className="flex flex-col text-left text-xs leading-tight font-extrabold text-stage-soft">
        <span>+{feedback.xp} XP</span>
        {perfect && feedback.streak >= 2 && <span className="text-orange">PERFECT x{feedback.streak}</span>}
      </span>
    </motion.div>
  );
}
