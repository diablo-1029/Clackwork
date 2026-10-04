import { create } from "zustand";
import type { OrderOffer, ProductId } from "@/types/game";

export type Screen = "factory" | "goals" | "products" | "upgrades" | "themes" | "settings";

interface UiState {
  /** True once the save has been loaded on the client. */
  hydrated: boolean;
  /** True once the player has pressed Start this session (also unlocks audio). */
  sessionStarted: boolean;
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
  debug: {
    goldenNext: boolean;
    qualityOverride: number | null;
    stressBursts: number;
    /** Forces every machine to its nth variant (0 = basic), ignoring levels. Null plays normally. */
    variantIndex: number | null;
  };

  setHydrated: () => void;
  startSession: () => void;
  setScreen: (screen: Screen) => void;
  queueLevelUps: (levels: number[]) => void;
  clearLevelUps: () => void;
  queueProducts: (ids: ProductId[]) => void;
  shiftQueuedProduct: () => ProductId | undefined;
  /** Deals a board. A reroll counts against the board it replaces; a fresh deal starts the count again. */
  setOffers: (offers: OrderOffer[], reroll?: boolean) => void;
  showToast: (message: string) => void;
  clearToast: (id: number) => void;
  setDebug: (patch: Partial<UiState["debug"]>) => void;
  reset: () => void;
}

let toastId = 0;

export const useUiStore = create<UiState>()((set, get) => ({
  hydrated: false,
  sessionStarted: false,
  screen: "factory",
  pendingLevelUps: [],
  queuedProducts: [],
  offers: [],
  rerollsUsed: 0,
  toast: null,
  debug: { goldenNext: false, qualityOverride: null, stressBursts: 0, variantIndex: null },

  setHydrated: () => set({ hydrated: true }),
  startSession: () => set({ sessionStarted: true }),
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
  clearToast: (id) => set((s) => (s.toast?.id === id ? { toast: null } : s)),
  setDebug: (patch) => set((s) => ({ debug: { ...s.debug, ...patch } })),
  reset: () =>
    set({
      sessionStarted: false,
      screen: "factory",
      pendingLevelUps: [],
      queuedProducts: [],
      offers: [],
      rerollsUsed: 0,
      debug: { goldenNext: false, qualityOverride: null, stressBursts: 0, variantIndex: null },
    }),
}));
