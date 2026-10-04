"use client";

import { Chip, Tile } from "@/components/ui/Chunky";
import { Icon } from "@/components/ui/Icon";
import { machineList } from "@/config/machines";
import { productList } from "@/config/products";
import { isProductPlayable, resolveMachineSequence, stepName } from "@/game/progression/unlocks";
import { getMaterialColors } from "@/game/products/materialProfiles";
import { finishedLook } from "@/game/products/productLook";
import { ProductIcon } from "@/game/products/ProductRenderer";
import { useProgressionStore } from "@/stores/progressionStore";
import { LockedTag, ScreenFrame } from "./ScreenFrame";

export function ProductsScreen() {
  const unlockedProducts = useProgressionStore((s) => s.products);
  const unlockedMachines = useProgressionStore((s) => s.machines);
  const discovered = productList.filter((product) => unlockedProducts.includes(product.id)).length;

  return (
    <ScreenFrame
      title="Products"
      icon="product"
      intro="Everything your factory makes, and the machines that make it."
      aside={
        <Chip tone="gold" className="shrink-0 px-2.5 py-1 text-sm text-ink" aria-label={`${discovered} of ${productList.length} products unlocked`}>
          {discovered} / {productList.length}
        </Chip>
      }
    >
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {productList.map((product) => {
          const unlocked = unlockedProducts.includes(product.id);
          const sequence = resolveMachineSequence(product, unlockedMachines);
          const tint = getMaterialColors(product.materialProfile, false).base;
          return (
            <li key={product.id} className="sf-raised flex gap-3 rounded-3xl p-3">
              {/* The product on a shelf tinted with its own material. */}
              <div
                className="flex w-24 shrink-0 flex-col items-center justify-end overflow-hidden rounded-2xl pt-3"
                style={{
                  background: unlocked
                    ? `color-mix(in srgb, ${tint} 26%, var(--sf-surface))`
                    : "var(--sf-surface-2)",
                }}
              >
                <ProductIcon material={product.materialProfile} look={finishedLook(product)} size={76} locked={!unlocked} />
                <span className="mt-1.5 h-2.5 w-full bg-black/10" aria-hidden />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <h3 className={`flex items-center gap-1.5 leading-tight font-black uppercase ${unlocked ? "" : "text-muted"}`}>
                  {!unlocked && <Icon name="lock" size={15} />}
                  {product.name}
                </h3>
                <div>
                  <Chip tone="gold" className="text-sm text-ink">
                    <Icon name="coin" size={15} /> {product.baseValue}
                    <span className="sr-only"> Coins</span>
                  </Chip>
                </div>
                <ol className="flex flex-wrap gap-1" aria-label="Machines">
                  {sequence.map((id, index) => {
                    const name = stepName(product, sequence, index);
                    return (
                      <li key={`${id}-${index}`} title={name}>
                        <Tile tone={unlocked ? "blue" : "neutral"} className="size-7 rounded-lg">
                          <Icon name={id} size={15} />
                        </Tile>
                        <span className="sr-only">{name}</span>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-auto">
                  {unlocked ? (
                    <Chip tone="green" className="text-success">
                      <Icon name="check" size={12} strokeWidth={3} /> Unlocked
                    </Chip>
                  ) : isProductPlayable(product) ? (
                    <LockedTag level={product.unlockLevel} />
                  ) : (
                    <Chip className="text-muted">Level {product.unlockLevel} · coming in a future update</Chip>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-6 text-lg font-black">Machines</h3>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {machineList.map((machine) => {
          const unlocked = unlockedMachines.includes(machine.id);
          return (
            <li key={machine.id} className="sf-raised flex items-center gap-3 rounded-3xl p-3">
              <Tile tone={unlocked ? "deep" : "neutral"} className="size-12 rounded-2xl">
                <Icon name={unlocked ? machine.id : "lock"} />
              </Tile>
              <div className="min-w-0 flex-1">
                <h4 className={`font-black ${unlocked ? "" : "text-muted"}`}>{machine.name}</h4>
                <p className="text-xs font-bold text-muted">{machine.description}</p>
                {!unlocked && (
                  <div className="mt-1.5">
                    {machine.implemented ? (
                      <LockedTag level={machine.unlockLevel} />
                    ) : (
                      <Chip className="text-muted">Level {machine.unlockLevel} · coming in a future update</Chip>
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
