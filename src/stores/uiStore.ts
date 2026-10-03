import { create } from "zustand";
import type { ProductId } from "@/types/game";

export type Screen = "factory" | "products" | "upgrades" | "themes" | "settings";

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
  showToast: (message) => set({ toast: { id: ++toastId, message } }),
  clearToast: (id) => set((s) => (s.toast?.id === id ? { toast: null } : s)),
  setDebug: (patch) => set((s) => ({ debug: { ...s.debug, ...patch } })),
  reset: () =>
    set({
      sessionStarted: false,
      screen: "factory",
      pendingLevelUps: [],
      queuedProducts: [],
      debug: { goldenNext: false, qualityOverride: null, stressBursts: 0, variantIndex: null },
    }),
}));
