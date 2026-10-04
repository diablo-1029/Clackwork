"use client";

import { motion } from "framer-motion";
import { audio } from "@/audio/audioManager";
import type { Tone } from "@/components/ui/Chunky";
import { Icon } from "@/components/ui/Icon";
import { products } from "@/config/products";
import { describeTwist } from "@/game/core/orders";
import { rerollOffers } from "@/game/core/runActions";
import { getRerollCount } from "@/game/economy/multipliers";
import { finishedLook } from "@/game/products/productLook";
import { ProductIcon } from "@/game/products/ProductRenderer";
import { resolveMachineSequence } from "@/game/progression/unlocks";
import { useProgressionStore } from "@/stores/progressionStore";
import { useUiStore } from "@/stores/uiStore";
import type { OrderOffer } from "@/types/game";

const twistTone: Record<NonNullable<OrderOffer["twist"]>, Tone> = {
  rush: "orange",
  precision: "deep",
  training: "green",
};

/** The order tickets the player picks the next order from. One tap chooses and starts it. */
export function OrderBoard({ offers, onPick }: { offers: OrderOffer[]; onPick: (offer: OrderOffer) => void }) {
  const unlockedMachines = useProgressionStore((s) => s.machines);
  // Fresh Orders: the button only exists once the upgrade is owned.
  const rerolls = useProgressionStore((s) => getRerollCount(s.upgrades));
  const rerollsLeft = Math.max(0, rerolls - useUiStore((s) => s.rerollsUsed));

  return (
    <div className="w-full">
      <h3 className="mb-2 text-center text-xs font-black tracking-[0.2em] text-muted uppercase">Choose your next order</h3>
      <ul className="grid grid-cols-3 gap-2">
        {offers.map((offer, index) => {
          const product = products[offer.productId];
          const steps = resolveMachineSequence(product, unlockedMachines).length;
          const twist = offer.twist ? describeTwist(offer.twist) : null;
          const tone: Tone = offer.isGolden ? "gold" : offer.twist ? twistTone[offer.twist] : "blue";
          const label = [
            offer.isGolden ? "Golden" : "",
            product.name,
            `${product.baseValue} coins`,
            `${steps} steps`,
            offer.isNew ? "new" : "",
            twist ? `${twist.name}: ${twist.rule}` : "",
          ]
            .filter(Boolean)
            .join(", ");

          return (
            <motion.li
              key={offer.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
            >
              <button
                type="button"
                aria-label={label}
                onClick={() => {
                  audio.play("uiClick");
                  onPick(offer);
                }}
                className={`sf-raised relative flex h-full w-full flex-col items-center gap-1 overflow-hidden rounded-2xl pb-2 text-center text-ink transition-transform hover:-translate-y-0.5 active:translate-y-[3px] active:shadow-none ${
                  offer.isGolden ? "!border-gold" : "hover:!border-brand"
                }`}
              >
                {/* The ticket's header strip: what kind of order this is. */}
                <span
                  className={`sf-tile sf-tone-${tone} flex h-6 w-full items-center justify-center gap-1 text-[10px] font-black tracking-wider uppercase`}
                >
                  {offer.isGolden && <Icon name="sparkle" size={10} fill="currentColor" strokeWidth={0} />}
                  {offer.isGolden ? "Golden" : twist ? twist.name : offer.isNew ? "New" : "Order"}
                </span>
                <span className="mt-1.5 flex h-11 items-center">
                  <ProductIcon
                    material={product.materialProfile}
                    isGolden={offer.isGolden}
                    look={finishedLook(product, offer.isGolden)}
                    size={52}
                  />
                </span>
                <span className="px-1 text-xs leading-tight font-black uppercase sm:text-sm">{product.name}</span>
                <span className="sf-chip sf-tone-gold flex items-center gap-1 rounded-lg px-1.5 text-xs font-black">
                  <Icon name="coin" size={13} />
                  {product.baseValue}
                  {offer.isGolden && <span className="text-orange">x5</span>}
                </span>
                {/* One pip per machine the order visits. */}
                <span className="flex flex-col items-center gap-0.5" aria-hidden>
                  <span className="flex gap-0.5">
                    {Array.from({ length: steps }, (_, i) => (
                      <span key={i} className="size-1.5 rounded-full bg-brand" />
                    ))}
                  </span>
                  <span className="text-[10px] leading-none font-bold text-muted">{steps} steps</span>
                </span>
                {twist && (
                  <span className="mt-auto px-1.5 text-[10px] leading-tight font-bold text-muted">{twist.rule}</span>
                )}
              </button>
            </motion.li>
          );
        })}
      </ul>
      {rerolls > 0 && (
        <button
          type="button"
          disabled={rerollsLeft === 0}
          onClick={() => {
            if (rerollOffers()) audio.play("uiClick");
          }}
          className="sf-chip sf-tone-blue mx-auto mt-3 flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-black transition-transform active:translate-y-0.5 disabled:opacity-50"
        >
          <Icon name="reroll" size={16} />
          Reroll
          <span className="font-bold text-muted">{rerollsLeft} left</span>
        </button>
      )}
    </div>
  );
}
