import { beforeEach, describe, expect, it } from "vitest";
import { products } from "@/config/products";
import { createFreshSave } from "@/lib/storage/saveService";
import { hydrateStores } from "@/stores/persistence";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import { useRunStore } from "@/stores/runStore";
import { useUiStore } from "@/stores/uiStore";
import { pickProduct, rollGolden } from "./orders";
import { calculateProductQuality, projectOrderValue, resolveProductReward } from "./RewardResolver";
import { completeMachine, createOrder, exitMachine, finishProduct } from "./runActions";
import { transition } from "./runStateMachine";

const run = () => useRunStore.getState();
const player = () => usePlayerStore.getState();

/** Drives the active machine from entering to the point where it exits. */
function playMachine(quality: number) {
  run().dispatch("ENTER_DONE");
  run().dispatch("INTERACTION_START");
  const committed = completeMachine({ quality, durationMs: 1200 });
  run().dispatch("SCORE_COMMITTED");
  run().dispatch("CONTINUE");
  exitMachine();
  return committed;
}

beforeEach(() => {
  useRunStore.getState().clear();
  useUiStore.getState().reset();
  hydrateStores(createFreshSave());
});

describe("run state machine", () => {
  it("walks the documented path", () => {
    expect(transition("ORDER_INTRO", "INTRO_DONE")).toBe("MACHINE_ENTER");
    expect(transition("MACHINE_ENTER", "ENTER_DONE")).toBe("MACHINE_READY");
    expect(transition("MACHINE_READY", "INTERACTION_START")).toBe("PLAYER_INTERACTION");
    expect(transition("PLAYER_INTERACTION", "INTERACTION_COMPLETE")).toBe("MACHINE_RESOLVE");
    expect(transition("MACHINE_RESOLVE", "SCORE_COMMITTED")).toBe("RESULT_FEEDBACK");
    expect(transition("RESULT_FEEDBACK", "CONTINUE")).toBe("MACHINE_EXIT");
    expect(transition("MACHINE_EXIT", "EXIT_NEXT")).toBe("MACHINE_ENTER");
    expect(transition("MACHINE_EXIT", "EXIT_FINAL")).toBe("PRODUCT_COMPLETE");
    expect(transition("PRODUCT_COMPLETE", "REWARD_RESOLVED")).toBe("REWARD_SUMMARY");
  });

  it("rejects events that are not legal in the current phase", () => {
    expect(transition("ORDER_INTRO", "CONTINUE")).toBeNull();
    expect(transition("MACHINE_READY", "INTERACTION_COMPLETE")).toBeNull();
    expect(transition("REWARD_SUMMARY", "REWARD_RESOLVED")).toBeNull();
  });

  it("lets a cancelled interaction be retried", () => {
    expect(transition("PLAYER_INTERACTION", "INTERACTION_CANCEL")).toBe("MACHINE_READY");
  });
});

describe("reward resolver", () => {
  it("averages machine scores into product quality", () => {
    expect(calculateProductQuality([{ quality: 94 }, { quality: 100 }, { quality: 91 }])).toBe(95);
    expect(calculateProductQuality([])).toBe(0);
  });

  it("does not multiply XP for Golden Products", () => {
    const results = [
      { machineId: "cutter" as const, productId: "woodBlock" as const, quality: 100, isPerfect: true, durationMs: 1 },
      { machineId: "packager" as const, productId: "woodBlock" as const, quality: 100, isPerfect: true, durationMs: 1 },
    ];
    const base = { product: products.woodBlock, results, streak: 0, upgradeLevels: { betterMaterials: 0, goldenTouch: 0 } };
    const normal = resolveProductReward({ ...base, isGolden: false });
    const golden = resolveProductReward({ ...base, isGolden: true });
    expect(golden.coins).toBe(normal.coins * 5);
    expect(golden.completionXp - normal.completionXp).toBe(5);
  });
});

describe("order value projection", () => {
  const upgradeLevels = { betterMaterials: 1, goldenTouch: 0 };

  it("starts at the order's value before quality", () => {
    const base = { product: products.soapBar, results: [], streak: 0, upgradeLevels };
    // 18 × 1.10 (Better Materials) = 19.8 → 20
    expect(projectOrderValue({ ...base, isGolden: false })).toBe(20);
    expect(projectOrderValue({ ...base, isGolden: true })).toBe(99);
  });

  it("moves with each result and ends at exactly what is paid", () => {
    createOrder();
    run().dispatch("INTRO_DONE");
    const project = () =>
      projectOrderValue({
        product: products.woodBlock,
        results: run().run!.results,
        streak: player().perfectStreak,
        upgradeLevels: useProgressionStore.getState().upgrades,
        isGolden: false,
      });

    expect(project()).toBe(10);
    playMachine(100);
    expect(project()).toBe(13);
    playMachine(60);
    const projected = project();
    expect(finishProduct()?.coins).toBe(projected);
  });
});

describe("orders", () => {
  it("only picks unlocked products, weighted", () => {
    expect(pickProduct(["woodBlock"], () => 0.99)).toBe("woodBlock");
    expect(pickProduct(["woodBlock", "soapBar"], () => 0.1)).toBe("woodBlock");
    expect(pickProduct(["woodBlock", "soapBar"], () => 0.9)).toBe("soapBar");
    expect(pickProduct([], () => 0.5)).toBe("woodBlock");
  });

  it("never rolls Golden before Golden Touch is bought", () => {
    expect(rollGolden(0, () => 0)).toBe(false);
    expect(rollGolden(1, () => 0.019)).toBe(true);
    expect(rollGolden(1, () => 0.021)).toBe(false);
  });
});

describe("production run", () => {
  it("runs a Wood Block end to end and pays out once", () => {
    const order = createOrder();
    expect(order?.productId).toBe("woodBlock");
    expect(order?.machineSequence).toEqual(["cutter", "packager"]);
    expect(run().phase).toBe("ORDER_INTRO");

    run().dispatch("INTRO_DONE");
    expect(playMachine(100)).toBe(true);
    expect(run().phase).toBe("MACHINE_ENTER");
    expect(run().run?.currentMachineIndex).toBe(1);

    expect(playMachine(100)).toBe(true);
    expect(run().phase).toBe("PRODUCT_COMPLETE");

    const summary = finishProduct();
    // 10 × 1.30 (Perfect) = 13 coins; XP = 7 + 7 from machines, 5 + 2 on completion.
    expect(summary).toMatchObject({ quality: 100, coins: 13, xp: 21 });
    expect(player().coins).toBe(13);
    expect(player().xp).toBe(21);
    expect(player().perfectStreak).toBe(2);
    expect(player().totalPerfects).toBe(2);
    expect(player().totalProductsCompleted).toBe(1);
    expect(run().phase).toBe("REWARD_SUMMARY");
    expect(useProgressionStore.getState().onboarding).toMatchObject({
      hasCompletedFirstCut: true,
      hasCompletedFirstPackage: true,
    });
  });

  it("ignores duplicate machine completions", () => {
    createOrder();
    run().dispatch("INTRO_DONE");
    run().dispatch("ENTER_DONE");
    run().dispatch("INTERACTION_START");

    expect(completeMachine({ quality: 100, durationMs: 500 })).toBe(true);
    expect(completeMachine({ quality: 100, durationMs: 500 })).toBe(false);
    expect(completeMachine({ quality: 100, durationMs: 500 })).toBe(false);

    expect(run().run?.results).toHaveLength(1);
    expect(player().xp).toBe(7);
    expect(player().perfectStreak).toBe(1);
  });

  it("ignores duplicate product completions", () => {
    createOrder();
    run().dispatch("INTRO_DONE");
    playMachine(90);
    playMachine(90);

    expect(finishProduct()).not.toBeNull();
    const coins = player().coins;
    const xp = player().xp;

    expect(finishProduct()).toBeNull();
    expect(finishProduct()).toBeNull();
    expect(player().coins).toBe(coins);
    expect(player().xp).toBe(xp);
    expect(player().totalProductsCompleted).toBe(1);
  });

  it("does not pay out before every machine has a result", () => {
    createOrder();
    run().dispatch("INTRO_DONE");
    playMachine(90);
    expect(finishProduct()).toBeNull();
    expect(player().coins).toBe(0);
  });

  it("does not create a second run while one is in progress", () => {
    const first = createOrder();
    expect(createOrder()).toBeNull();
    expect(run().run?.id).toBe(first?.id);
  });

  it("accepts a single-gesture machine straight from MACHINE_READY", () => {
    createOrder();
    run().dispatch("INTRO_DONE");
    run().dispatch("ENTER_DONE");
    expect(completeMachine({ quality: 80, durationMs: 300 })).toBe(true);
    expect(run().phase).toBe("MACHINE_RESOLVE");
  });

  it("levels up, unlocks content and queues the new product as the next order", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 2, xp: 250 });
    createOrder();
    run().dispatch("INTRO_DONE");
    playMachine(100);

    expect(player().factoryLevel).toBe(3);
    expect(useProgressionStore.getState().machines).toContain("stamper");
    expect(useProgressionStore.getState().products).toContain("soapBar");
    expect(useUiStore.getState().pendingLevelUps).toEqual([3]);

    playMachine(100);
    finishProduct();
    expect(createOrder()?.productId).toBe("soapBar");
  });

  it("scripts one Golden Product at level 5 and multiplies only the coins", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 5 });
    const order = createOrder();
    expect(order?.isGolden).toBe(true);
    expect(useProgressionStore.getState().onboarding.hasSeenGoldenIntro).toBe(true);

    run().dispatch("INTRO_DONE");
    order!.machineSequence.forEach(() => playMachine(75));
    const summary = finishProduct();
    expect(summary?.coins).toBe(products[order!.productId].baseValue * 5);

    // With Golden Touch still at level 0, later orders are never Golden.
    for (let i = 0; i < 20; i++) {
      useRunStore.getState().clear();
      expect(createOrder()?.isGolden).toBe(false);
    }
  });
});

describe("ceramic coaster", () => {
  it("arrives as the next order at level 8 and runs through all four machines", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 7, xp: 1380 });
    useProgressionStore.getState().syncUnlocks(7);
    useProgressionStore.getState().setOnboarding("hasSeenGoldenIntro");

    createOrder();
    run().dispatch("INTRO_DONE");
    while (run().phase !== "PRODUCT_COMPLETE") playMachine(100);
    finishProduct();

    expect(player().factoryLevel).toBe(8);
    expect(useProgressionStore.getState().machines).toContain("paintBooth");
    expect(useProgressionStore.getState().products).toContain("ceramicCoaster");

    const order = createOrder();
    expect(order?.productId).toBe("ceramicCoaster");
    expect(order?.machineSequence).toEqual(["paintBooth", "stamper", "polisher", "packager"]);

    run().dispatch("INTRO_DONE");
    order!.machineSequence.forEach(() => playMachine(100));
    const coins = player().coins;
    const summary = finishProduct();

    expect(run().run?.results.map((r) => r.machineId)).toEqual(order!.machineSequence);
    expect(summary?.productId).toBe("ceramicCoaster");
    expect(player().coins).toBe(coins + summary!.coins);
    // Paid once.
    expect(finishProduct()).toBeNull();
    expect(player().coins).toBe(coins + summary!.coins);
  });
});

describe("purchases", () => {
  it("is atomic and never leaves negative coins", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 2, coins: 60 });
    const progression = useProgressionStore.getState();

    expect(progression.purchaseUpgrade("betterMaterials")).toMatchObject({ ok: true, cost: 50 });
    expect(player().coins).toBe(10);
    expect(useProgressionStore.getState().upgrades.betterMaterials).toBe(1);

    // A double click lands here: not enough coins left, nothing changes.
    expect(progression.purchaseUpgrade("betterMaterials")).toMatchObject({ ok: false, reason: "coins" });
    expect(player().coins).toBe(10);
    expect(useProgressionStore.getState().upgrades.betterMaterials).toBe(1);
  });

  it("refuses locked and maxed upgrades", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 1, coins: 9999 });
    expect(useProgressionStore.getState().purchaseUpgrade("goldenTouch")).toMatchObject({ ok: false, reason: "locked" });

    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 20, coins: 1e9 });
    useProgressionStore.setState({ upgrades: { betterMaterials: 10, goldenTouch: 0 } });
    expect(useProgressionStore.getState().purchaseUpgrade("betterMaterials")).toMatchObject({ ok: false, reason: "maxed" });
  });

  it("cannot spend more than the player has", () => {
    usePlayerStore.getState().hydrate({ ...player(), coins: 5 });
    expect(player().spendCoins(6)).toBe(false);
    expect(player().coins).toBe(5);
  });
});
