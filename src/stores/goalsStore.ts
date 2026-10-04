import { create } from "zustand";
import { emptyStats, type FactoryStats } from "@/game/progression/achievements";
import { emptyGoals, type DailyGoals } from "@/game/progression/goals";

interface GoalsData {
  goals: DailyGoals;
  /** Ids of achievements already earned and paid. */
  achievements: string[];
  stats: FactoryStats;
}

interface GoalsState extends GoalsData {
  /** Goals and achievements completed since the Goals screen was last opened. Not saved. */
  unseen: number;
  setGoals: (goals: DailyGoals) => void;
  setStats: (stats: FactoryStats) => void;
  addAchievements: (ids: string[]) => void;
  addUnseen: (count: number) => void;
  clearUnseen: () => void;
  hydrate: (data: GoalsData) => void;
}

export const initialGoals: GoalsData = { goals: { ...emptyGoals }, achievements: [], stats: { ...emptyStats } };

export const useGoalsStore = create<GoalsState>()((set) => ({
  ...initialGoals,
  unseen: 0,

  setGoals: (goals) => set({ goals }),
  setStats: (stats) => set({ stats }),
  addAchievements: (ids) => set((s) => ({ achievements: [...s.achievements, ...ids.filter((id) => !s.achievements.includes(id))] })),
  addUnseen: (count) => set((s) => ({ unseen: s.unseen + Math.max(0, count) })),
  clearUnseen: () => set((s) => (s.unseen === 0 ? s : { unseen: 0 })),
  hydrate: (data) => set({ ...data, unseen: 0 }),
}));
