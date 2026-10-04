import { machineList, machines } from "@/config/machines";
import { productList } from "@/config/products";
import { featureUnlocks } from "@/config/progression";
import { themeList } from "@/config/themes";
import { upgradeList } from "@/config/upgrades";
import { cutPatterns } from "@/game/machines/cutter/cutterGeometry";
import { machineVariants } from "@/game/machines/variants";
import type { MachineId, ProductDefinition, ProductId } from "@/types/game";

/** A product can only be produced when it is released and every machine in its chain is playable. */
export function isProductPlayable(product: ProductDefinition): boolean {
  return product.released !== false && product.machineSequence.every((id) => machines[id]?.implemented);
}

export function machinesUnlockedAt(level: number): MachineId[] {
  return machineList.filter((m) => m.implemented && m.unlockLevel <= level).map((m) => m.id);
}

export function productsUnlockedAt(level: number): ProductId[] {
  return productList
    .filter((p) => p.unlockLevel <= level && isProductPlayable(p))
    .map((p) => p.id);
}

/** The chain a product runs through, given which machines the player owns. */
export function resolveMachineSequence(
  product: ProductDefinition,
  unlockedMachines: MachineId[],
): MachineId[] {
  let sequence = product.machineSequence;
  for (const variant of product.sequenceVariants ?? []) {
    if (unlockedMachines.includes(variant.requiresMachine)) sequence = variant.machineSequence;
  }
  return sequence;
}

/** What to call step `index` of a product's chain: its own label if it has one, else the machine's name. */
export function stepName(product: ProductDefinition, sequence: MachineId[], index: number): string {
  // Labels describe the product's base chain; a variant chain (different steps) does not get them.
  const base = product.machineSequence;
  const sameChain = sequence.length === base.length && sequence.every((id, i) => id === base[i]);
  const label = sameChain ? product.stepLabels?.[index] : null;
  return label ?? machines[sequence[index]]?.name ?? "";
}

export type UnlockKind = "machine" | "product" | "upgrade" | "technique" | "theme" | "feature";

export interface UnlockEntry {
  kind: UnlockKind;
  id: string;
  name: string;
  description: string;
  level: number;
}

/**
 * New ways for a machine to play that start coming up at `level`. A variant
 * cannot appear before its machine does, so it is announced at whichever is later.
 */
function techniquesAtLevel(level: number): UnlockEntry[] {
  const entries: UnlockEntry[] = [];
  for (const machine of machineList.filter((m) => m.implemented)) {
    for (const variant of machineVariants[machine.id].slice(1)) {
      if (Math.max(variant.minLevel, machine.unlockLevel) !== level) continue;
      entries.push({
        kind: "technique",
        id: `${machine.id}:${variant.id}`,
        name: `${machine.name}: ${variant.name}`,
        description: variant.instruction ?? machine.description,
        level,
      });
    }
  }
  // Several cut patterns can share a name (the two double cuts); announce each name once.
  const cuts = new Set(cutPatterns.filter((p) => p.name && p.minLevel === level).map((p) => p.name as string));
  for (const name of cuts) {
    entries.push({
      kind: "technique",
      id: `cutter:${name}`,
      name: `${machines.cutter.name}: ${name}`,
      description: "A new pattern for the Cutter.",
      level,
    });
  }
  return entries;
}

/** Everything that becomes available exactly at `level`, playable content only. */
export function getUnlocksAtLevel(level: number): UnlockEntry[] {
  return [
    ...machineList
      .filter((m) => m.implemented && m.unlockLevel === level)
      .map((m): UnlockEntry => ({ kind: "machine", id: m.id, name: m.name, description: m.description, level })),
    ...productList
      .filter((p) => p.unlockLevel === level && isProductPlayable(p))
      .map((p): UnlockEntry => ({ kind: "product", id: p.id, name: p.name, description: p.description, level })),
    ...upgradeList
      .filter((u) => u.unlockLevel === level)
      .map((u): UnlockEntry => ({ kind: "upgrade", id: u.id, name: u.name, description: u.description, level })),
    ...featureUnlocks
      .filter((f) => f.unlockLevel === level)
      .map((f): UnlockEntry => ({ kind: "feature", id: f.id, name: f.name, description: f.description, level })),
    ...techniquesAtLevel(level),
    ...themeList
      .filter((t) => t.cost > 0 && t.unlockLevel === level)
      .map((t): UnlockEntry => ({ kind: "theme", id: t.id, name: `${t.name} theme`, description: t.description, level })),
  ];
}

/** The nearest future level that unlocks something, for "next goal" hints. */
export function getNextUnlock(level: number, maxLookahead = 30): UnlockEntry | null {
  for (let l = level + 1; l <= level + maxLookahead; l++) {
    const entries = getUnlocksAtLevel(l);
    if (entries.length > 0) return entries[0];
  }
  return null;
}

export function isFeatureUnlocked(id: (typeof featureUnlocks)[number]["id"], level: number): boolean {
  const feature = featureUnlocks.find((f) => f.id === id);
  return feature ? level >= feature.unlockLevel : false;
}
