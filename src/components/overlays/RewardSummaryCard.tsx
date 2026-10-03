"use client";

import { motion, useAnimate } from "framer-motion";
import { useEffect } from "react";
import { audio } from "@/audio/audioManager";
import { COIN_COUNTER_ID } from "@/components/counters/TopBar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { products } from "@/config/products";
import { getQualityLabel } from "@/game/economy/multipliers";
import { xpRequired } from "@/game/progression/levels";
import { getNextUnlock } from "@/game/progression/unlocks";
import { finishedLook } from "@/game/products/productLook";
import { ProductIcon } from "@/game/products/ProductRenderer";
import { usePlayerStore } from "@/stores/playerStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { RewardSummary } from "@/types/game";

/** A handful of tokens, never one element per coin. */
const COIN_TOKENS = 5;

export function RewardSummaryCard({ reward, onNext }: { reward: RewardSummary; onNext: () => void }) {
  const product = products[reward.productId];
  const level = usePlayerStore((s) => s.factoryLevel);
  const xp = usePlayerStore((s) => s.xp);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const nextUnlock = getNextUnlock(level);

  // Coins arc from the card to the counter in the top bar.
  useEffect(() => {
    const timers: number[] = [];
    [0, 1, 2].forEach((i) => timers.push(window.setTimeout(() => audio.play("coin"), 260 + i * 80)));

    const origin = scope.current?.getBoundingClientRect();
    const target = document.getElementById(COIN_COUNTER_ID)?.getBoundingClientRect();
    if (!reducedMotion && origin && target && origin.width > 0) {
      const dx = target.left + target.width / 2 - (origin.left + origin.width / 2);
      const dy = target.top + target.height / 2 - (origin.top + origin.height / 2);
      scope.current.querySelectorAll<HTMLElement>("[data-coin]").forEach((token, i) => {
        const sway = (i - (COIN_TOKENS - 1) / 2) * 26;
        animate(
          token,
          { x: [0, dx * 0.35 + sway, dx], y: [0, dy * 0.2 - 46, dy], opacity: [0, 1, 1, 0], scale: [0.6, 1.1, 0.7] },
          { duration: 0.65, delay: 0.2 + i * 0.07, ease: "easeInOut" },
        );
      });
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [animate, scope, reducedMotion, reward.runId]);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 14 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 24 }}
        className={`relative flex w-full max-w-sm flex-col items-center gap-2 rounded-3xl bg-surface p-5 text-ink shadow-xl sm:p-6 ${
          reward.isGolden ? "ring-4 ring-gold" : ""
        }`}
        role="status"
      >
        <ProductIcon material={product.materialProfile} isGolden={reward.isGolden} look={finishedLook(product, reward.isGolden)} size={76} />
        <h2 className="text-center text-xl font-black tracking-wide uppercase">
          {reward.isGolden ? "Golden " : ""}
          {product.name} complete
        </h2>
        <p className="text-sm font-extrabold text-muted">
          Total Quality: <span className="text-ink">{reward.quality}%</span> · {getQualityLabel(reward.quality)}
        </p>

        <div className="mt-1 flex w-full gap-2">
          <div ref={scope} className="relative flex flex-1 flex-col items-center rounded-2xl bg-surface-2 py-2.5">
            <span className="flex items-center gap-1.5 text-2xl font-black tabular-nums">
              <Icon name="coin" size={22} />+{reward.coins}
            </span>
            <span className="text-xs font-extrabold text-muted">
              Coins
              {reward.streakBonus > 0 && (
                <span className="text-orange"> · streak +{Math.round(reward.streakBonus * 100)}%</span>
              )}
            </span>
            {Array.from({ length: COIN_TOKENS }, (_, i) => (
              <span key={i} data-coin className="pointer-events-none absolute top-3 left-1/2 -ml-2.5 opacity-0" aria-hidden>
                <Icon name="coin" size={20} />
              </span>
            ))}
          </div>
          <div className="flex flex-1 flex-col items-center rounded-2xl bg-surface-2 py-2.5">
            <span className="flex items-center gap-1.5 text-2xl font-black tabular-nums">
              <Icon name="xp" size={20} fill="currentColor" strokeWidth={0} className="text-brand" />+{reward.xp}
            </span>
            <span className="text-xs font-extrabold text-muted">XP</span>
          </div>
        </div>

        {nextUnlock && (
          <p className="text-center text-xs font-bold text-muted">
            {xpRequired(level) - xp} XP to Level {level + 1}
            {nextUnlock.level === level + 1 ? ` · unlocks ${nextUnlock.name}` : ""}
          </p>
        )}

        <Button onClick={onNext} className="mt-1 w-full">
          Next Order
        </Button>
      </motion.div>
    </div>
  );
}
