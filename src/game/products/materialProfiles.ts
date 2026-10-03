import type { BurstOptions } from "@/game/machines/shared";
import type { MaterialProfile, SoundKey } from "@/types/game";

export interface MaterialProfileDefinition {
  id: MaterialProfile;
  /** 0–1: how much the blade "drags" (drives cut sound pitch and trail feel). */
  cutResistance: number;
  cutParticleStyle: NonNullable<BurstOptions["shape"]>;
  cutSoundKey: SoundKey;
  stampSoundKey: SoundKey;
  polishFriction: number;
  /** 0–1 colour of the buffing sound: low is dull and dry, high is bright and glassy. */
  polishTone: number;
  shineIntensity: number;
  /** Surface treatment drawn by ProductBody. */
  colorTreatment: "grain" | "gloss";
  colors: {
    light: string;
    base: string;
    dark: string;
    detail: string;
    particles: string[];
  };
}

export const materialProfiles: Record<MaterialProfile, MaterialProfileDefinition> = {
  wood: {
    id: "wood",
    cutResistance: 0.6,
    cutParticleStyle: "chip",
    cutSoundKey: "cutSliceWood",
    stampSoundKey: "stampThunk",
    polishFriction: 0.7,
    polishTone: 0.25,
    shineIntensity: 0.25,
    colorTreatment: "grain",
    colors: {
      light: "#e9bd84",
      base: "#cf9552",
      dark: "#9c6230",
      detail: "#a9713a",
      particles: ["#e9bd84", "#cf9552", "#f4d9ae"],
    },
  },
  soap: {
    id: "soap",
    cutResistance: 0.25,
    cutParticleStyle: "dot",
    cutSoundKey: "cutSliceSoap",
    stampSoundKey: "stampSoft",
    polishFriction: 0.3,
    polishTone: 0.8,
    shineIntensity: 0.6,
    colorTreatment: "gloss",
    colors: {
      light: "#ffe3f1",
      base: "#f7a8cf",
      dark: "#d2709f",
      detail: "#e68bb8",
      particles: ["#ffe3f1", "#f7a8cf", "#ffffff"],
    },
  },
  ceramic: {
    id: "ceramic",
    cutResistance: 0.8,
    cutParticleStyle: "chip",
    cutSoundKey: "cutSliceWood",
    stampSoundKey: "stampThunk",
    polishFriction: 0.5,
    polishTone: 0.6,
    shineIntensity: 0.7,
    colorTreatment: "gloss",
    colors: {
      light: "#ffffff",
      base: "#e6eef5",
      dark: "#b3c3d1",
      detail: "#c9d6e2",
      particles: ["#ffffff", "#e6eef5"],
    },
  },
  crystal: {
    id: "crystal",
    cutResistance: 0.9,
    cutParticleStyle: "spark",
    cutSoundKey: "cutSliceSoap",
    stampSoundKey: "stampThunk",
    polishFriction: 0.4,
    polishTone: 1,
    shineIntensity: 1,
    colorTreatment: "gloss",
    colors: {
      light: "#e3fbff",
      base: "#8fe3f5",
      dark: "#3fa9c9",
      detail: "#6fd0ea",
      particles: ["#e3fbff", "#8fe3f5", "#ffffff"],
    },
  },
  gold: {
    id: "gold",
    cutResistance: 0.7,
    cutParticleStyle: "spark",
    cutSoundKey: "cutSliceWood",
    stampSoundKey: "stampThunk",
    polishFriction: 0.5,
    polishTone: 0.5,
    shineIntensity: 0.9,
    colorTreatment: "gloss",
    colors: {
      light: "#fff1b0",
      base: "#ffc72c",
      dark: "#c98a0a",
      detail: "#e6a917",
      particles: ["#fff1b0", "#ffc72c", "#ffffff"],
    },
  },
};

/** Golden Products override the material's colours but keep its feel. */
export const goldenColors: MaterialProfileDefinition["colors"] = {
  light: "#fff4bd",
  base: "#ffcf3d",
  dark: "#d4930d",
  detail: "#f0b020",
  particles: ["#fff4bd", "#ffcf3d", "#ffffff", "#ffb300"],
};

export function getMaterialColors(material: MaterialProfile, isGolden: boolean) {
  return isGolden ? goldenColors : materialProfiles[material].colors;
}
