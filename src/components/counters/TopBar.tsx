"use client";

import { motion } from "framer-motion";
import { audio } from "@/audio/audioManager";
import { Icon } from "@/components/ui/Icon";
import { useAnimatedNumber } from "@/components/ui/useAnimatedNumber";
import { getStreakBonus } from "@/game/economy/multipliers";
import { xpRequired } from "@/game/progression/levels";
import { isFeatureUnlocked } from "@/game/progression/unlocks";
import { usePlayerStore } from "@/stores/playerStore";
import { useSettingsStore } from "@/stores/settingsStore";

/** Other components aim coin animations at this element. */
export const COIN_COUNTER_ID = "sf-coin-counter";

function LevelMeter() {
  const level = usePlayerStore((s) => s.factoryLevel);
  const xp = usePlayerStore((s) => s.xp);
  const needed = xpRequired(level);
  const progress = Math.min(1, xp / needed);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-64" title={`${xp} / ${needed} XP`}>
      <motion.span
        key={level}
        initial={{ scale: 1.25 }}
        animate={{ scale: 1 }}
        className="flex h-9 shrink-0 items-center gap-1 rounded-xl bg-brand-deep px-2.5 text-sm font-black text-white"
      >
        <Icon name="xp" size={15} fill="currentColor" strokeWidth={0} className="text-gold" />
        <span>
          <span className="sr-only">Factory Level </span>
          <span aria-hidden>Lv </span>
          {level}
        </span>
      </motion.span>
      <div
        className="h-3 min-w-10 flex-1 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-label="XP to next Factory Level"
        aria-valuemin={0}
        aria-valuemax={needed}
        aria-valuenow={xp}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand to-cyan transition-[width] duration-300 ease-out"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

function StreakChip() {
  const streak = usePlayerStore((s) => s.perfectStreak);
  const level = usePlayerStore((s) => s.factoryLevel);
  if (streak < 2) return null;

  const bonus = getStreakBonus(streak);
  const showBonus = bonus > 0 && isFeatureUnlocked("streakIndicator", level);

  return (
    <motion.div
      key={streak}
      initial={{ scale: 1.2 }}
      animate={{ scale: 1 }}
      className="flex h-9 shrink-0 items-center gap-1 rounded-xl bg-orange/15 px-2 text-sm font-black text-orange"
      aria-label={`Perfect streak ${streak}${showBonus ? `, plus ${Math.round(bonus * 100)} percent coins` : ""}`}
    >
      <Icon name="streak" size={16} fill="currentColor" strokeWidth={0} />
      <span aria-hidden>x{streak}</span>
      {showBonus && (
        <span aria-hidden className="hidden text-xs font-extrabold sm:inline">
          +{Math.round(bonus * 100)}%
        </span>
      )}
    </motion.div>
  );
}

function CoinCounter() {
  const coins = usePlayerStore((s) => s.coins);
  const shown = useAnimatedNumber(coins);

  return (
    <motion.div
      id={COIN_COUNTER_ID}
      key={coins}
      initial={{ scale: 1.14 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 18 }}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-surface-2 px-2.5 text-sm font-black tabular-nums"
      aria-label={`${coins} coins`}
    >
      <Icon name="coin" size={18} />
      <span aria-hidden>{shown.toLocaleString("en-US")}</span>
    </motion.div>
  );
}

function SoundToggle() {
  const enabled = useSettingsStore((s) => s.audio.masterEnabled);
  const setAudio = useSettingsStore((s) => s.setAudio);

  return (
    <button
      type="button"
      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2"
      aria-label={enabled ? "Turn sound off" : "Turn sound on"}
      aria-pressed={enabled}
      onClick={() => {
        setAudio({ masterEnabled: !enabled });
        if (!enabled) {
          audio.unlock();
          window.setTimeout(() => audio.play("uiClick"), 60);
        }
      }}
    >
      <Icon name={enabled ? "soundOn" : "soundOff"} />
    </button>
  );
}

export function TopBar() {
  return (
    <header className="flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:gap-3 sm:px-4">
      <h1 className="hidden shrink-0 text-lg font-black tracking-tight text-brand-deep md:block">
        Clackwork
      </h1>
      <LevelMeter />
      <div className="flex-1 max-sm:hidden" />
      <StreakChip />
      <CoinCounter />
      <SoundToggle />
    </header>
  );
}
