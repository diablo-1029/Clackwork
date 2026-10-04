import type { ThemeId } from "./game";

export interface AudioSettings {
  masterEnabled: boolean;
  masterVolume: number;
  musicEnabled: boolean;
  musicVolume: number;
  sfxEnabled: boolean;
  sfxVolume: number;
}

export type ThemeMode = "light" | "dark" | "system";
export type ParticleDensity = "low" | "medium" | "high";

export interface GameSettings {
  themeMode: ThemeMode;
  selectedFactoryTheme: ThemeId;
  audio: AudioSettings;
  reducedMotion: boolean;
  particleDensity: ParticleDensity;
  /** Short vibrations on phones that support them. */
  vibration: boolean;
}
