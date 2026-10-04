"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { audio } from "@/audio/audioManager";
import { Button } from "@/components/ui/Button";
import { Chip, Panel } from "@/components/ui/Chunky";
import { Icon } from "@/components/ui/Icon";
import { productList } from "@/config/products";
import { finishedLook } from "@/game/products/productLook";
import { ProductIcon } from "@/game/products/ProductRenderer";
import { getNextUnlock, isProductPlayable } from "@/game/progression/unlocks";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import { useUiStore } from "@/stores/uiStore";

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

/** One tap to play. The same tap unlocks audio, which browsers require. */
export function StartScreen() {
  const level = usePlayerStore((s) => s.factoryLevel);
  const coins = usePlayerStore((s) => s.coins);
  const made = usePlayerStore((s) => s.totalProductsCompleted);
  const perfects = usePlayerStore((s) => s.totalPerfects);
  const unlocked = useProgressionStore((s) => s.products);
  const returning = useProgressionStore((s) => s.onboarding.hasStarted);
  const setOnboarding = useProgressionStore((s) => s.setOnboarding);
  const startSession = useUiStore((s) => s.startSession);
  const nextUnlock = getNextUnlock(level);
  const lineup = productList.filter(isProductPlayable);

  const start = () => {
    audio.unlock();
    audio.play("uiClick");
    setOnboarding("hasStarted");
    startSession();
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto p-4 text-center">
      <h2
        className="text-4xl leading-none font-black tracking-tight text-stage-ink sm:text-6xl"
        // A halo of the wall colour keeps the name clear of the scenery behind it.
        style={{ textShadow: "0 0 14px var(--fx-stage-a), 0 0 4px var(--fx-stage-a), 0 3px 0 var(--fx-grid)" }}
      >
        CLACKWORK
      </h2>

      {/* Everything the factory makes, riding the belt. Products still to unlock stay grey. */}
      <div className="w-full max-w-md" aria-hidden>
        <div className="flex items-end justify-center gap-2 px-2 sm:gap-3">
          {lineup.map((product, index) => (
            <motion.div
              key={product.id}
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: index * 0.18 }}
            >
              <ProductIcon
                material={product.materialProfile}
                look={finishedLook(product)}
                size={46}
                locked={!unlocked.includes(product.id)}
              />
            </motion.div>
          ))}
        </div>
        <div className="sf-belt mt-1 h-3.5 rounded-full" />
      </div>

      <Panel className="flex w-full max-w-md flex-col gap-3 p-3 text-ink sm:p-4">
        <div className="flex gap-2">
          <Stat
            icon={<Icon name="xp" size={17} fill="currentColor" strokeWidth={0} className="text-brand" />}
            value={String(level)}
            label="Level"
          />
          <Stat icon={<Icon name="coin" size={18} />} value={coins.toLocaleString("en-US")} label="Coins" />
          <Stat
            icon={<Icon name="product" size={17} className="text-brand-deep" />}
            value={made.toLocaleString("en-US")}
            label="Made"
          />
          <Stat
            icon={<Icon name="sparkle" size={16} fill="currentColor" strokeWidth={0} className="text-orange" />}
            value={perfects.toLocaleString("en-US")}
            label="Perfects"
          />
        </div>

        {nextUnlock && (
          <Chip tone="blue" className="justify-center py-1.5 text-ink">
            <Icon name="lock" size={14} />
            Next: {nextUnlock.name} at Level {nextUnlock.level}
          </Chip>
        )}

        <p className="text-base font-extrabold">{returning ? "Your next order is ready." : "Your first order is ready."}</p>

        <Button silent onClick={start} className="w-full text-lg">
          {returning ? "Continue Production" : "Start Production"}
        </Button>
      </Panel>
    </div>
  );
}
