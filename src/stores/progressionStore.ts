import { zeroUpgradeLevels } from "@/config/upgrades";
import { create } from "zustand";
import { themes } from "@/config/themes";
import { machinesUnlockedAt, productsUnlockedAt } from "@/game/progression/unlocks";
import { canPurchaseUpgrade, type PurchaseBlock } from "@/game/progression/upgradeLogic";
import { track } from "@/lib/analytics";
import type { MachineId, ProductId, ThemeId, UpgradeId } from "@/types/game";
import type { SaveDataCurrent } from "@/types/save";
import { usePlayerStore } from "./playerStore";

type Onboarding = SaveDataCurrent["onboarding"];

export interface PurchaseOutcome {
  ok: boolean;
  cost: number;
  reason?: PurchaseBlock | "owned";
}

interface ProgressionState {
  machines: MachineId[];
  products: ProductId[];
  themes: ThemeId[];
  upgrades: Record<UpgradeId, number>;
  onboarding: Onboarding;

  unlockMachine: (id: MachineId) => void;
  unlockProduct: (id: ProductId) => void;
  unlockTheme: (id: ThemeId) => void;
  /** Adds everything the given level entitles the player to. Returns newly unlocked products. */
  syncUnlocks: (level: number) => ProductId[];
  purchaseUpgrade: (id: UpgradeId) => PurchaseOutcome;
  purchaseTheme: (id: ThemeId) => PurchaseOutcome;
  setOnboarding: (flag: keyof Onboarding, value?: boolean) => void;
  hydrate: (data: Pick<ProgressionState, "machines" | "products" | "themes" | "upgrades" | "onboarding">) => void;
}

export const initialOnboarding: Onboarding = {
  hasStarted: false,
  hasCompletedFirstCut: false,
  hasCompletedFirstPackage: false,
  hasSeenStreakIntro: false,
  hasSeenUpgradeIntro: false,
  hasSeenGoldenIntro: false,
};

const addUnique = <T,>(list: T[], item: T) => (list.includes(item) ? list : [...list, item]);

export const useProgressionStore = create<ProgressionState>()((set, get) => ({
  machines: machinesUnlockedAt(1),
  products: productsUnlockedAt(1),
  themes: ["defaultFactory"],
  upgrades: zeroUpgradeLevels(),
  onboarding: initialOnboarding,

  unlockMachine: (id) => set((s) => ({ machines: addUnique(s.machines, id) })),
  unlockProduct: (id) => set((s) => ({ products: addUnique(s.products, id) })),
  unlockTheme: (id) => set((s) => ({ themes: addUnique(s.themes, id) })),

  syncUnlocks: (level) => {
    const before = get().products;
    const newProducts = productsUnlockedAt(level).filter((id) => !before.includes(id));
    set((s) => ({
      machines: machinesUnlockedAt(level).reduce(addUnique, s.machines),
      products: [...s.products, ...newProducts],
    }));
    return newProducts;
  },

  // Validate, deduct, increment — all synchronously, so a double click cannot double-spend.
  purchaseUpgrade: (id) => {
    const player = usePlayerStore.getState();
    const currentLevel = get().upgrades[id] ?? 0;
    const check = canPurchaseUpgrade(id, currentLevel, player.coins, player.factoryLevel);
    if (!check.ok) return check;
    if (!player.spendCoins(check.cost)) return { ok: false, cost: check.cost, reason: "coins" };

    set((s) => ({ upgrades: { ...s.upgrades, [id]: currentLevel + 1 } }));
    track("upgrade_purchased", { upgradeId: id, newLevel: currentLevel + 1, cost: check.cost });
    return { ok: true, cost: check.cost };
  },

  purchaseTheme: (id) => {
    const def = themes[id];
    const player = usePlayerStore.getState();
    if (!def) return { ok: false, cost: 0, reason: "locked" };
    if (get().themes.includes(id)) return { ok: false, cost: def.cost, reason: "owned" };
    if (player.factoryLevel < def.unlockLevel) return { ok: false, cost: def.cost, reason: "locked" };
    if (!player.spendCoins(def.cost)) return { ok: false, cost: def.cost, reason: "coins" };

    set((s) => ({ themes: addUnique(s.themes, id) }));
    return { ok: true, cost: def.cost };
  },

  setOnboarding: (flag, value = true) => {
    if (get().onboarding[flag] === value) return;
    set((s) => ({ onboarding: { ...s.onboarding, [flag]: value } }));
  },

  hydrate: (data) => set({ ...data }),
}));
