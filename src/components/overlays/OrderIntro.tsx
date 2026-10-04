"use client";

import { motion } from "framer-motion";
import { Fragment } from "react";
import { Ribbon } from "@/components/ui/Chunky";
import { Icon } from "@/components/ui/Icon";
import { products } from "@/config/products";
import { finishedLook } from "@/game/products/productLook";
import { stepName } from "@/game/progression/unlocks";
import { ProductIcon } from "@/game/products/ProductRenderer";
import type { ProductionRun } from "@/types/game";

/** A brief card announcing the order. Tapping it skips straight to the first machine. */
export function OrderIntro({ run, onSkip }: { run: ProductionRun; onSkip: () => void }) {
  const product = products[run.productId];

  return (
    <button
      type="button"
      onClick={onSkip}
      className="absolute inset-0 flex items-center justify-center p-4"
      aria-label={`New order: ${run.isGolden ? "Golden " : ""}${product.name}. Tap to start.`}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 14 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 24 }}
        className={`sf-raised flex w-full max-w-sm flex-col items-center gap-2 rounded-3xl p-6 text-ink ${
          run.isGolden ? "!border-gold ring-4 ring-gold" : ""
        }`}
      >
        {run.isGolden ? (
          <Ribbon tone="gold" className="text-sm">
            <Icon name="sparkle" size={15} fill="currentColor" strokeWidth={0} />
            Golden product!
          </Ribbon>
        ) : (
          <Ribbon tone="deep">New order</Ribbon>
        )}
        <ProductIcon material={product.materialProfile} isGolden={run.isGolden} look={finishedLook(product, run.isGolden)} size={96} />
        <h2 className="text-2xl font-black tracking-wide uppercase">{product.name}</h2>
        <p className="flex items-center gap-1.5 text-sm font-extrabold text-muted">
          Base Value: <Icon name="coin" size={16} /> {product.baseValue} Coins
          {run.isGolden && <span className="text-orange">x5</span>}
        </p>
        <p className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-sm font-extrabold">
          {run.machineSequence.map((id, index) => (
            <Fragment key={`${id}-${index}`}>
              {index > 0 && <Icon name="arrowRight" size={14} className="text-muted" />}
              <span className="sf-chip sf-tone-blue flex items-center gap-1 rounded-lg px-2 py-1">
                <Icon name={id} size={14} />
                {stepName(product, run.machineSequence, index)}
              </span>
            </Fragment>
          ))}
        </p>
      </motion.div>
    </button>
  );
}
