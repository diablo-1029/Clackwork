import { create } from "zustand";
import { transition, type RunEvent } from "@/game/core/runStateMachine";
import type { MachineId, MachineResult, ProductionRun, RewardSummary, RunPhase } from "@/types/game";

export interface MachineFeedback {
  machineId: MachineId;
  quality: number;
  xp: number;
  streak: number;
}

interface RunState {
  run: ProductionRun | null;
  phase: RunPhase | null;
  /** Feedback for the most recently committed machine result. */
  feedback: MachineFeedback | null;
  lastReward: RewardSummary | null;

  startRun: (run: ProductionRun) => void;
  /** Applies a state-machine event. Returns false if it is not legal right now. */
  dispatch: (event: RunEvent) => boolean;
  /** Records the active machine's result exactly once. */
  commitMachineResult: (result: MachineResult) => boolean;
  /** Claims the product reward. True only for the first caller. */
  markRewardCommitted: () => boolean;
  setFeedback: (feedback: MachineFeedback | null) => void;
  setLastReward: (reward: RewardSummary | null) => void;
  clear: () => void;
}

const statusFor = (phase: RunPhase): ProductionRun["status"] => {
  switch (phase) {
    case "ORDER_INTRO":
      return "intro";
    case "MACHINE_RESOLVE":
    case "RESULT_FEEDBACK":
    case "MACHINE_EXIT":
      return "resolving";
    case "PRODUCT_COMPLETE":
    case "REWARD_SUMMARY":
      return "complete";
    default:
      return "machine";
  }
};

export const useRunStore = create<RunState>()((set, get) => ({
  run: null,
  phase: null,
  feedback: null,
  lastReward: null,

  startRun: (run) => set({ run, phase: "ORDER_INTRO", feedback: null }),

  dispatch: (event) => {
    const { run, phase } = get();
    if (!run || !phase) return false;
    const next = transition(phase, event);
    if (!next) return false;

    set({
      phase: next,
      run: {
        ...run,
        status: statusFor(next),
        currentMachineIndex:
          event === "EXIT_NEXT" ? run.currentMachineIndex + 1 : run.currentMachineIndex,
      },
    });
    return true;
  },

  commitMachineResult: (result) => {
    const { run, phase } = get();
    if (!run || phase !== "PLAYER_INTERACTION") return false;
    // One result per machine slot, and only for the machine that is actually active.
    if (run.results.length !== run.currentMachineIndex) return false;
    if (run.machineSequence[run.currentMachineIndex] !== result.machineId) return false;

    set({
      phase: "MACHINE_RESOLVE",
      run: { ...run, status: "resolving", results: [...run.results, result] },
    });
    return true;
  },

  markRewardCommitted: () => {
    const { run, phase } = get();
    if (!run || phase !== "PRODUCT_COMPLETE" || run.rewardCommitted) return false;
    if (run.results.length !== run.machineSequence.length) return false;
    set({ run: { ...run, rewardCommitted: true } });
    return true;
  },

  setFeedback: (feedback) => set({ feedback }),
  setLastReward: (lastReward) => set({ lastReward }),
  clear: () => set({ run: null, phase: null, feedback: null, lastReward: null }),
}));
