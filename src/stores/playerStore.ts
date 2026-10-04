import { create } from "zustand";
import { emptyFever, type FeverState } from "@/game/economy/fever";
import { applyXp } from "@/game/progression/levels";
import type { SaveDataCurrent } from "@/types/save";

type PlayerData = SaveDataCurrent["player"];

interface PlayerState extends PlayerData {
  addCoins: (amount: number) => void;
  /** Returns false (and changes nothing) if the player cannot afford it. */
  spendCoins: (amount: number) => boolean;
  /** Returns every level reached by this gain. */
  addXp: (amount: number) => number[];
  setLevel: (level: number) => void;
  setStreak: (streak: number) => void;
  setFever: (fever: FeverState) => void;
  incrementPerfect: () => void;
  incrementProducts: () => void;
  hydrate: (data: PlayerData) => void;
}

export const initialPlayer: PlayerData = {
  coins: 0,
  xp: 0,
  factoryLevel: 1,
  perfectStreak: 0,
  totalProductsCompleted: 0,
  totalPerfects: 0,
  fever: { ...emptyFever },
};

export const usePlayerStore = create<PlayerState>()((set, get) => ({
  ...initialPlayer,

  addCoins: (amount) => {
    if (!(amount > 0)) return;
    set((s) => ({ coins: s.coins + Math.floor(amount) }));
  },

  spendCoins: (amount) => {
    if (!(amount >= 0) || get().coins < amount) return false;
    set((s) => ({ coins: s.coins - amount }));
    return true;
  },

  addXp: (amount) => {
    if (!(amount > 0)) return [];
    const { factoryLevel, xp } = get();
    const gain = applyXp(factoryLevel, xp, amount);
    set({ factoryLevel: gain.level, xp: gain.xp });
    return gain.levelsGained;
  },

  setLevel: (level) => set({ factoryLevel: Math.max(1, Math.floor(level)), xp: 0 }),
  setStreak: (streak) => set({ perfectStreak: Math.max(0, Math.floor(streak)) }),
  setFever: (fever) => set({ fever }),
  incrementPerfect: () => set((s) => ({ totalPerfects: s.totalPerfects + 1 })),
  incrementProducts: () => set((s) => ({ totalProductsCompleted: s.totalProductsCompleted + 1 })),
  hydrate: (data) => set({ ...data }),
}));
