"use client";

import { Fragment } from "react";
import { Icon } from "@/components/ui/Icon";
import { machineList, machines } from "@/config/machines";
import { productList } from "@/config/products";
import { isProductPlayable, resolveMachineSequence } from "@/game/progression/unlocks";
import { ProductIcon } from "@/game/products/ProductRenderer";
import { useProgressionStore } from "@/stores/progressionStore";
import { LockedTag, ScreenFrame } from "./ScreenFrame";

export function ProductsScreen() {
  const unlockedProducts = useProgressionStore((s) => s.products);
  const unlockedMachines = useProgressionStore((s) => s.machines);

  return (
    <ScreenFrame title="Products" intro="Everything your factory makes, and the machines that make it.">
      <ul className="grid gap-3 sm:grid-cols-2">
        {productList.map((product) => {
          const unlocked = unlockedProducts.includes(product.id);
          const sequence = resolveMachineSequence(product, unlockedMachines);
          return (
            <li key={product.id} className={`flex gap-3 rounded-2xl border border-line p-3 ${unlocked ? "" : "opacity-75"}`}>
              <div className="flex w-20 shrink-0 items-center justify-center rounded-xl bg-surface-2">
                <ProductIcon material={product.materialProfile} size={64} locked={!unlocked} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-1.5 font-black uppercase">
                  {!unlocked && <Icon name="lock" size={15} className="text-muted" />}
                  {product.name}
                </h3>
                <p className="flex items-center gap-1 text-sm font-extrabold">
                  <Icon name="coin" size={15} /> {product.baseValue} Coins
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-1 text-xs font-bold text-muted">
                  {sequence.map((id, index) => (
                    <Fragment key={`${id}-${index}`}>
                      {index > 0 && <Icon name="arrowRight" size={12} />}
                      <span>{machines[id].name}</span>
                    </Fragment>
                  ))}
                </p>
                <div className="mt-2">
                  {unlocked ? (
                    <span className="rounded-lg bg-success/15 px-2 py-1 text-xs font-extrabold text-success">Unlocked</span>
                  ) : isProductPlayable(product) ? (
                    <LockedTag level={product.unlockLevel} />
                  ) : (
                    <span className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-extrabold text-muted">
                      Level {product.unlockLevel} · coming in a future update
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-6 text-lg font-black">Machines</h3>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2">
        {machineList.map((machine) => {
          const unlocked = unlockedMachines.includes(machine.id);
          return (
            <li key={machine.id} className={`flex items-center gap-3 rounded-2xl border border-line p-3 ${unlocked ? "" : "opacity-75"}`}>
              <span
                className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${
                  unlocked ? "bg-brand-deep text-white" : "bg-surface-2 text-muted"
                }`}
              >
                <Icon name={unlocked ? machine.id : "lock"} />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="font-black">{machine.name}</h4>
                <p className="text-xs font-bold text-muted">{machine.description}</p>
                {!unlocked && (
                  <div className="mt-1.5">
                    {machine.implemented ? (
                      <LockedTag level={machine.unlockLevel} />
                    ) : (
                      <span className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-extrabold text-muted">
                        Level {machine.unlockLevel} · coming in a future update
                      </span>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </ScreenFrame>
  );
}
