"use client";

import { motion } from "framer-motion";
import { audio } from "@/audio/audioManager";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ProductIcon } from "@/game/products/ProductRenderer";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import { useUiStore } from "@/stores/uiStore";

/** One tap to play. The same tap unlocks audio, which browsers require. */
export function StartScreen() {
  const level = usePlayerStore((s) => s.factoryLevel);
  const coins = usePlayerStore((s) => s.coins);
  const returning = useProgressionStore((s) => s.onboarding.hasStarted);
  const setOnboarding = useProgressionStore((s) => s.setOnboarding);
  const startSession = useUiStore((s) => s.startSession);

  const start = () => {
    audio.unlock();
    audio.play("uiClick");
    setOnboarding("hasStarted");
    startSession();
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center">
      <motion.div
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      >
        <ProductIcon material="wood" size={112} />
      </motion.div>

      <div>
        <h2 className="text-3xl leading-tight font-black tracking-tight text-stage-ink sm:text-5xl">
          SATISFYING FACTORY
        </h2>
        <p className="mt-3 flex items-center justify-center gap-4 text-sm font-extrabold text-stage-soft sm:text-base">
          <span>Factory Level {level}</span>
          <span className="flex items-center gap-1.5">
            <Icon name="coin" size={18} />
            {coins.toLocaleString("en-US")}
          </span>
        </p>
      </div>

      <p className="text-base font-bold text-stage-ink sm:text-lg">
        {returning ? "Your next order is ready." : "Your first order is ready."}
      </p>

      <Button silent onClick={start} className="px-8 text-lg">
        {returning ? "Continue Production" : "Start Production"}
      </Button>
    </div>
  );
}
