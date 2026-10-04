import { create } from "zustand";
import type { ShiftState, ShiftSummary } from "@/game/core/shift";

/** The shift in progress and the summary of the last one. Not saved: a reload ends the shift. */
interface ShiftStore {
  shift: ShiftState | null;
  summary: ShiftSummary | null;
  setShift: (shift: ShiftState | null) => void;
  update: (change: (shift: ShiftState) => ShiftState) => void;
  setSummary: (summary: ShiftSummary | null) => void;
  reset: () => void;
}

export const useShiftStore = create<ShiftStore>()((set) => ({
  shift: null,
  summary: null,
  setShift: (shift) => set({ shift }),
  update: (change) =>
    set((s) => {
      if (!s.shift) return s;
      const next = change(s.shift);
      return next === s.shift ? s : { shift: next };
    }),
  setSummary: (summary) => set({ summary }),
  reset: () => set({ shift: null, summary: null }),
}));
