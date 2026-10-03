import { create } from "zustand";
import type { ThemeId } from "@/types/game";
import type { AudioSettings, GameSettings, ParticleDensity, ThemeMode } from "@/types/settings";

interface SettingsState extends GameSettings {
  setThemeMode: (mode: ThemeMode) => void;
  setFactoryTheme: (id: ThemeId) => void;
  setAudio: (patch: Partial<AudioSettings>) => void;
  setReducedMotion: (value: boolean) => void;
  setParticleDensity: (value: ParticleDensity) => void;
  hydrate: (data: GameSettings) => void;
}

export const initialSettings: GameSettings = {
  themeMode: "system",
  selectedFactoryTheme: "defaultFactory",
  audio: {
    masterEnabled: true,
    masterVolume: 0.8,
    musicEnabled: false,
    musicVolume: 0.5,
    sfxEnabled: true,
    sfxVolume: 0.9,
  },
  reducedMotion: false,
  particleDensity: "medium",
};

export const useSettingsStore = create<SettingsState>()((set) => ({
  ...initialSettings,
  setThemeMode: (themeMode) => set({ themeMode }),
  setFactoryTheme: (selectedFactoryTheme) => set({ selectedFactoryTheme }),
  setAudio: (patch) => set((s) => ({ audio: { ...s.audio, ...patch } })),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setParticleDensity: (particleDensity) => set({ particleDensity }),
  hydrate: (data) => set({ ...data }),
}));
