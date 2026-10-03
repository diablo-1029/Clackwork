"use client";

import { Button } from "@/components/ui/Button";
import { machineList } from "@/config/machines";
import { productList } from "@/config/products";
import { grantXp } from "@/game/core/runActions";
import { isProductPlayable } from "@/game/progression/unlocks";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import { useUiStore } from "@/stores/uiStore";

/**
 * Development-only tools. The settings screen renders this behind a
 * NODE_ENV check, so it is compiled out of production builds.
 */
export function DebugPanel() {
  const level = usePlayerStore((s) => s.factoryLevel);
  const debug = useUiStore((s) => s.debug);
  const setDebug = useUiStore((s) => s.setDebug);

  const setLevel = (next: number) => {
    usePlayerStore.getState().setLevel(next);
    useProgressionStore.getState().syncUnlocks(next);
  };

  const unlockAll = () => {
    const progression = useProgressionStore.getState();
    machineList.filter((m) => m.implemented).forEach((m) => progression.unlockMachine(m.id));
    productList.filter(isProductPlayable).forEach((p) => progression.unlockProduct(p.id));
  };

  return (
    <div className="mt-6 rounded-2xl border-2 border-dashed border-orange p-3">
      <h3 className="text-xs font-black tracking-widest text-orange uppercase">Debug (development only)</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => usePlayerStore.getState().addCoins(1000)}>
          +1000 Coins
        </Button>
        <Button variant="ghost" onClick={() => grantXp(100)}>
          +100 XP
        </Button>
        <Button variant="ghost" onClick={() => setLevel(level + 1)}>
          Set Level {level + 1}
        </Button>
        <Button variant="ghost" onClick={() => setLevel(Math.max(1, level - 1))} disabled={level <= 1}>
          Set Level {Math.max(1, level - 1)}
        </Button>
        <Button variant="ghost" onClick={unlockAll}>
          Unlock All Machines + Products
        </Button>
        <Button variant="ghost" onClick={() => setDebug({ goldenNext: !debug.goldenNext })} aria-pressed={debug.goldenNext}>
          Golden Next Product: {debug.goldenNext ? "on" : "off"}
        </Button>
        <Button variant="ghost" onClick={() => setDebug({ stressBursts: debug.stressBursts + 1 })}>
          Particle Stress Test
        </Button>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm font-bold">
        Quality override
        <input
          type="number"
          min={0}
          max={100}
          placeholder="off"
          value={debug.qualityOverride ?? ""}
          onChange={(event) =>
            setDebug({ qualityOverride: event.target.value === "" ? null : Number(event.target.value) })
          }
          className="h-11 w-24 rounded-xl border border-line bg-surface px-2"
        />
      </label>
      <p className="mt-2 text-xs font-bold text-muted">
        The stress test runs on the factory floor while a machine is on screen. Reset Save and Reduced Motion are in
        the settings above.
      </p>
    </div>
  );
}
