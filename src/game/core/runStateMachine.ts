import type { RunPhase } from "@/types/game";

export type RunEvent =
  | "INTRO_DONE"
  | "ENTER_DONE"
  | "INTERACTION_START"
  | "INTERACTION_CANCEL"
  | "INTERACTION_COMPLETE"
  | "SCORE_COMMITTED"
  | "CONTINUE"
  | "EXIT_NEXT"
  | "EXIT_FINAL"
  | "REWARD_RESOLVED";

/**
 * The only legal moves through a production run. Anything not listed here is
 * ignored, which is what makes duplicate callbacks and double clicks harmless.
 */
const transitions: Record<RunPhase, Partial<Record<RunEvent, RunPhase>>> = {
  ORDER_INTRO: { INTRO_DONE: "MACHINE_ENTER" },
  MACHINE_ENTER: { ENTER_DONE: "MACHINE_READY" },
  MACHINE_READY: { INTERACTION_START: "PLAYER_INTERACTION" },
  PLAYER_INTERACTION: {
    INTERACTION_COMPLETE: "MACHINE_RESOLVE",
    INTERACTION_CANCEL: "MACHINE_READY",
  },
  MACHINE_RESOLVE: { SCORE_COMMITTED: "RESULT_FEEDBACK" },
  RESULT_FEEDBACK: { CONTINUE: "MACHINE_EXIT" },
  MACHINE_EXIT: { EXIT_NEXT: "MACHINE_ENTER", EXIT_FINAL: "PRODUCT_COMPLETE" },
  PRODUCT_COMPLETE: { REWARD_RESOLVED: "REWARD_SUMMARY" },
  REWARD_SUMMARY: {},
};

/** Returns the next phase, or null when the event is not valid in this phase. */
export function transition(phase: RunPhase, event: RunEvent): RunPhase | null {
  return transitions[phase][event] ?? null;
}

/** Phases during which the active machine is on screen. */
export const MACHINE_PHASES: readonly RunPhase[] = [
  "MACHINE_ENTER",
  "MACHINE_READY",
  "PLAYER_INTERACTION",
  "MACHINE_RESOLVE",
  "RESULT_FEEDBACK",
  "MACHINE_EXIT",
];
