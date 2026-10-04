"use client";

import { motion, useAnimate } from "framer-motion";
import { useEffect, useState } from "react";
import { audio } from "@/audio/audioManager";
import { COIN_COUNTER_ID } from "@/components/counters/TopBar";
import { Button } from "@/components/ui/Button";
import { Meter, Ribbon } from "@/components/ui/Chunky";
import { useAnimatedNumber } from "@/components/ui/useAnimatedNumber";
import { Icon } from "@/components/ui/Icon";
import { products } from "@/config/products";
import { getQualityBand } from "@/game/economy/multipliers";
import { xpRequired } from "@/game/progression/levels";
import { getNextUnlock } from "@/game/progression/unlocks";
import { finishedLook } from "@/game/products/productLook";
import { ProductIcon } from "@/game/products/ProductRenderer";
import { usePlayerStore } from "@/stores/playerStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { OrderOffer, RewardSummary } from "@/types/game";
import { describeTwist } from "@/game/core/orders";
import { OrderBoard } from "./OrderBoard";

/** A handful of tokens, never one element per coin. */
const COIN_TOKENS = 5;

interface RewardSummaryCardProps {
  reward: RewardSummary;
  onNext: () => void;
  /** Label for the button shown when there are no cards to pick from. */
  nextLabel?: string;
  /** When given, the cards replace the button: picking one starts the next order. */
  offers?: OrderOffer[];
  onPick?: (offer: OrderOffer) => void;
}

/** One to three stars, from the same quality bands that set the coin multiplier. */
function starCount(tier: string): number {
  if (tier === "perfect" || tier === "excellent") return 3;
  return tier === "good" ? 2 : 1;
}

/** What the twist did to this order, in a few words. */
function twistOutcome(twist: NonNullable<RewardSummary["twist"]>): string {
  const { name, rule } = describeTwist(twist.kind);
  if (twist.kind === "training") return `${name}: ${rule}`;
  if (twist.kind === "rush") return twist.achieved ? `${name} bonus earned` : `${name} missed, no penalty`;
  return twist.achieved ? `${name} bonus earned` : `${name} missed`;
}

export function RewardSummaryCard({ reward, onNext, nextLabel = "Next Order", offers, onPick }: RewardSummaryCardProps) {
  const product = products[reward.productId];
  const level = usePlayerStore((s) => s.factoryLevel);
  const xp = usePlayerStore((s) => s.xp);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const nextUnlock = getNextUnlock(level);
  const band = getQualityBand(reward.quality);
  const stars = starCount(band.tier);
  // The totals start at zero and tick up once the card has landed.
  const [counting, setCounting] = useState(false);
  const shownCoins = useAnimatedNumber(counting ? reward.coins : 0, 600);
  const shownXp = useAnimatedNumber(counting ? reward.xp : 0, 600);

  useEffect(() => {
    const timer = window.setTimeout(() => setCounting(true), 180);
    return () => window.clearTimeout(timer);
  }, []);

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
        className={`sf-raised relative flex max-h-full w-full flex-col items-center gap-2 overflow-x-hidden overflow-y-auto rounded-3xl p-4 text-ink sm:p-5 ${
          offers ? "max-w-md" : "max-w-sm"
        } ${reward.isGolden ? "!border-gold ring-4 ring-gold" : ""}`}
        role="status"
      >
        <Ribbon tone={band.tier === "perfect" ? "gold" : "deep"} className="text-sm">
          {band.label} · {reward.quality}%
        </Ribbon>

        {/* The finished product on show, with rays behind it. */}
        <div className="relative flex h-16 w-full items-center justify-center">
          <span className={`sf-rays absolute size-40 ${reward.isGolden ? "sf-tone-gold" : "sf-tone-blue"}`} aria-hidden />
          <span className="relative">
            <ProductIcon
              material={product.materialProfile}
              isGolden={reward.isGolden}
              look={finishedLook(product, reward.isGolden)}
              size={76}
            />
          </span>
        </div>

        <div className="relative flex gap-1" role="img" aria-label={`${stars} of 3 stars`}>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 14, delay: 0.15 + i * 0.1 }}
              className={i < stars ? "text-gold" : "text-line"}
            >
              <Icon name="xp" size={i === 1 ? 30 : 24} fill="currentColor" stroke="var(--sf-orange-500)" strokeWidth={i < stars ? 1.2 : 0} />
            </motion.span>
          ))}
        </div>

        <h2 className="relative text-center text-lg leading-tight font-black tracking-wide uppercase">
          {reward.isGolden ? "Golden " : ""}
          {product.name} complete
        </h2>

        <div className="mt-1 flex w-full gap-2">
          <div ref={scope} className="sf-inset relative flex flex-1 flex-col items-center rounded-2xl py-2.5">
            <span className="flex items-center gap-1.5 text-2xl font-black tabular-nums">
              <Icon name="coin" size={22} />+{shownCoins}
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
          <div className="sf-inset flex flex-1 flex-col items-center rounded-2xl py-2.5">
            <span className="flex items-center gap-1.5 text-2xl font-black tabular-nums">
              <Icon name="xp" size={20} fill="currentColor" strokeWidth={0} className="text-brand" />+{shownXp}
            </span>
            <span className="text-xs font-extrabold text-muted">XP</span>
          </div>
        </div>

        {nextUnlock && (
          <div className="w-full">
            <Meter value={xp} max={xpRequired(level)} label={`XP to Level ${level + 1}`} className="h-3.5" />
            <p className="mt-1 text-center text-xs font-bold text-muted">
              {xpRequired(level) - xp} XP to Level {level + 1}
              {nextUnlock.level === level + 1 ? ` · unlocks ${nextUnlock.name}` : ""}
            </p>
          </div>
        )}

        {reward.twist && (
          <p className={`text-center text-xs font-extrabold ${reward.twist.achieved ? "text-orange" : "text-muted"}`}>
            {twistOutcome(reward.twist)}
          </p>
        )}

        {offers && onPick ? (
          <div className="mt-1 w-full border-t-2 border-line pt-2.5">
            <OrderBoard offers={offers} onPick={onPick} />
          </div>
        ) : (
          <Button onClick={onNext} className="mt-1 w-full">
            {nextLabel}
          </Button>
        )}
      </motion.div>
    </div>
  );
}
