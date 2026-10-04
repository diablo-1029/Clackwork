import { writeDebugAccess } from "@/lib/debugAccess";
import { create } from "zustand";
import type { OrderOffer, ProductId } from "@/types/game";

/** How the factory is being played: against the clock, or untimed with the order board. */
export type PlayMode = "shift" | "free";

export type Screen = "factory" | "goals" | "products" | "upgrades" | "themes" | "settings";

interface UiState {
  /** True once the save has been loaded on the client. */
  hydrated: boolean;
  /** True once the player has pressed Start this session (also unlocks audio). */
  sessionStarted: boolean;
  mode: PlayMode;
  screen: Screen;
  /** Levels reached but not yet celebrated; shown as one grouped panel. */
  pendingLevelUps: number[];
  /** Newly unlocked products that should arrive as the very next orders. */
  queuedProducts: ProductId[];
  /** The cards currently on the order board. Kept until one is picked, so they never reshuffle. */
  offers: OrderOffer[];
  /** Rerolls spent on the current board. */
  rerollsUsed: number;
  toast: { id: number; message: string } | null;
  /** The hidden debug tools in Settings are switched on (see lib/debugAccess). */
  debugTools: boolean;
  debug: {
    goldenNext: boolean;
    qualityOverride: number | null;
    stressBursts: number;
    /** Forces every machine to its nth variant (0 = basic), ignoring levels. Null plays normally. */
    variantIndex: number | null;
  };

  setHydrated: () => void;
  startSession: () => void;
  /** Back to the start screen, keeping whatever is on the floor. */
  endSession: () => void;
  setMode: (mode: PlayMode) => void;
  setScreen: (screen: Screen) => void;
  queueLevelUps: (levels: number[]) => void;
  clearLevelUps: () => void;
  queueProducts: (ids: ProductId[]) => void;
  shiftQueuedProduct: () => ProductId | undefined;
  /** Deals a board. A reroll counts against the board it replaces; a fresh deal starts the count again. */
  setOffers: (offers: OrderOffer[], reroll?: boolean) => void;
  showToast: (message: string) => void;
  /** Switches the hidden debug tools on or off and remembers it on this device. */
  toggleDebugTools: () => void;
  clearToast: (id: number) => void;
  setDebug: (patch: Partial<UiState["debug"]>) => void;
  reset: () => void;
}

let toastId = 0;

export const useUiStore = create<UiState>()((set, get) => ({
  hydrated: false,
  sessionStarted: false,
  mode: "shift",
  screen: "factory",
  pendingLevelUps: [],
  queuedProducts: [],
  offers: [],
  rerollsUsed: 0,
  toast: null,
  debugTools: false,
  debug: { goldenNext: false, qualityOverride: null, stressBursts: 0, variantIndex: null },

  setHydrated: () => set({ hydrated: true }),
  startSession: () => set({ sessionStarted: true }),
  endSession: () => set({ sessionStarted: false }),
  setMode: (mode) => set({ mode }),
  setScreen: (screen) => set({ screen }),
  queueLevelUps: (levels) => set((s) => ({ pendingLevelUps: [...s.pendingLevelUps, ...levels] })),
  clearLevelUps: () => set({ pendingLevelUps: [] }),
  queueProducts: (ids) => set((s) => ({ queuedProducts: [...s.queuedProducts, ...ids] })),
  shiftQueuedProduct: () => {
    const [next, ...rest] = get().queuedProducts;
    if (next) set({ queuedProducts: rest });
    return next;
  },
  setOffers: (offers, reroll = false) => set((s) => ({ offers, rerollsUsed: reroll ? s.rerollsUsed + 1 : 0 })),
  showToast: (message) => set({ toast: { id: ++toastId, message } }),
  toggleDebugTools: () => {
    const debugTools = !get().debugTools;
    writeDebugAccess(debugTools);
    set({ debugTools, toast: { id: ++toastId, message: debugTools ? "Debug tools on" : "Debug tools off" } });
  },
  clearToast: (id) => set((s) => (s.toast?.id === id ? { toast: null } : s)),
  setDebug: (patch) => set((s) => ({ debug: { ...s.debug, ...patch } })),
  reset: () =>
    set({
      sessionStarted: false,
      mode: "shift",
      screen: "factory",
      pendingLevelUps: [],
      queuedProducts: [],
      offers: [],
      rerollsUsed: 0,
      debug: { goldenNext: false, qualityOverride: null, stressBursts: 0, variantIndex: null },
    }),
}));
