"use client";

import { motion } from "framer-motion";
import { audio } from "@/audio/audioManager";
import { Meter } from "@/components/ui/Chunky";
import { Icon } from "@/components/ui/Icon";
import { useAnimatedNumber } from "@/components/ui/useAnimatedNumber";
import { economy } from "@/config/economy";
import { isOverdrive } from "@/game/economy/fever";
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

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-80" title={`${xp} / ${needed} XP`}>
      <motion.span
        key={level}
        initial={{ scale: 1.25 }}
        animate={{ scale: 1 }}
        className="sf-tile sf-tone-deep flex h-10 shrink-0 items-center gap-1 rounded-xl px-2.5 text-sm font-black"
      >
        <Icon name="xp" size={17} fill="currentColor" strokeWidth={0} className="text-gold" />
        <span>
          <span className="sr-only">Factory Level </span>
          <span aria-hidden>Lv </span>
          {level}
        </span>
      </motion.span>
      <Meter value={xp} max={needed} label="XP to next Factory Level" className="h-5 min-w-10 flex-1" />
      <span className="shrink-0 text-xs font-black text-muted tabular-nums max-sm:hidden" aria-hidden>
        {xp} / {needed} XP
      </span>
    </div>
  );
}

function StreakChip() {
  const streak = usePlayerStore((s) => s.perfectStreak);
  const level = usePlayerStore((s) => s.factoryLevel);
  const fever = usePlayerStore((s) => s.fever);
  const feverOn = isFeatureUnlocked("fever", level);
  const overdrive = feverOn && isOverdrive(fever);
  if (streak < 2 && !(feverOn && (fever.charge > 0 || overdrive))) return null;

  const bonus = getStreakBonus(streak);
  const showBonus = bonus > 0 && isFeatureUnlocked("streakIndicator", level);
  // The meter under the streak: charges towards Overdrive, or the orders it has left.
  const segments = overdrive ? economy.fever.orders : economy.fever.size;
  const filled = overdrive ? fever.ordersLeft : fever.charge;
  const label = [
    streak >= 2 ? `Perfect streak ${streak}${showBonus ? `, plus ${Math.round(bonus * 100)} percent coins` : ""}` : "",
    overdrive
      ? `Overdrive: double coins on ${fever.ordersLeft} more ${fever.ordersLeft === 1 ? "order" : "orders"}`
      : feverOn
        ? `Fever meter ${fever.charge} of ${economy.fever.size}`
        : "",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <motion.div
      key={`${streak}-${overdrive}`}
      initial={{ scale: 1.2 }}
      animate={{ scale: 1 }}
      className={`flex h-10 shrink-0 flex-col justify-center gap-1 rounded-xl px-2.5 text-sm font-black ${
        overdrive ? "sf-tile sf-tone-orange" : "sf-chip sf-tone-orange text-orange"
      }`}
      aria-label={label}
    >
      <span className="flex items-center gap-1 leading-none" aria-hidden>
        <Icon name="streak" size={feverOn ? 15 : 18} fill="currentColor" strokeWidth={0} />
        {overdrive ? (
          <span>
            x{economy.fever.coinMultiplier}
            <span className="max-sm:hidden"> coins</span>
          </span>
        ) : (
          <>
            {streak >= 2 ? <span>x{streak}</span> : <span className="text-xs">Fever</span>}
            {showBonus && <span className="hidden text-xs font-extrabold sm:inline">+{Math.round(bonus * 100)}%</span>}
          </>
        )}
      </span>
      {feverOn && (
        <span className="flex gap-0.5" aria-hidden>
          {Array.from({ length: segments }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 min-w-1.5 flex-1 rounded-full ${
                i < filled ? (overdrive ? "bg-navy" : "bg-orange") : overdrive ? "bg-navy/25" : "bg-orange/25"
              }`}
            />
          ))}
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
      className="sf-chip sf-tone-gold flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-base font-black tabular-nums"
      aria-label={`${coins} coins`}
    >
      <Icon name="coin" size={22} />
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
      className="sf-raised flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition-transform hover:text-ink active:translate-y-0.5"
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
    <header className="flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2.5 sm:gap-3 sm:px-4 lg:px-6">
      <h1 className="sf-title hidden shrink-0 items-center gap-2 text-xl text-brand-deep md:flex">
        <span className="sf-tile sf-tone-orange flex size-8 items-center justify-center rounded-lg" aria-hidden>
          <Icon name="settings" size={19} strokeWidth={2.4} />
        </span>
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
