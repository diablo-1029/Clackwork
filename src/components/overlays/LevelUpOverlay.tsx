"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { levelUpBonus } from "@/game/progression/levels";
import { getNextUnlock, getUnlocksAtLevel, type UnlockEntry, type UnlockKind } from "@/game/progression/unlocks";

const kindLabel: Record<UnlockKind, string> = {
  machine: "New machine",
  product: "New product",
  upgrade: "New upgrade",
  technique: "New technique",
  theme: "New theme",
  feature: "New",
};

const kindIcon: Record<UnlockKind, IconName> = {
  machine: "factory",
  product: "product",
  upgrade: "upgrades",
  technique: "sparkle",
  theme: "theme",
  feature: "sparkle",
};

/** One short celebration: every unlock from the levels just gained, in a single panel. */
export function LevelUpOverlay({ levels, onContinue }: { levels: number[]; onContinue: () => void }) {
  const level = Math.max(...levels);
  const unlocks: UnlockEntry[] = levels.flatMap(getUnlocksAtLevel);
  // Already paid when the level was reached; this only reports it.
  const bonus = levels.reduce((sum, reached) => sum + levelUpBonus(reached), 0);
  const next = getNextUnlock(level);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-navy/45 p-4 backdrop-blur-[2px]">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-up-title"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 20 }}
        className="relative flex max-h-full w-full max-w-sm flex-col items-center gap-3 overflow-hidden rounded-3xl bg-surface p-6 text-ink shadow-2xl"
      >
        <span className="sf-shine pointer-events-none absolute inset-0" aria-hidden />
        <motion.span
          initial={{ rotate: -40, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}
          className="flex size-16 items-center justify-center rounded-full bg-gold text-navy"
          aria-hidden
        >
          <Icon name="xp" size={34} fill="currentColor" strokeWidth={0} />
        </motion.span>
        <h2 id="level-up-title" className="text-center text-2xl font-black tracking-wide">
          FACTORY LEVEL {level}
        </h2>
        <p className="flex items-center gap-1.5 rounded-full bg-gold/20 px-3 py-1 text-sm font-black">
          <Icon name="coin" size={18} />+{bonus} Coins
          <span className="font-bold text-muted">level bonus</span>
        </p>

        {unlocks.length > 0 ? (
          <ul className="flex w-full flex-col gap-2 overflow-y-auto">
            {unlocks.map((unlock, index) => (
              <motion.li
                key={`${unlock.kind}-${unlock.id}`}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + index * 0.08 }}
                className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-deep text-white">
                  <Icon name={unlock.kind === "machine" ? (unlock.id as IconName) : kindIcon[unlock.kind]} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-black tracking-wider text-brand-deep uppercase">
                    {kindLabel[unlock.kind]}
                  </span>
                  <span className="block font-black">{unlock.name}</span>
                  <span className="block text-xs font-bold text-muted">{unlock.description}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-sm font-bold text-muted">
            {next ? `Next up at Level ${next.level}: ${next.name}.` : "Your factory keeps getting better."}
          </p>
        )}

        <Button onClick={onContinue} className="w-full" autoFocus>
          Continue
        </Button>
      </motion.div>
    </div>
  );
}
