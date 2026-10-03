import { products } from "@/config/products";
import { getGoldenChance } from "@/game/economy/multipliers";
import type { ProductId } from "@/types/game";

/** Weighted pick from the products the player can currently produce. */
export function pickProduct(unlocked: ProductId[], random: () => number = Math.random): ProductId {
  const pool = unlocked.filter((id) => products[id]);
  if (pool.length === 0) return "woodBlock";

  const total = pool.reduce((sum, id) => sum + products[id].orderWeight, 0);
  let roll = random() * total;
  for (const id of pool) {
    roll -= products[id].orderWeight;
    if (roll < 0) return id;
  }
  return pool[pool.length - 1];
}

/** Rolled once when the order is created; the whole run keeps the outcome. */
export function rollGolden(goldenTouchLevel: number, random: () => number = Math.random): boolean {
  return random() < getGoldenChance(goldenTouchLevel);
}
