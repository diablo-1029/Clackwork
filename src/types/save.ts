import type { FactoryStats } from "@/game/progression/achievements";
import type { DailyGoals } from "@/game/progression/goals";
import type { MachineId, ProductId, ThemeId, UpgradeId } from "./game";
import type { GameSettings } from "./settings";

export interface SaveDataV1 {
  schemaVersion: 1;

  player: {
    coins: number;
    xp: number;
    factoryLevel: number;
    perfectStreak: number;
    totalProductsCompleted: number;
    totalPerfects: number;
    /** The fever meter and any Overdrive in progress. */
    fever: { charge: number; ordersLeft: number };
  };

  unlocks: {
    machines: MachineId[];
    products: ProductId[];
    themes: ThemeId[];
  };

  upgrades: Record<UpgradeId, number>;

  settings: GameSettings;

  onboarding: {
    hasStarted: boolean;
    hasCompletedFirstCut: boolean;
    hasCompletedFirstPackage: boolean;
    hasSeenStreakIntro: boolean;
    hasSeenUpgradeIntro: boolean;
    hasSeenGoldenIntro: boolean;
  };

  /** Today's goals, earned achievement ids and lifetime stats. */
  goals: DailyGoals;
  achievements: string[];
  stats: FactoryStats;

  meta: {
    createdAt: string;
    updatedAt: string;
  };
}

export type SaveDataCurrent = SaveDataV1;
export const CURRENT_SCHEMA_VERSION = 1;
