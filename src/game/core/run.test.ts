import { beforeEach, describe, expect, it } from "vitest";
import { products } from "@/config/products";
import { seededRandom } from "@/lib/math";
import { createFreshSave } from "@/lib/storage/saveService";
import { hydrateStores } from "@/stores/persistence";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import { useRunStore } from "@/stores/runStore";
import { useUiStore } from "@/stores/uiStore";
import { useGoalsStore } from "@/stores/goalsStore";
import { recordProgress, refreshGoals } from "./goalActions";
import { generateOffers, parTimeMs, pickProduct, resolveTwist, rollGolden } from "./orders";
import { calculateProductQuality, projectOrderValue, resolveProductReward } from "./RewardResolver";
import {
  completeMachine,
  createOrder,
  ensureOffers,
  exitMachine,
  finishProduct,
  grantXp,
  isOrderBoardUnlocked,
  rerollOffers,
  rerollsLeft,
} from "./runActions";
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
    // Just short of Level 8, which needs 492 XP from Level 7.
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 7, xp: 480 });
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

describe("crystal", () => {
  it("arrives as the next order at level 10 and runs through all four machines", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 10 });
    useProgressionStore.getState().syncUnlocks(10);
    useProgressionStore.getState().setOnboarding("hasSeenGoldenIntro");
    useUiStore.getState().queueProducts(["crystal"]);

    const order = createOrder();
    expect(order?.productId).toBe("crystal");
    expect(order?.machineSequence).toEqual(["cutter", "polisher", "sorter", "packager"]);

    run().dispatch("INTRO_DONE");
    order!.machineSequence.forEach(() => playMachine(100));
    const summary = finishProduct();

    expect(run().run?.results.map((r) => r.machineId)).toEqual(order!.machineSequence);
    // 45 x 1.30 (Perfect) x 1.05 (streak of 4) = 61.4, rounded to 61
    expect(summary).toMatchObject({ productId: "crystal", quality: 100, coins: 61 });
    expect(finishProduct()).toBeNull();
    expect(player().coins).toBe(61);
  });
});

describe("gold ingot", () => {
  it("arrives as the next order at level 15 and runs through all four machines", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 15 });
    useProgressionStore.getState().syncUnlocks(15);
    useProgressionStore.getState().setOnboarding("hasSeenGoldenIntro");
    useUiStore.getState().queueProducts(["goldIngot"]);

    const order = createOrder();
    expect(order?.productId).toBe("goldIngot");
    expect(order?.machineSequence).toEqual(["stamper", "polisher", "sorter", "packager"]);

    run().dispatch("INTRO_DONE");
    order!.machineSequence.forEach(() => playMachine(100));
    const summary = finishProduct();

    expect(run().run?.results.map((r) => r.machineId)).toEqual(order!.machineSequence);
    // 60 x 1.30 (Perfect) x 1.05 (streak of 4) = 81.9, rounded to 82
    expect(summary).toMatchObject({ productId: "goldIngot", quality: 100, coins: 82 });
    expect(finishProduct()).toBeNull();
    expect(player().coins).toBe(82);
  });
});

describe("toy robot", () => {
  it("arrives as the next order at level 12 and is painted, built in five steps, then boxed", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 12 });
    useProgressionStore.getState().syncUnlocks(12);
    useProgressionStore.getState().setOnboarding("hasSeenGoldenIntro");
    useUiStore.getState().queueProducts(["toyRobot"]);

    const order = createOrder();
    expect(order?.productId).toBe("toyRobot");
    expect(order?.machineSequence).toEqual([
      "paintBooth",
      "assembler",
      "assembler",
      "assembler",
      "assembler",
      "assembler",
      "packager",
    ]);

    run().dispatch("INTRO_DONE");
    order!.machineSequence.forEach(() => playMachine(100));
    const summary = finishProduct();

    expect(run().run?.results.map((r) => r.machineId)).toEqual(order!.machineSequence);
    // Seven results, one per step, even though five of them are the same machine.
    expect(run().run?.results).toHaveLength(7);
    // 90 x 1.30 (Perfect) x 1.10 (streak of 7) = 128.7, rounded to 129
    expect(summary).toMatchObject({ productId: "toyRobot", quality: 100, coins: 129 });
    expect(finishProduct()).toBeNull();
    // The order's 129, plus 40 for the streak-of-5 achievement earned along the way.
    expect(player().coins).toBe(129 + 40);
  });
});

describe("order board", () => {
  /** A repeatable stand-in for Math.random. */
  const sequence = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };
  const all = ["woodBlock", "soapBar", "ceramicCoaster", "crystal", "toyRobot", "goldIngot"] as const;
  const base = { unlocked: [...all], level: 15, goldenTouchLevel: 0, productsCompleted: 50 };

  it("unlocks at level 3", () => {
    expect(isOrderBoardUnlocked()).toBe(false);
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 3 });
    expect(isOrderBoardUnlocked()).toBe(true);
  });

  it("deals three different products when there are enough", () => {
    for (let i = 0; i < 100; i++) {
      const offers = generateOffers(base);
      expect(offers).toHaveLength(3);
      expect(new Set(offers.map((o) => o.productId)).size).toBe(3);
      expect(new Set(offers.map((o) => o.id)).size).toBe(3);
    }
  });

  it("only deals unlocked products, repeating them when there are fewer than three", () => {
    const offers = generateOffers({ ...base, unlocked: ["woodBlock", "soapBar"], level: 3 });
    expect(offers).toHaveLength(3);
    expect(offers.every((o) => o.productId === "woodBlock" || o.productId === "soapBar")).toBe(true);
    expect(new Set(offers.map((o) => o.productId)).size).toBe(2);
  });

  it("shows newer products far more often than the old weights did", () => {
    // Seeded, so the share is the same on every run of the test.
    const random = seededRandom(12345);
    let gold = 0;
    for (let i = 0; i < 400; i++) if (generateOffers({ ...base, random }).some((o) => o.productId === "goldIngot")) gold++;
    // Gold Ingot was about 8% of single orders; it should now be on a third or so of boards.
    expect(gold / 400).toBeGreaterThan(0.25);
  });

  it("puts a forced product first, tagged new only if it unlocked this level", () => {
    const fresh = generateOffers({ ...base, level: 12, forced: ["toyRobot"] });
    expect(fresh[0]).toMatchObject({ productId: "toyRobot", isNew: true });
    expect(fresh[0].twist).toBeUndefined();
    expect(fresh.filter((o) => o.productId === "toyRobot")).toHaveLength(1);

    const chosen = generateOffers({ ...base, level: 15, forced: ["woodBlock"] });
    expect(chosen[0]).toMatchObject({ productId: "woodBlock", isNew: false });
  });

  it("never attaches a twist before level 4 or during the first few orders", () => {
    const always = () => 0.01;
    expect(generateOffers({ ...base, level: 3, random: always }).every((o) => !o.twist)).toBe(true);
    expect(generateOffers({ ...base, productsCompleted: 2, random: always }).every((o) => !o.twist)).toBe(true);
    expect(generateOffers({ ...base, random: always }).some((o) => o.twist)).toBe(true);
  });

  it("makes the first card Golden when asked, and otherwise rolls each card", () => {
    expect(generateOffers({ ...base, goldenFirst: true })[0].isGolden).toBe(true);
    expect(generateOffers(base).every((o) => !o.isGolden)).toBe(true);
    const lucky = generateOffers({ ...base, goldenTouchLevel: 5, random: sequence([0.01]) });
    expect(lucky.every((o) => o.isGolden)).toBe(true);
  });

  it("keeps the same cards until one is picked", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 5 });
    useProgressionStore.getState().syncUnlocks(5);
    const first = ensureOffers();
    expect(ensureOffers()).toBe(first);
    // The scripted Golden introduction is the first card, once.
    expect(first[0].isGolden).toBe(true);
    expect(useProgressionStore.getState().onboarding.hasSeenGoldenIntro).toBe(true);

    const order = createOrder(first[1]);
    expect(order).toMatchObject({ productId: first[1].productId, isGolden: first[1].isGolden });
    expect(useUiStore.getState().offers).toEqual([]);
    expect(ensureOffers()).not.toBe(first);
  });

  it("ignores a second pick while an order is in progress", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 5 });
    useProgressionStore.getState().syncUnlocks(5);
    const [a, b] = ensureOffers();
    const started = createOrder(a);
    expect(createOrder(b)).toBeNull();
    expect(run().run?.id).toBe(started?.id);
  });
});

describe("order twists", () => {
  it("pays a Rush bonus under par and nothing extra over it", () => {
    expect(resolveTwist("rush", { quality: 80, activeMs: 5000, parMs: 6000 })).toEqual({
      coinMultiplier: 1.4,
      xpMultiplier: 1,
      achieved: true,
    });
    expect(resolveTwist("rush", { quality: 80, activeMs: 7000, parMs: 6000 })).toMatchObject({
      coinMultiplier: 1,
      achieved: false,
    });
  });

  it("pays Precision more for a clean product and a little less otherwise", () => {
    expect(resolveTwist("precision", { quality: 95, activeMs: 0, parMs: 0 }).coinMultiplier).toBe(1.6);
    expect(resolveTwist("precision", { quality: 94, activeMs: 0, parMs: 0 })).toMatchObject({
      coinMultiplier: 0.85,
      achieved: false,
    });
  });

  it("adds XP for Training and changes nothing without a twist", () => {
    expect(resolveTwist("training", { quality: 50, activeMs: 0, parMs: 0 })).toEqual({
      coinMultiplier: 1,
      xpMultiplier: 1.5,
      achieved: true,
    });
    expect(resolveTwist(undefined, { quality: 50, activeMs: 0, parMs: 0 })).toEqual({
      coinMultiplier: 1,
      xpMultiplier: 1,
      achieved: true,
    });
  });

  it("sets par from the steps played, with more time for steps that asked for more", () => {
    const step = (machineId: "cutter" | "packager" | "stamper" | "polisher", metadata?: Record<string, unknown>) => ({
      machineId,
      metadata,
    });
    // Cutter 3 s + Packager 3 s.
    expect(parTimeMs([step("cutter"), step("packager")])).toBe(6000);
    expect(parTimeMs([step("cutter"), step("stamper"), step("polisher"), step("packager")])).toBe(17000);
    // A triple cut and a cross tape each add 60% of the machine's time per extra part.
    expect(parTimeMs([step("cutter", { cuts: [100, 100, 100] }), step("packager", { strips: [100, 100] })])).toBeCloseTo(
      3000 * 2.2 + 3000 * 1.6,
    );
    expect(parTimeMs([])).toBe(0);
  });

  const playOrder = (twist: "rush" | "precision" | "training", quality: number) => {
    const order = createOrder({ id: "t", productId: "woodBlock", isGolden: false, twist });
    run().dispatch("INTRO_DONE");
    order!.machineSequence.forEach(() => playMachine(quality));
    return finishProduct()!;
  };

  it("applies a twist to the payout, once, and reports the outcome", () => {
    // playMachine reports 1.2 s per machine: 2.4 s, well under the 6 s par.
    const rush = playOrder("rush", 75);
    expect(rush).toMatchObject({ coins: 14, twist: { kind: "rush", achieved: true } });
    expect(player().coins).toBe(14);
    expect(finishProduct()).toBeNull();
    expect(player().coins).toBe(14);
  });

  it("pays Precision either way, depending on quality", () => {
    expect(playOrder("precision", 75)).toMatchObject({ coins: 9, twist: { kind: "precision", achieved: false } });
    useRunStore.getState().clear();
    // 10 x 1.30 (Perfect) x 1.6 = 20.8, on top of a short streak bonus of nothing yet.
    expect(playOrder("precision", 100)).toMatchObject({ coins: 21, twist: { kind: "precision", achieved: true } });
  });

  it("adds half again to the order's XP for Training", () => {
    const plain = (() => {
      createOrder({ id: "p", productId: "woodBlock", isGolden: false });
      run().dispatch("INTRO_DONE");
      playMachine(75);
      playMachine(75);
      return finishProduct()!;
    })();
    useRunStore.getState().clear();
    const trained = playOrder("training", 75);
    expect(trained.coins).toBe(plain.coins);
    expect(trained.xp).toBe(Math.round(plain.xp * 1.5));
  });

  it("projects the value without the Rush bonus until the order is finished", () => {
    const input = {
      product: products.woodBlock,
      results: [{ machineId: "cutter" as const, productId: "woodBlock" as const, quality: 75, isPerfect: false, durationMs: 1000 }],
      streak: 0,
      upgradeLevels: { betterMaterials: 0, goldenTouch: 0 },
      isGolden: false,
    };
    expect(projectOrderValue({ ...input, twist: "rush" })).toBe(10);
    expect(projectOrderValue({ ...input, twist: "precision" })).toBe(9);
    expect(resolveProductReward({ ...input, twist: "rush" }).coins).toBe(14);
  });
});

describe("level bonus", () => {
  it("pays the bonus once when a level is reached", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 5, xp: 320, coins: 0 });
    grantXp(10);
    expect(player().factoryLevel).toBe(6);
    expect(player().coins).toBe(150);
    // More XP inside the same level pays nothing further.
    grantXp(10);
    expect(player().coins).toBe(150);
  });

  it("pays for every level when several are gained at once", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 1, xp: 0, coins: 0 });
    grantXp(70 + 115 + 5);
    expect(player().factoryLevel).toBe(3);
    // Level 2 pays 50 and Level 3 pays 75.
    expect(player().coins).toBe(125);
    expect(useUiStore.getState().pendingLevelUps).toEqual([2, 3]);
  });

  it("pays a milestone bonus on every fifth level", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 9, xp: 0, coins: 0 });
    grantXp(700);
    expect(player().factoryLevel).toBe(10);
    expect(player().coins).toBe(750);
  });
});

describe("toy robot xp", () => {
  it("pays about what other four-step products pay, not double", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 12 });
    useProgressionStore.getState().syncUnlocks(12);
    const order = createOrder({ id: "r", productId: "toyRobot", isGolden: false });
    run().dispatch("INTRO_DONE");
    order!.machineSequence.forEach(() => playMachine(100));
    const summary = finishProduct()!;
    // Seven steps at half XP (4 each) plus the completion bonus of 5 + 7.
    expect(summary.xp).toBe(40);
    expect(player().xp).toBe(40);
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
    useProgressionStore.setState({ upgrades: { ...useProgressionStore.getState().upgrades, betterMaterials: 10 } });
    expect(useProgressionStore.getState().purchaseUpgrade("betterMaterials")).toMatchObject({ ok: false, reason: "maxed" });
  });

  it("cannot spend more than the player has", () => {
    usePlayerStore.getState().hydrate({ ...player(), coins: 5 });
    expect(player().spendCoins(6)).toBe(false);
    expect(player().coins).toBe(5);
  });
});

describe("new upgrades", () => {
  const own = (levels: Partial<ReturnType<typeof useProgressionStore.getState>["upgrades"]>) =>
    useProgressionStore.setState({ upgrades: { ...useProgressionStore.getState().upgrades, ...levels } });

  it("Steady Hands records a near-Perfect as Perfect, streak and all", () => {
    own({ steadyHands: 3 });
    createOrder();
    run().dispatch("INTRO_DONE");
    playMachine(97);
    expect(run().run?.results[0]).toMatchObject({ quality: 100, isPerfect: true });
    expect(player().perfectStreak).toBe(1);
    expect(player().totalPerfects).toBe(1);
  });

  it("Streak Shield saves the streak once per order, then is spent", () => {
    own({ streakShield: 2 });
    usePlayerStore.getState().hydrate({ ...player(), perfectStreak: 5 });
    createOrder();
    run().dispatch("INTRO_DONE");

    playMachine(90);
    expect(player().perfectStreak).toBe(5);
    expect(run().run?.shieldUsed).toBe(true);

    playMachine(90);
    expect(player().perfectStreak).toBe(4);
  });

  it("Streak Shield is ready again on the next order", () => {
    own({ streakShield: 2 });
    usePlayerStore.getState().hydrate({ ...player(), perfectStreak: 5 });
    createOrder();
    run().dispatch("INTRO_DONE");
    playMachine(90);
    playMachine(100);
    finishProduct();

    createOrder();
    expect(run().run?.shieldUsed).toBeFalsy();
    run().dispatch("INTRO_DONE");
    playMachine(90);
    expect(player().perfectStreak).toBe(6);
  });

  it("Fast Learner pays more XP, and the summary matches what was paid", () => {
    own({ fastLearner: 5 });
    createOrder();
    run().dispatch("INTRO_DONE");
    playMachine(100);
    playMachine(100);
    const summary = finishProduct();
    // Machines 7 → 11 each (×1.5, rounded), completion 7 → 11.
    expect(summary?.xp).toBe(33);
    expect(player().xp).toBe(33);
  });

  it("Fresh Orders rerolls the board until the rerolls run out", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 10 });
    useProgressionStore.getState().syncUnlocks(10);
    useUiStore.setState({ queuedProducts: [] });

    ensureOffers();
    expect(rerollsLeft()).toBe(0);
    expect(rerollOffers()).toBe(false);

    own({ freshOrders: 2 });
    const first = useUiStore.getState().offers.map((offer) => offer.id);
    expect(rerollsLeft()).toBe(2);
    expect(rerollOffers()).toBe(true);
    const second = useUiStore.getState().offers.map((offer) => offer.id);
    expect(second).toHaveLength(3);
    expect(second).not.toEqual(first);
    expect(rerollOffers()).toBe(true);
    expect(rerollsLeft()).toBe(0);
    expect(rerollOffers()).toBe(false);
  });

  it("a new board starts with its rerolls back", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 10 });
    own({ freshOrders: 1 });
    ensureOffers();
    rerollOffers();
    expect(rerollsLeft()).toBe(0);

    createOrder(useUiStore.getState().offers[0]);
    ensureOffers();
    expect(rerollsLeft()).toBe(1);
  });
});

describe("fever mode", () => {
  /** Plays a whole Wood Block (two machines) at one quality and returns the payout. */
  const playOrder = (quality: number) => {
    createOrder();
    run().dispatch("INTRO_DONE");
    playMachine(quality);
    playMachine(quality);
    return finishProduct();
  };

  it("stays empty until the feature unlocks at level 3", () => {
    playOrder(100);
    expect(player().fever).toEqual({ charge: 0, ordersLeft: 0 });
  });

  it("fills on Perfects, then pays double on three orders and resets", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 3, fever: { charge: 6, ordersLeft: 0 } });

    // The order that fills the meter is the first of the three.
    createOrder();
    run().dispatch("INTRO_DONE");
    playMachine(100);
    expect(run().feedback?.overdriveStarted).toBeFalsy();
    playMachine(100);
    expect(run().feedback?.overdriveStarted).toBe(true);
    expect(player().fever).toEqual({ charge: 0, ordersLeft: 3 });

    const first = finishProduct();
    expect(first?.overdrive).toBe(true);
    expect(player().fever.ordersLeft).toBe(2);

    const second = playOrder(80);
    const third = playOrder(80);
    expect(second?.overdrive).toBe(true);
    expect(third?.overdrive).toBe(true);
    expect(player().fever).toEqual({ charge: 0, ordersLeft: 0 });

    // Back to normal: the same order now pays half of what it did in Overdrive.
    const after = playOrder(80);
    expect(after?.overdrive).toBe(false);
    expect(third!.coins).toBe(after!.coins * 2);
  });

  it("doubles the payout and the projected value alike", () => {
    const input = {
      product: products.woodBlock,
      results: [],
      streak: 0,
      upgradeLevels: {},
      isGolden: false,
    };
    expect(projectOrderValue({ ...input, overdrive: true })).toBe(projectOrderValue(input) * 2);

    const results = [
      { machineId: "cutter" as const, productId: "woodBlock" as const, quality: 100, isPerfect: true, durationMs: 900 },
      { machineId: "packager" as const, productId: "woodBlock" as const, quality: 100, isPerfect: true, durationMs: 900 },
    ];
    const plain = resolveProductReward({ ...input, results });
    const hot = resolveProductReward({ ...input, results, overdrive: true });
    expect(hot.coins).toBe(plain.coins * 2);
    // Overdrive is about coins only.
    expect(hot.completionXp).toBe(plain.completionXp);
  });

  it("stacks with a Golden order", () => {
    const base = { product: products.woodBlock, results: [], streak: 0, upgradeLevels: {} };
    expect(projectOrderValue({ ...base, isGolden: true, overdrive: true })).toBe(100);
  });
});

describe("goals and achievements", () => {
  const goals = () => useGoalsStore.getState();
  const day = new Date(2026, 9, 4, 12);
  const machine = (perfect: boolean, streak = 0) =>
    recordProgress({ type: "machine", perfect, streak, overdriveStarted: false }, day);
  const order = (coins = 10) =>
    recordProgress({ type: "order", productId: "woodBlock", quality: 90, coins, isGolden: false, twistWon: false }, day);

  it("keeps stats from the start but deals no goals before level 2", () => {
    machine(true, 3);
    order();
    expect(goals().stats.bestStreak).toBe(3);
    expect(goals().stats.products.woodBlock).toEqual({ made: 1, bestQuality: 90 });
    expect(goals().goals.items).toHaveLength(0);
    expect(player().coins).toBe(0);
  });

  it("deals three goals for the day and keeps them until the date changes", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 2 });
    refreshGoals(day);
    const first = goals().goals;
    expect(first.items).toHaveLength(3);
    expect(first.date).toBe("2026-10-04");

    refreshGoals(new Date(2026, 9, 4, 23, 59));
    expect(goals().goals).toBe(first);

    refreshGoals(new Date(2026, 9, 5, 0, 1));
    expect(goals().goals.date).toBe("2026-10-05");
    expect(goals().goals.items.every((goal) => goal.progress === 0)).toBe(true);
  });

  it("pays a goal once when it is reached, with a toast and a dot on the tab", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 2 });
    useGoalsStore.getState().setGoals({
      date: "2026-10-04",
      bonusPaid: false,
      items: [
        { kind: "products", target: 2, progress: 0, done: false, reward: 54 },
        { kind: "perfects", target: 50, progress: 0, done: false, reward: 54 },
      ],
    });

    order();
    expect(player().coins).toBe(0);
    order();
    expect(goals().goals.items[0]).toMatchObject({ progress: 2, done: true });
    expect(player().coins).toBe(54);
    expect(goals().unseen).toBe(1);
    expect(useUiStore.getState().toast?.message).toContain("Goal complete: Make 2 products");

    order();
    expect(player().coins).toBe(54);
  });

  it("pays the bonus once when every goal is done", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 2 });
    useGoalsStore.getState().setGoals({
      date: "2026-10-04",
      bonusPaid: false,
      items: [
        { kind: "products", target: 1, progress: 0, done: false, reward: 54 },
        { kind: "coins", target: 10, progress: 0, done: false, reward: 54 },
      ],
    });
    order(10);
    // Two goals at 54 each, plus the all-done bonus of 108.
    expect(player().coins).toBe(216);
    expect(goals().goals.bonusPaid).toBe(true);
    order(10);
    expect(player().coins).toBe(216);
  });

  it("earns an achievement once and pays its reward", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 2 });
    // A day's goal that will not complete here, so only the achievement pays.
    useGoalsStore.getState().setGoals({
      date: "2026-10-04",
      bonusPaid: false,
      items: [{ kind: "products", target: 99, progress: 0, done: false, reward: 54 }],
    });
    machine(true, 5);
    expect(goals().achievements).toEqual(["streak5"]);
    expect(player().coins).toBe(40);
    machine(true, 6);
    expect(goals().achievements).toEqual(["streak5"]);
    expect(player().coins).toBe(40);
  });

  it("counts a real order: stats, goals and the Golden achievement", () => {
    usePlayerStore.getState().hydrate({ ...player(), factoryLevel: 2 });
    useUiStore.getState().setDebug({ goldenNext: true });
    createOrder();
    run().dispatch("INTRO_DONE");
    playMachine(100);
    playMachine(100);
    finishProduct();
    expect(goals().stats.goldenMade).toBe(1);
    expect(goals().stats.products.woodBlock).toEqual({ made: 1, bestQuality: 100 });
    expect(goals().achievements).toContain("golden1");
  });
});
