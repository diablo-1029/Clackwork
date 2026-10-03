import type { MachineId, ProductId, UpgradeId } from "@/types/game";

interface AnalyticsEvents {
  product_started: { productId: ProductId; factoryLevel: number; isGolden: boolean };
  machine_completed: { machineId: MachineId; productId: ProductId; quality: number; durationMs: number };
  product_completed: { productId: ProductId; quality: number; coins: number; isGolden: boolean };
  upgrade_purchased: { upgradeId: UpgradeId; newLevel: number; cost: number };
  level_up: { factoryLevel: number };
}

const isDev = process.env.NODE_ENV === "development";

/** Single seam for a future analytics vendor. Development-only console logger for now. */
export function track<K extends keyof AnalyticsEvents>(event: K, payload: AnalyticsEvents[K]): void {
  if (isDev) console.debug(`[Analytics] ${event}`, payload);
}

/** Meaningful transitions only; never called per pointer move. */
export function devLog(scope: string, message: string): void {
  if (isDev) console.debug(`[${scope}] ${message}`);
}
