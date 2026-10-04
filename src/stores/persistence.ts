import { devLog } from "@/lib/analytics";
import {
  clearSave,
  createFreshSave,
  loadSave,
  writeSave,
  type LoadStatus,
} from "@/lib/storage/saveService";
import type { SaveDataCurrent } from "@/types/save";
import { useGoalsStore } from "./goalsStore";
import { usePlayerStore } from "./playerStore";
import { useProgressionStore } from "./progressionStore";
import { useRunStore } from "./runStore";
import { useSettingsStore } from "./settingsStore";
import { useShiftStore } from "./shiftStore";
import { useUiStore } from "./uiStore";

let createdAt = new Date().toISOString();
let initialised = false;
let saveQueued = false;

export function buildSave(): SaveDataCurrent {
  const player = usePlayerStore.getState();
  const progression = useProgressionStore.getState();
  const settings = useSettingsStore.getState();
  const goals = useGoalsStore.getState();

  return {
    schemaVersion: 1,
    player: {
      coins: player.coins,
      xp: player.xp,
      factoryLevel: player.factoryLevel,
      perfectStreak: player.perfectStreak,
      totalProductsCompleted: player.totalProductsCompleted,
      totalPerfects: player.totalPerfects,
      fever: player.fever,
    },
    unlocks: {
      machines: progression.machines,
      products: progression.products,
      themes: progression.themes,
    },
    upgrades: progression.upgrades,
    settings: {
      themeMode: settings.themeMode,
      selectedFactoryTheme: settings.selectedFactoryTheme,
      audio: settings.audio,
      reducedMotion: settings.reducedMotion,
      particleDensity: settings.particleDensity,
    },
    onboarding: progression.onboarding,
    goals: goals.goals,
    achievements: goals.achievements,
    stats: goals.stats,
    meta: { createdAt, updatedAt: new Date().toISOString() },
  };
}

export function hydrateStores(save: SaveDataCurrent): void {
  createdAt = save.meta.createdAt;
  usePlayerStore.getState().hydrate(save.player);
  useProgressionStore.getState().hydrate({
    machines: save.unlocks.machines,
    products: save.unlocks.products,
    themes: save.unlocks.themes,
    upgrades: save.upgrades,
    onboarding: save.onboarding,
  });
  useSettingsStore.getState().hydrate(save.settings);
  useGoalsStore.getState().hydrate({ goals: save.goals, achievements: save.achievements, stats: save.stats });
}

export function saveNow(): void {
  if (writeSave(buildSave())) devLog("Save", "persisted schema=1");
}

/**
 * The persisted stores only change on consequential events (rewards, purchases,
 * unlocks, settings), never per pointer move, so saving on change is safe.
 * Changes within one tick collapse into a single write.
 */
function queueSave(): void {
  if (saveQueued) return;
  saveQueued = true;
  queueMicrotask(() => {
    saveQueued = false;
    saveNow();
  });
}

/** Loads the save into the stores and starts persisting changes. Idempotent. */
export function initPersistence(): LoadStatus {
  if (initialised) return "loaded";
  initialised = true;

  const { data, status } = loadSave();
  hydrateStores(data);

  usePlayerStore.subscribe(queueSave);
  useProgressionStore.subscribe(queueSave);
  useSettingsStore.subscribe(queueSave);
  useGoalsStore.subscribe(queueSave);

  useUiStore.getState().setHydrated();
  devLog("Save", `load status=${status}`);
  return status;
}

/** Wipes all progress and returns to the start screen. */
export function resetGame(): void {
  clearSave();
  useRunStore.getState().clear();
  useShiftStore.getState().reset();
  useUiStore.getState().reset();
  hydrateStores(createFreshSave());
}
