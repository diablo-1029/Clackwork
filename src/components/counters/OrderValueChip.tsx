"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { useAnimatedNumber } from "@/components/ui/useAnimatedNumber";

/**
 * What the current order is worth right now. It moves after every machine, so
 * the player sees their work turn into coins before the product is finished.
 */
export function OrderValueChip({ value }: { value: number }) {
  const shown = useAnimatedNumber(value, 350);

  return (
    <motion.span
      // Re-keyed when the value changes so the chip pops.
      key={value}
      initial={{ scale: 1.25 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 480, damping: 16 }}
      className="sf-chip sf-tone-gold flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-sm font-black text-ink tabular-nums"
      aria-label={`Order value ${value} coins`}
    >
      <Icon name="coin" size={15} />
      <span aria-hidden>{shown}</span>
    </motion.span>
  );
}
