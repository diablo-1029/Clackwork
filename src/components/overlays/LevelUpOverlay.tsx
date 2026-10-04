"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Tile, type Tone } from "@/components/ui/Chunky";
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

const kindTone: Record<UnlockKind, Tone> = {
  machine: "deep",
  product: "blue",
  upgrade: "orange",
  technique: "green",
  theme: "gold",
  feature: "blue",
};

/** Confetti pieces: direction (degrees), distance and colour. Fixed, so every level-up looks the same. */
const CONFETTI = Array.from({ length: 16 }, (_, i) => ({
  angle: (i / 16) * 360 + (i % 2 ? 9 : -7),
  distance: 92 + (i % 4) * 22,
  color: ["var(--sf-gold-400)", "var(--sf-orange-500)", "var(--sf-cyan)", "var(--sf-success)"][i % 4],
}));

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
        className="sf-raised relative flex max-h-full w-full max-w-sm flex-col items-center gap-3 overflow-hidden rounded-3xl p-6 text-ink"
      >
        <span className="sf-shine pointer-events-none absolute inset-0" aria-hidden />

        <div className="relative flex size-24 items-center justify-center" aria-hidden>
          <span className="sf-rays sf-tone-gold absolute -inset-10" />
          {CONFETTI.map((piece, index) => {
            const radians = (piece.angle * Math.PI) / 180;
            return (
              <motion.span
                key={index}
                className="absolute h-2.5 w-1.5 rounded-[2px]"
                style={{ background: piece.color }}
                initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
                animate={{
                  x: Math.cos(radians) * piece.distance,
                  y: Math.sin(radians) * piece.distance + 26,
                  opacity: [0, 1, 1, 0],
                  rotate: piece.angle * 2,
                }}
                transition={{ duration: 0.95, delay: 0.15, ease: "easeOut" }}
              />
            );
          })}
          <motion.span
            initial={{ rotate: -40, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}
            className="sf-tile sf-tone-gold relative flex size-20 flex-col items-center justify-center rounded-full"
          >
            <Icon name="xp" size={22} fill="currentColor" strokeWidth={0} />
            <span className="text-2xl leading-none font-black tabular-nums">{level}</span>
          </motion.span>
        </div>

        <h2 id="level-up-title" className="sf-title text-center text-2xl tracking-wide">
          FACTORY LEVEL {level}
        </h2>
        <p className="sf-chip sf-tone-gold flex items-center gap-1.5 rounded-2xl px-3.5 py-1.5 text-base font-black">
          <Icon name="coin" size={20} />+{bonus} Coins
          <span className="text-xs font-bold text-muted">level bonus</span>
        </p>

        {unlocks.length > 0 ? (
          <ul className="flex w-full flex-col gap-2 overflow-y-auto pb-1">
            {unlocks.map((unlock, index) => (
              <motion.li
                key={`${unlock.kind}-${unlock.id}`}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + index * 0.08 }}
                className="sf-inset flex items-center gap-3 rounded-2xl p-2.5"
              >
                <Tile tone={kindTone[unlock.kind]} className="size-11">
                  <Icon name={unlock.kind === "machine" ? (unlock.id as IconName) : kindIcon[unlock.kind]} />
                </Tile>
                <span className="min-w-0">
                  <span className="block text-[11px] font-black tracking-wider text-brand-deep uppercase">
                    {kindLabel[unlock.kind]}
                  </span>
                  <span className="block leading-tight font-black">{unlock.name}</span>
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
