import { upgrades } from "@/config/upgrades";
import { machinesUnlockedAt, productsUnlockedAt } from "@/game/progression/unlocks";
import { xpRequired } from "@/game/progression/levels";
import { SaveEnvelopeSchema, SaveSchemaV1 } from "@/lib/validation/saveSchema";
import type { SaveDataCurrent, SaveDataV1 } from "@/types/save";

export const SAVE_KEY = "satisfying-factory-save";
const CORRUPT_BACKUP_KEY = "satisfying-factory-save-corrupt";

export type LoadStatus = "fresh" | "loaded" | "corrupt" | "unavailable";

export interface LoadResult {
  data: SaveDataCurrent;
  status: LoadStatus;
}

/** Minimal slice of the Storage API so tests can pass a fake. */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The raw text of the last save that failed validation, kept for debugging. */
let lastCorruptRaw: string | null = null;
export const getLastCorruptRaw = () => lastCorruptRaw;

export function getBrowserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = "__sf_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function createFreshSave(now: Date = new Date()): SaveDataCurrent {
  const timestamp = now.toISOString();
  return {
    schemaVersion: 1,
    player: {
      coins: 0,
      xp: 0,
      factoryLevel: 1,
      perfectStreak: 0,
      totalProductsCompleted: 0,
      totalPerfects: 0,
    },
    unlocks: {
      machines: machinesUnlockedAt(1),
      products: productsUnlockedAt(1),
      themes: ["defaultFactory"],
    },
    upgrades: { betterMaterials: 0, goldenTouch: 0 },
    settings: {
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
      reducedMotion: prefersReducedMotion(),
      particleDensity: "medium",
    },
    onboarding: {
      hasStarted: false,
      hasCompletedFirstCut: false,
      hasCompletedFirstPackage: false,
      hasSeenStreakIntro: false,
      hasSeenUpgradeIntro: false,
      hasSeenGoldenIntro: false,
    },
    meta: { createdAt: timestamp, updatedAt: timestamp },
  };
}

/**
 * V1 is the current schema, so this only repairs values that are valid by type
 * but inconsistent with the current config (e.g. after a balance change).
 */
function migrateV1ToCurrent(save: SaveDataV1): SaveDataCurrent {
  const level = save.player.factoryLevel;
  const unique = <T,>(items: T[]) => Array.from(new Set(items));

  return {
    ...save,
    player: {
      ...save.player,
      coins: Math.floor(save.player.coins),
      xp: Math.min(Math.floor(save.player.xp), xpRequired(level) - 1),
    },
    unlocks: {
      machines: unique([...save.unlocks.machines, ...machinesUnlockedAt(level)]),
      products: unique([...save.unlocks.products, ...productsUnlockedAt(level)]),
      themes: unique(["defaultFactory" as const, ...save.unlocks.themes]),
    },
    upgrades: {
      betterMaterials: Math.min(save.upgrades.betterMaterials, upgrades.betterMaterials.maxLevel),
      goldenTouch: Math.min(save.upgrades.goldenTouch, upgrades.goldenTouch.maxLevel),
    },
    settings: {
      ...save.settings,
      selectedFactoryTheme:
        save.settings.selectedFactoryTheme === "defaultFactory" ||
        save.unlocks.themes.includes(save.settings.selectedFactoryTheme)
          ? save.settings.selectedFactoryTheme
          : "defaultFactory",
    },
  };
}

/** Validates and upgrades any stored save. Returns null when it cannot be trusted. */
export function migrateSave(raw: unknown): SaveDataCurrent | null {
  const envelope = SaveEnvelopeSchema.safeParse(raw);
  if (!envelope.success) return null;

  switch (envelope.data.schemaVersion) {
    case 1: {
      const parsed = SaveSchemaV1.safeParse(raw);
      return parsed.success ? migrateV1ToCurrent(parsed.data) : null;
    }
    default:
      return null;
  }
}

/** Never throws: an unreadable or invalid save yields a safe fresh state. */
export function loadSave(storage: StorageLike | null = getBrowserStorage()): LoadResult {
  if (!storage) return { data: createFreshSave(), status: "unavailable" };

  let text: string | null = null;
  try {
    text = storage.getItem(SAVE_KEY);
  } catch {
    return { data: createFreshSave(), status: "unavailable" };
  }
  if (text === null) return { data: createFreshSave(), status: "fresh" };

  try {
    const migrated = migrateSave(JSON.parse(text));
    if (migrated) return { data: migrated, status: "loaded" };
  } catch {
    // Fall through to the corrupt-save path.
  }

  lastCorruptRaw = text;
  try {
    storage.setItem(CORRUPT_BACKUP_KEY, text);
  } catch {
    // The in-memory copy is enough if the backup cannot be written.
  }
  return { data: createFreshSave(), status: "corrupt" };
}

export function writeSave(
  data: SaveDataCurrent,
  storage: StorageLike | null = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: StorageLike | null = getBrowserStorage()): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
