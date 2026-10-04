"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { audio } from "@/audio/audioManager";
import { OrderValueChip } from "@/components/counters/OrderValueChip";
import { ResultFeedback } from "@/components/feedback/ResultFeedback";
import { LevelUpOverlay } from "@/components/overlays/LevelUpOverlay";
import { OrderBoard } from "@/components/overlays/OrderBoard";
import { OrderIntro } from "@/components/overlays/OrderIntro";
import { RewardSummaryCard } from "@/components/overlays/RewardSummaryCard";
import { Icon } from "@/components/ui/Icon";
import { machines } from "@/config/machines";
import { products } from "@/config/products";
import { pacing } from "@/config/progression";
import { upgrades } from "@/config/upgrades";
import { getQualityBand } from "@/game/economy/multipliers";
import type { MachineCompletion } from "@/game/machines/shared";
import { machineVariants, pickVariant } from "@/game/machines/variants";
import { deriveProductLook } from "@/game/products/productLook";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import { useRunStore } from "@/stores/runStore";
import { useUiStore } from "@/stores/uiStore";
import type { QualityTier, SoundKey } from "@/types/game";
import { MachineStage } from "./MachineStage";
import { ProductionProgress } from "./ProductionProgress";
import { isFeatureUnlocked } from "@/game/progression/unlocks";
import type { OrderOffer } from "@/types/game";
import { describeTwist } from "./orders";
import { projectOrderValue } from "./RewardResolver";
import { completeMachine, createOrder, ensureOffers, exitMachine, finishProduct, isOrderBoardUnlocked } from "./runActions";
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
  const forcedVariant = useUiStore((s) => s.debug.variantIndex);
  const offers = useUiStore((s) => s.offers);

  const productsCompleted = usePlayerStore((s) => s.totalProductsCompleted);
  const factoryLevel = usePlayerStore((s) => s.factoryLevel);
  const onboarding = useProgressionStore((s) => s.onboarding);
  const setOnboarding = useProgressionStore((s) => s.setOnboarding);
  const upgradeLevels = useProgressionStore((s) => s.upgrades);
  const materialsLevel = upgradeLevels.betterMaterials;
  const streak = usePlayerStore((s) => s.perfectStreak);

  const [celebrating, setCelebrating] = useState(false);
  /** The run whose summary has been dismissed, leaving only the order board on screen. */
  const [boardOnlyFor, setBoardOnlyFor] = useState<string | null>(null);
  // Once unlocked, the player picks each order from the board instead of being handed one.
  const boardUnlocked = isFeatureUnlocked("orderBoard", factoryLevel);

  // What earlier machines did to the product. The active machine's own result is
  // left out: it animates that change itself.
  const results = run?.results;
  const activeIndex = run?.currentMachineIndex ?? 0;
  const look = useMemo(() => deriveProductLook((results ?? []).slice(0, activeIndex)), [results, activeIndex]);

  const runId = run?.id;

  // Before the board unlocks there is always an order on the floor.
  useEffect(() => {
    if (!run && !boardUnlocked) createOrder();
  }, [run, boardUnlocked]);

  // With the board, deal cards whenever an order is needed. Level-ups are
  // celebrated first, so a product unlocked just now can be on the board.
  const awaitingChoice = !run || phase === "REWARD_SUMMARY";
  useEffect(() => {
    if (boardUnlocked && awaitingChoice && !celebrating && pendingLevelUps.length === 0) ensureOffers();
  }, [boardUnlocked, awaitingChoice, celebrating, pendingLevelUps.length, runId]);

  /** Leaves the reward summary: celebrate pending level-ups first, then the next order. */
  const advance = useCallback(() => {
    if (useRunStore.getState().phase !== "REWARD_SUMMARY") return;
    if (useUiStore.getState().pendingLevelUps.length > 0) {
      setCelebrating(true);
      audio.play("levelUp");
      return;
    }
    // With the board unlocked, the next order starts when a card is picked.
    if (!isOrderBoardUnlocked()) createOrder();
  }, []);

  const continueAfterLevelUp = () => {
    clearLevelUps();
    setCelebrating(false);
    if (isOrderBoardUnlocked()) setBoardOnlyFor(useRunStore.getState().run?.id ?? null);
    else createOrder();
  };

  const pickOffer = (offer: OrderOffer) => {
    createOrder(offer);
  };

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
        // An order picked from the board needs no introduction.
        if (boardUnlocked) return after(0, () => dispatch("INTRO_DONE"));
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
        // Choosing a card needs a tap, so nothing advances by itself once the board is unlocked.
        if (autoAdvance && !celebrating && !boardUnlocked) return after(pacing.rewardSummaryMs, advance);
        return;
    }
  }, [runId, machineIndex, phase, firstOrder, isGolden, autoAdvance, celebrating, boardUnlocked, dispatch, advance]);

  // A Golden order announces itself.
  useEffect(() => {
    if (runId && isGolden) audio.play("golden");
  }, [runId, isGolden]);

  const boardPanel = (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-3xl bg-surface p-5 text-ink shadow-xl"
      >
        <OrderBoard offers={offers} onPick={pickOffer} />
      </motion.div>
    </div>
  );

  if (!run || !phase) {
    // No order yet this session: with the board unlocked, the player picks the first one.
    if (!boardUnlocked) return null;
    return (
      <div className="sf-stage relative h-full overflow-hidden rounded-3xl">
        <div className="sf-belt absolute inset-x-0 bottom-0 h-3" aria-hidden />
        {/* Levels gained outside an order are celebrated before the cards are dealt. */}
        {pendingLevelUps.length > 0 ? (
          <LevelUpOverlay levels={pendingLevelUps} onContinue={clearLevelUps} />
        ) : (
          offers.length > 0 && boardPanel
        )}
      </div>
    );
  }

  const product = products[run.productId] ?? products.woodBlock;
  const machineId = run.machineSequence[run.currentMachineIndex];
  const machine = machines[machineId];
  const stepLabel = product.stepLabels?.[run.currentMachineIndex] ?? null;
  const machineVisible = MACHINE_PHASES.includes(phase);
  const interactive = phase === "MACHINE_READY" || phase === "PLAYER_INTERACTION";
  const showingResult = (phase === "MACHINE_RESOLVE" || phase === "RESULT_FEEDBACK") && feedback;
  const perfectPulse = showingResult && feedback.quality >= 100;
  // Once paid, show exactly what was paid; until then, what the order is worth so far.
  const orderValue =
    phase === "REWARD_SUMMARY" && lastReward?.runId === run.id
      ? lastReward.coins
      : projectOrderValue({
          product,
          results: run.results,
          streak,
          upgradeLevels,
          isGolden: run.isGolden,
          twist: run.twist,
        });
  const levelUpsPending = pendingLevelUps.length > 0;

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
  // How the machine plays this time. A machine keeps the variant it was mounted with.
  const variants = machineVariants[machineId];
  const variant =
    forcedVariant === null
      ? pickVariant(machineId, run.id, run.currentMachineIndex, factoryLevel, showHint)
      : variants[Math.min(forcedVariant, variants.length - 1)];
  const instruction = product.stepHints?.[run.currentMachineIndex] ?? variant.instruction ?? machine.instruction;

  return (
    <div className="flex h-full flex-col gap-2">
      <ProductionProgress run={run} phase={phase} />

      <div
        className={`sf-stage relative min-h-0 flex-1 overflow-hidden rounded-3xl transition-shadow duration-300 ${
          run.isGolden ? "sf-stage-golden" : ""
        } ${perfectPulse ? "sf-stage-perfect" : ""}`}
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
          {phase !== "ORDER_INTRO" && <OrderValueChip value={orderValue} />}
          {run.twist && (
            <span className="rounded-full bg-orange px-2 py-0.5 text-xs font-black text-navy uppercase" title={describeTwist(run.twist).rule}>
              {describeTwist(run.twist).name}
            </span>
          )}
        </div>

        <div className="sf-machine-slot absolute inset-x-2 top-11 bottom-[4.75rem] flex items-center justify-center sm:inset-x-4 lg:bottom-[4.25rem]">
          {machineVisible && (
            <motion.div
              key={`${run.id}-${run.currentMachineIndex}`}
              className="sf-machine-box"
              // A short arrival so the machine is under the finger almost at once.
              initial={{ x: "16%", opacity: 0 }}
              animate={phase === "MACHINE_EXIT" ? { x: "-45%", opacity: 0 } : { x: 0, opacity: 1 }}
              transition={
                phase === "MACHINE_EXIT" ? { duration: 0.3, ease: "easeIn" } : { duration: 0.2, ease: "easeOut" }
              }
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
                variant={variant.id}
                step={run.machineSequence.slice(0, run.currentMachineIndex).filter((id) => id === machineId).length}
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
                <p className="text-[11px] font-black tracking-[0.2em] text-stage-soft uppercase">
                  {machine.name}
                  {stepLabel && ` · ${stepLabel}`}
                </p>
                <p className="text-lg font-extrabold text-stage-ink sm:text-xl">{instruction}</p>
              </>
            )
          )}
        </div>

        {phase === "ORDER_INTRO" && !boardUnlocked && <OrderIntro run={run} onSkip={() => dispatch("INTRO_DONE")} />}

        {phase === "REWARD_SUMMARY" &&
          lastReward &&
          !celebrating &&
          (boardOnlyFor === run.id ? (
            boardPanel
          ) : (
            <RewardSummaryCard
              key={lastReward.runId}
              reward={lastReward}
              onNext={advance}
              nextLabel={levelUpsPending ? "Continue" : "Next Order"}
              // Level-ups are celebrated before the cards appear.
              offers={boardUnlocked && !levelUpsPending ? offers : undefined}
              onPick={pickOffer}
            />
          ))}

        {celebrating && <LevelUpOverlay levels={pendingLevelUps} onContinue={continueAfterLevelUp} />}
      </div>
    </div>
  );
}
