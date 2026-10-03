"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { audio } from "@/audio/audioManager";
import { ResultFeedback } from "@/components/feedback/ResultFeedback";
import { LevelUpOverlay } from "@/components/overlays/LevelUpOverlay";
import { OrderIntro } from "@/components/overlays/OrderIntro";
import { RewardSummaryCard } from "@/components/overlays/RewardSummaryCard";
import { Icon } from "@/components/ui/Icon";
import { machines } from "@/config/machines";
import { products } from "@/config/products";
import { pacing } from "@/config/progression";
import { upgrades } from "@/config/upgrades";
import { getQualityBand } from "@/game/economy/multipliers";
import type { MachineCompletion } from "@/game/machines/shared";
import { deriveProductLook } from "@/game/products/productLook";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import { useRunStore } from "@/stores/runStore";
import { useUiStore } from "@/stores/uiStore";
import type { QualityTier, SoundKey } from "@/types/game";
import { MachineStage } from "./MachineStage";
import { ProductionProgress } from "./ProductionProgress";
import { completeMachine, createOrder, exitMachine, finishProduct } from "./runActions";
import { MACHINE_PHASES } from "./runStateMachine";

const tierSound: Record<QualityTier, SoundKey | null> = {
  perfect: "rewardPerfect",
  excellent: "rewardExcellent",
  good: "rewardGood",
  low: null,
};

/**
 * Drives one production run on screen. It only sequences phases and renders;
 * every payout goes through runActions, which is idempotent, so a re-render,
 * a double click or a timer firing twice can never reward twice.
 */
export function ProductionRunController() {
  const run = useRunStore((s) => s.run);
  const phase = useRunStore((s) => s.phase);
  const feedback = useRunStore((s) => s.feedback);
  const lastReward = useRunStore((s) => s.lastReward);
  const dispatch = useRunStore((s) => s.dispatch);

  const pendingLevelUps = useUiStore((s) => s.pendingLevelUps);
  const clearLevelUps = useUiStore((s) => s.clearLevelUps);
  const showToast = useUiStore((s) => s.showToast);

  const productsCompleted = usePlayerStore((s) => s.totalProductsCompleted);
  const factoryLevel = usePlayerStore((s) => s.factoryLevel);
  const onboarding = useProgressionStore((s) => s.onboarding);
  const setOnboarding = useProgressionStore((s) => s.setOnboarding);
  const materialsLevel = useProgressionStore((s) => s.upgrades.betterMaterials);

  const [celebrating, setCelebrating] = useState(false);

  // What earlier machines did to the product. The active machine's own result is
  // left out: it animates that change itself.
  const results = run?.results;
  const activeIndex = run?.currentMachineIndex ?? 0;
  const look = useMemo(() => deriveProductLook((results ?? []).slice(0, activeIndex)), [results, activeIndex]);

  // There is always an order on the floor.
  useEffect(() => {
    if (!run) createOrder();
  }, [run]);

  /** Leaves the reward summary: celebrate pending level-ups first, then the next order. */
  const advance = useCallback(() => {
    if (useRunStore.getState().phase !== "REWARD_SUMMARY") return;
    if (useUiStore.getState().pendingLevelUps.length > 0) {
      setCelebrating(true);
      audio.play("levelUp");
      return;
    }
    createOrder();
  }, []);

  const continueAfterLevelUp = () => {
    clearLevelUps();
    setCelebrating(false);
    createOrder();
  };

  const runId = run?.id;
  const machineIndex = run?.currentMachineIndex;
  const isGolden = run?.isGolden ?? false;
  const autoAdvance = productsCompleted > pacing.autoAdvanceAfterProducts;
  const firstOrder = productsCompleted === 0;

  // Phase sequencing. Timers are cleared whenever the phase changes or the
  // factory screen is left, and resume from the current phase on return.
  useEffect(() => {
    if (!runId || !phase) return;
    const after = (ms: number, action: () => void) => {
      const timer = window.setTimeout(action, ms);
      return () => window.clearTimeout(timer);
    };

    switch (phase) {
      case "ORDER_INTRO":
        return after(firstOrder || isGolden ? pacing.orderIntroFirstMs : pacing.orderIntroMs, () =>
          dispatch("INTRO_DONE"),
        );
      case "MACHINE_ENTER":
        return after(pacing.machineEnterMs, () => dispatch("ENTER_DONE"));
      case "MACHINE_RESOLVE":
        return after(pacing.machineResolveMs, () => dispatch("SCORE_COMMITTED"));
      case "RESULT_FEEDBACK":
        return after(pacing.resultFeedbackMs, () => dispatch("CONTINUE"));
      case "MACHINE_EXIT":
        return after(pacing.machineExitMs, exitMachine);
      case "PRODUCT_COMPLETE":
        finishProduct();
        return;
      case "REWARD_SUMMARY":
        if (autoAdvance && !celebrating) return after(pacing.rewardSummaryMs, advance);
        return;
    }
  }, [runId, machineIndex, phase, firstOrder, isGolden, autoAdvance, celebrating, dispatch, advance]);

  // A Golden order announces itself.
  useEffect(() => {
    if (runId && isGolden) audio.play("golden");
  }, [runId, isGolden]);

  if (!run || !phase) return null;

  const product = products[run.productId] ?? products.woodBlock;
  const machineId = run.machineSequence[run.currentMachineIndex];
  const machine = machines[machineId];
  const machineVisible = MACHINE_PHASES.includes(phase);
  const interactive = phase === "MACHINE_READY" || phase === "PLAYER_INTERACTION";
  const showingResult = (phase === "MACHINE_RESOLVE" || phase === "RESULT_FEEDBACK") && feedback;

  const handleComplete = (completion: MachineCompletion) => {
    if (!completeMachine(completion)) return;

    const committed = useRunStore.getState().feedback;
    if (!committed) return;
    const sound = tierSound[getQualityBand(committed.quality).tier];
    // Slightly after the machine's own sound so the two do not mask each other.
    if (sound) window.setTimeout(() => audio.play(sound), 130);

    if (committed.streak >= 2 && !onboarding.hasSeenStreakIntro) {
      setOnboarding("hasSeenStreakIntro");
      showToast("Perfect streak! Keep it going for bonus coins.");
    }
  };

  const showHint =
    (machineId === "cutter" && !onboarding.hasCompletedFirstCut) ||
    (machineId === "packager" && !onboarding.hasCompletedFirstPackage);

  return (
    <div className="flex h-full flex-col gap-2">
      <ProductionProgress run={run} phase={phase} />

      <div
        className={`sf-stage relative min-h-0 flex-1 overflow-hidden rounded-3xl transition-shadow duration-300 ${
          run.isGolden ? "sf-stage-golden" : ""
        }`}
        // Result feedback can be tapped away; nothing else on the stage listens for clicks.
        onClick={phase === "RESULT_FEEDBACK" ? () => dispatch("CONTINUE") : undefined}
      >
        <div className="sf-belt absolute inset-x-0 bottom-0 h-3" aria-hidden />

        <div className="absolute inset-x-0 top-0 flex h-11 items-center justify-center gap-2 px-3">
          {run.isGolden && (
            <span className="flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-xs font-black text-navy">
              <Icon name="sparkle" size={12} fill="currentColor" strokeWidth={0} />
              GOLDEN
            </span>
          )}
          <h2 className="text-base font-black tracking-widest text-stage-ink uppercase sm:text-lg">{product.name}</h2>
        </div>

        <div className="sf-machine-slot absolute inset-x-2 top-11 bottom-[4.75rem] flex items-center justify-center sm:inset-x-4">
          {machineVisible && (
            <motion.div
              key={`${run.id}-${run.currentMachineIndex}`}
              className="sf-machine-box"
              initial={{ x: "45%", opacity: 0 }}
              animate={phase === "MACHINE_EXIT" ? { x: "-45%", opacity: 0 } : { x: 0, opacity: 1 }}
              transition={{ duration: 0.3, ease: phase === "MACHINE_EXIT" ? "easeIn" : "easeOut" }}
            >
              <MachineStage
                machineId={machineId}
                runId={run.id}
                product={product}
                material={product.materialProfile}
                isGolden={run.isGolden}
                richness={materialsLevel / upgrades.betterMaterials.maxLevel}
                look={look}
                factoryLevel={factoryLevel}
                active={interactive}
                showHint={showHint}
                onInteractionStart={() => dispatch("INTERACTION_START")}
                onInteractionCancel={() => dispatch("INTERACTION_CANCEL")}
                onComplete={handleComplete}
              />
            </motion.div>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-3 flex h-16 flex-col items-center justify-center px-3 text-center">
          {showingResult ? (
            <ResultFeedback key={`${run.id}-${run.results.length}`} feedback={feedback} />
          ) : (
            machineVisible &&
            phase !== "MACHINE_EXIT" && (
              <>
                <p className="text-[11px] font-black tracking-[0.2em] text-stage-soft uppercase">{machine.name}</p>
                <p className="text-lg font-extrabold text-stage-ink sm:text-xl">{machine.instruction}</p>
              </>
            )
          )}
        </div>

        {phase === "ORDER_INTRO" && <OrderIntro run={run} onSkip={() => dispatch("INTRO_DONE")} />}

        {phase === "REWARD_SUMMARY" && lastReward && !celebrating && (
          <RewardSummaryCard key={lastReward.runId} reward={lastReward} onNext={advance} />
        )}

        {celebrating && <LevelUpOverlay levels={pendingLevelUps} onContinue={continueAfterLevelUp} />}
      </div>
    </div>
  );
}
