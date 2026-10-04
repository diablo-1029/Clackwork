import { describe, expect, it } from "vitest";
import { xpRequired } from "@/game/progression/levels";
import {
  SAVE_KEY,
  createFreshSave,
  getLastCorruptRaw,
  loadSave,
  migrateSave,
  writeSave,
  type StorageLike,
} from "./saveService";

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe("save service", () => {
  it("creates a fresh save when nothing is stored", () => {
    const { data, status } = loadSave(fakeStorage());
    expect(status).toBe("fresh");
    expect(data.schemaVersion).toBe(1);
    expect(data.player).toMatchObject({ coins: 0, xp: 0, factoryLevel: 1 });
    expect(data.unlocks.products).toEqual(["woodBlock"]);
  });

  it("round-trips a save", () => {
    const storage = fakeStorage();
    const save = createFreshSave();
    save.player.coins = 321;
    save.player.factoryLevel = 3;
    save.upgrades.betterMaterials = 2;
    expect(writeSave(save, storage)).toBe(true);

    const loaded = loadSave(storage);
    expect(loaded.status).toBe("loaded");
    expect(loaded.data.player.coins).toBe(321);
    expect(loaded.data.upgrades.betterMaterials).toBe(2);
  });

  it("falls back to a fresh save on invalid JSON and keeps the raw text", () => {
    const storage = fakeStorage({ [SAVE_KEY]: "{not json" });
    const { data, status } = loadSave(storage);
    expect(status).toBe("corrupt");
    expect(data.player.coins).toBe(0);
    expect(getLastCorruptRaw()).toBe("{not json");
  });

  it("rejects saves that fail validation", () => {
    const negative = createFreshSave();
    negative.player.coins = -50;
    expect(migrateSave(negative)).toBeNull();

    expect(migrateSave({ schemaVersion: 1 })).toBeNull();
    expect(migrateSave({ schemaVersion: 999 })).toBeNull();
    expect(migrateSave("nope")).toBeNull();
    expect(migrateSave(null)).toBeNull();
  });

  it("repairs unlocks the saved level entitles the player to", () => {
    const save = createFreshSave();
    save.player.factoryLevel = 5;
    const migrated = migrateSave(save);
    expect(migrated?.unlocks.machines).toEqual(expect.arrayContaining(["stamper", "polisher"]));
    expect(migrated?.unlocks.products).toContain("soapBar");
  });

  it("accepts saves with and without the newest product", () => {
    const withRobot = createFreshSave();
    withRobot.player.factoryLevel = 12;
    withRobot.unlocks.products.push("toyRobot");
    expect(migrateSave(withRobot)?.unlocks.products).toContain("toyRobot");

    // A save written before the Toy Robot existed gains it from its level on load.
    const older = createFreshSave();
    older.player.factoryLevel = 12;
    expect(migrateSave(older)?.unlocks.products).toContain("toyRobot");
    expect(migrateSave(older)?.unlocks.machines).toContain("assembler");
  });

  it("keeps the level and clamps XP saved under an older, steeper curve", () => {
    const save = createFreshSave();
    save.player.factoryLevel = 8;
    // Valid under the old curve (Level 8 needed 1,656 XP); the new one needs far less.
    save.player.xp = 1500;
    const migrated = migrateSave(save)!;
    expect(migrated.player.factoryLevel).toBe(8);
    expect(migrated.player.xp).toBe(xpRequired(8) - 1);
    expect(xpRequired(8)).toBeLessThan(700);
  });

  it("survives storage being unavailable or throwing", () => {
    expect(loadSave(null).status).toBe("unavailable");
    expect(writeSave(createFreshSave(), null)).toBe(false);

    const throwing: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
    };
    expect(loadSave(throwing).status).toBe("unavailable");
    expect(writeSave(createFreshSave(), throwing)).toBe(false);
  });

  it("loads a save from before the newer upgrades existed, with them at level 0", () => {
    const older = JSON.parse(JSON.stringify(createFreshSave()));
    older.upgrades = { betterMaterials: 3, goldenTouch: 1 };
    const migrated = migrateSave(older)!;
    expect(migrated.upgrades).toEqual({
      betterMaterials: 3,
      goldenTouch: 1,
      steadyHands: 0,
      streakShield: 0,
      freshOrders: 0,
      fastLearner: 0,
    });
  });

  it("clamps an upgrade level above its maximum", () => {
    const save = createFreshSave();
    save.upgrades.streakShield = 40;
    expect(migrateSave(save)?.upgrades.streakShield).toBe(3);
  });

  it("loads a save from before the fever meter existed, with the meter empty", () => {
    const older = JSON.parse(JSON.stringify(createFreshSave()));
    delete older.player.fever;
    expect(migrateSave(older)?.player.fever).toEqual({ charge: 0, ordersLeft: 0 });
  });

  it("keeps an Overdrive in progress across a reload", () => {
    const storage = fakeStorage();
    const save = createFreshSave();
    save.player.fever = { charge: 0, ordersLeft: 2 };
    writeSave(save, storage);
    expect(loadSave(storage).data.player.fever).toEqual({ charge: 0, ordersLeft: 2 });
  });
});
