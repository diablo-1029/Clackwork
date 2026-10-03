"use client";

import { motion } from "framer-motion";
import { audio } from "@/audio/audioManager";
import { Icon } from "@/components/ui/Icon";
import { products } from "@/config/products";
import { describeTwist } from "@/game/core/orders";
import { finishedLook } from "@/game/products/productLook";
import { ProductIcon } from "@/game/products/ProductRenderer";
import { resolveMachineSequence } from "@/game/progression/unlocks";
import { useProgressionStore } from "@/stores/progressionStore";
import type { OrderOffer } from "@/types/game";

/** The cards the player picks the next order from. One tap chooses and starts it. */
export function OrderBoard({ offers, onPick }: { offers: OrderOffer[]; onPick: (offer: OrderOffer) => void }) {
  const unlockedMachines = useProgressionStore((s) => s.machines);

  return (
    <div className="w-full">
      <h3 className="mb-2 text-center text-xs font-black tracking-[0.2em] text-muted uppercase">Choose your next order</h3>
      <ul className="grid grid-cols-3 gap-2">
        {offers.map((offer, index) => {
          const product = products[offer.productId];
          const steps = resolveMachineSequence(product, unlockedMachines).length;
          const twist = offer.twist ? describeTwist(offer.twist) : null;
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
                className={`relative flex h-full min-h-36 w-full flex-col items-center gap-1 rounded-2xl border-2 bg-surface-2 px-1.5 pt-3 pb-2 text-center transition-transform hover:-translate-y-0.5 active:scale-[0.97] ${
                  offer.isGolden ? "border-gold" : "border-transparent hover:border-brand"
                }`}
              >
                {(offer.isGolden || offer.isNew) && (
                  <span
                    className={`absolute -top-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                      offer.isGolden ? "bg-gold text-navy" : "bg-brand-deep text-white"
                    }`}
                  >
                    {offer.isGolden && <Icon name="sparkle" size={10} fill="currentColor" strokeWidth={0} />}
                    {offer.isGolden ? "GOLDEN" : "NEW"}
                  </span>
                )}
                <ProductIcon material={product.materialProfile} isGolden={offer.isGolden} look={finishedLook(product, offer.isGolden)} size={52} />
                <span className="text-xs leading-tight font-black uppercase sm:text-sm">{product.name}</span>
                <span className="flex items-center gap-1 text-xs font-extrabold">
                  <Icon name="coin" size={13} />
                  {product.baseValue}
                  {offer.isGolden && <span className="text-orange">x5</span>}
                </span>
                <span className="text-[11px] font-bold text-muted">{steps} steps</span>
                {twist && (
                  <span className="mt-auto w-full rounded-lg bg-orange/15 px-1 py-1 text-[10px] leading-tight font-extrabold text-orange">
                    <span className="block uppercase">{twist.name}</span>
                    <span className="block font-bold">{twist.rule}</span>
                  </span>
                )}
              </button>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
