import { z } from "zod";

const machineId = z.enum([
  "cutter",
  "paintBooth",
  "stamper",
  "polisher",
  "assembler",
  "sorter",
  "packager",
]);
const productId = z.enum(["woodBlock", "soapBar", "ceramicCoaster", "crystal", "goldIngot", "toyRobot"]);
const themeId = z.enum(["defaultFactory", "freshMint", "sunsetShift", "candyLine", "nightShift"]);

const count = z.number().int().nonnegative();
const volume = z.number().min(0).max(1);

export const SaveSchemaV1 = z.object({
  schemaVersion: z.literal(1),

  player: z.object({
    coins: z.number().nonnegative(),
    xp: z.number().nonnegative(),
    factoryLevel: z.number().int().positive(),
    perfectStreak: count,
    totalProductsCompleted: count,
    totalPerfects: count,
    // Added with the fever meter: older saves start with it empty.
    fever: z.object({ charge: count, ordersLeft: count }).default({ charge: 0, ordersLeft: 0 }),
  }),

  unlocks: z.object({
    machines: z.array(machineId),
    products: z.array(productId),
    themes: z.array(themeId),
  }),

  upgrades: z.object({
    betterMaterials: count,
    goldenTouch: count,
    // Added after the first release: saves from before then load with these at 0.
    steadyHands: count.default(0),
    streakShield: count.default(0),
    fastLearner: count.default(0),
    freshOrders: count.default(0),
  }),

  settings: z.object({
    themeMode: z.enum(["light", "dark", "system"]),
    selectedFactoryTheme: themeId,
    audio: z.object({
      masterEnabled: z.boolean(),
      masterVolume: volume,
      musicEnabled: z.boolean(),
      musicVolume: volume,
      sfxEnabled: z.boolean(),
      sfxVolume: volume,
    }),
    reducedMotion: z.boolean(),
    particleDensity: z.enum(["low", "medium", "high"]),
  }),

  onboarding: z.object({
    hasStarted: z.boolean(),
    hasCompletedFirstCut: z.boolean(),
    hasCompletedFirstPackage: z.boolean(),
    hasSeenStreakIntro: z.boolean(),
    hasSeenUpgradeIntro: z.boolean(),
    hasSeenGoldenIntro: z.boolean(),
  }),

  meta: z.object({
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
});

/** Only enough structure to route a raw save to the right migration. */
export const SaveEnvelopeSchema = z.looseObject({
  schemaVersion: z.number().int(),
});
