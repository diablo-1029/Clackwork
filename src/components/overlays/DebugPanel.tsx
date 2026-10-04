"use client";

import { Button } from "@/components/ui/Button";
import { machineList } from "@/config/machines";
import { productList } from "@/config/products";
import { grantXp } from "@/game/core/runActions";
import { isProductPlayable } from "@/game/progression/unlocks";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import { useUiStore } from "@/stores/uiStore";
import type { ProductId } from "@/types/game";

/**
 * Development-only tools. The settings screen renders this behind a
 * NODE_ENV check, so it is compiled out of production builds.
 */
export function DebugPanel() {
  const level = usePlayerStore((s) => s.factoryLevel);
  const debug = useUiStore((s) => s.debug);
  const setDebug = useUiStore((s) => s.setDebug);
  const queuedProducts = useUiStore((s) => s.queuedProducts);

  // Replaces whatever is queued, so the choice here is always the very next order.
  const setNextProduct = (id: ProductId | "") => {
    useUiStore.setState({ queuedProducts: id ? [id] : [] });
  };

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
    <div className="mt-4 rounded-3xl border-2 border-dashed border-orange bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-black tracking-widest text-orange uppercase">Debug tools</h3>
        <button
          type="button"
          className="min-h-9 rounded-lg px-2 text-xs font-black text-muted underline"
          onClick={() => useUiStore.getState().toggleDebugTools()}
        >
          Hide
        </button>
      </div>
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
      <label className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold">
        Next product
        <select
          value={queuedProducts[0] ?? ""}
          onChange={(event) => setNextProduct(event.target.value as ProductId | "")}
          className="h-11 rounded-xl border border-line bg-surface px-2"
        >
          <option value="">Random (normal)</option>
          {productList.filter(isProductPlayable).map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        <span className="text-xs font-bold text-muted">
          Applies to the next order created, even if the product is still locked.
        </span>
      </label>
      <label className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold">
        Machine variant
        <select
          value={debug.variantIndex ?? ""}
          onChange={(event) => setDebug({ variantIndex: event.target.value === "" ? null : Number(event.target.value) })}
          className="h-11 rounded-xl border border-line bg-surface px-2"
        >
          <option value="">Normal (by level)</option>
          <option value="0">Always the basic one</option>
          <option value="1">Always the 2nd</option>
          <option value="2">Always the 3rd</option>
          <option value="3">Always the 4th</option>
        </select>
        <span className="text-xs font-bold text-muted">
          Applies from the next machine. Machines with fewer variants use their last one.
        </span>
      </label>
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
