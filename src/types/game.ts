export type MachineId =
  | "cutter"
  | "paintBooth"
  | "stamper"
  | "polisher"
  | "assembler"
  | "sorter"
  | "packager";

export type ProductId =
  | "woodBlock"
  | "soapBar"
  | "ceramicCoaster"
  | "crystal"
  | "goldIngot"
  | "toyRobot";

export type UpgradeId =
  | "betterMaterials"
  | "goldenTouch"
  | "steadyHands"
  | "streakShield"
  | "fastLearner"
  | "freshOrders";

/** Upgrade levels as rules read them: an upgrade that is missing counts as level 0. */
export type UpgradeLevels = Partial<Record<UpgradeId, number>>;

export type ThemeId =
  | "defaultFactory"
  | "freshMint"
  | "sunsetShift"
  | "candyLine"
  | "nightShift";

export type MaterialProfile = "wood" | "soap" | "ceramic" | "crystal" | "gold" | "plastic";

export type ProductRarity = "common" | "rare";

export type SoundKey =
  | "uiClick"
  | "uiBack"
  | "deny"
  | "cutSliceWood"
  | "cutSliceSoap"
  | "stampThunk"
  | "stampSoft"
  | "polishDone"
  | "sortDrop"
  | "sortMiss"
  | "snapIn"
  | "tapeSnap"
  | "boxClose"
  | "rewardGood"
  | "rewardExcellent"
  | "rewardPerfect"
  | "coin"
  | "purchase"
  | "levelUp"
  | "golden";

export type LoopKey = "cutLoop" | "polishLoop" | "tapeLoop" | "sprayLoop";

export interface MachineSfxConfig {
  loop?: LoopKey;
  resolve: SoundKey;
}

export interface TutorialStep {
  text: string;
}

export interface MachineDefinition {
  id: MachineId;
  name: string;
  description: string;
  /** One short line shown under the machine while it is active. */
  instruction: string;
  unlockLevel: number;
  /** Hands-on seconds a typical go at the basic variant takes; sets the Rush target. */
  estimatedDurationSeconds: number;
  baseDifficulty: number;
  icon: string;
  sfx: MachineSfxConfig;
  /** False for machines that are planned but have no playable module yet. */
  implemented: boolean;
  tutorial?: TutorialStep[];
}

export interface MachineResult {
  machineId: MachineId;
  productId: ProductId;
  quality: number;
  isPerfect: boolean;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface SequenceVariant {
  /** The variant applies once this machine is unlocked. */
  requiresMachine: MachineId;
  machineSequence: MachineId[];
}

export interface ProductDefinition {
  id: ProductId;
  name: string;
  description: string;
  unlockLevel: number;
  baseValue: number;
  machineSequence: MachineId[];
  /**
   * Optional name per step, aligned with `machineSequence`, for products that
   * visit one machine several times. `null` falls back to the machine's name.
   */
  stepLabels?: (string | null)[];
  /**
   * Scales the XP each machine step pays. Products with many short steps use
   * less than 1 so they do not out-earn everything else per order.
   */
  stepXpScale?: number;
  /** Optional instruction per step, aligned with `machineSequence`; `null` uses the machine's own. */
  stepHints?: (string | null)[];
  /** Later variants win; used when a newly unlocked machine extends the chain. */
  sequenceVariants?: SequenceVariant[];
  /** Set to false to keep a product locked even though every machine it needs exists. */
  released?: boolean;
  /** Relative chance of being picked as the next order. */
  orderWeight: number;
  visualKey: string;
  materialProfile: MaterialProfile;
  rarity?: ProductRarity;
}

export type UpgradeEffect =
  | { kind: "productValue"; perLevel: number }
  | { kind: "goldenChance"; chanceByLevel: number[] }
  /** Results within `windowPerLevel` × level of 100 count as Perfect. */
  | { kind: "perfectAssist"; windowPerLevel: number }
  /** Once per order, a result at or above the level's quality keeps the streak. Index = upgrade level. */
  | { kind: "streakShield"; minQualityByLevel: number[] }
  | { kind: "xpBoost"; perLevel: number }
  /** Rerolls of the order board, per board. */
  | { kind: "rerolls"; perLevel: number };

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  description: string;
  unlockLevel: number;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  effect: UpgradeEffect;
  visualKey?: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  unlockLevel: number;
  cost: number;
  /** CSS custom properties applied to the gameplay stage only. */
  vars: Record<string, string>;
}

/** A condition attached to an order that changes what it pays. */
export type OrderTwist = "rush" | "precision" | "training";

/** One card on the order board. */
export interface OrderOffer {
  id: string;
  productId: ProductId;
  isGolden: boolean;
  twist?: OrderTwist;
  /** The product was unlocked this level and has not been made yet. */
  isNew?: boolean;
}

export type RunPhase =
  | "ORDER_INTRO"
  | "MACHINE_ENTER"
  | "MACHINE_READY"
  | "PLAYER_INTERACTION"
  | "MACHINE_RESOLVE"
  | "RESULT_FEEDBACK"
  | "MACHINE_EXIT"
  | "PRODUCT_COMPLETE"
  | "REWARD_SUMMARY";

export interface ProductionRun {
  id: string;
  productId: ProductId;
  isGolden: boolean;
  machineSequence: MachineId[];
  currentMachineIndex: number;
  results: MachineResult[];
  startedAt: number;
  status: "intro" | "machine" | "resolving" | "complete";
  /** Set exactly once, when the product reward has been paid out. */
  rewardCommitted: boolean;
  twist?: OrderTwist;
  /** The Streak Shield works once per order. */
  shieldUsed?: boolean;
}

export type QualityTier = "perfect" | "excellent" | "good" | "low";

export interface RewardSummary {
  runId: string;
  productId: ProductId;
  isGolden: boolean;
  quality: number;
  coins: number;
  xp: number;
  streakBonus: number;
  /** The order's twist and whether its condition was met. */
  twist?: { kind: OrderTwist; achieved: boolean };
}
