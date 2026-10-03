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
  | "goldIngot";

export type UpgradeId = "betterMaterials" | "goldenTouch";

export type ThemeId =
  | "defaultFactory"
  | "freshMint"
  | "sunsetShift"
  | "candyLine"
  | "nightShift";

export type MaterialProfile = "wood" | "soap" | "ceramic" | "crystal" | "gold";

export type ProductRarity = "common" | "rare";

export type SoundKey =
  | "uiClick"
  | "uiBack"
  | "deny"
  | "cutSliceWood"
  | "cutSliceSoap"
  | "stampThunk"
  | "polishDone"
  | "tapeSnap"
  | "boxClose"
  | "rewardGood"
  | "rewardExcellent"
  | "rewardPerfect"
  | "coin"
  | "purchase"
  | "levelUp"
  | "golden";

export type LoopKey = "cutLoop" | "polishLoop" | "tapeLoop";

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
  /** Later variants win; used when a newly unlocked machine extends the chain. */
  sequenceVariants?: SequenceVariant[];
  /** Relative chance of being picked as the next order. */
  orderWeight: number;
  visualKey: string;
  materialProfile: MaterialProfile;
  rarity?: ProductRarity;
}

export type UpgradeEffect =
  | { kind: "productValue"; perLevel: number }
  | { kind: "goldenChance"; chanceByLevel: number[] };

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
}
