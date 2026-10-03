import type { ProductDefinition, ProductId } from "@/types/game";

export const products: Record<ProductId, ProductDefinition> = {
  woodBlock: {
    id: "woodBlock",
    name: "Wood Block",
    description: "A simple starter product.",
    unlockLevel: 1,
    baseValue: 10,
    machineSequence: ["cutter", "packager"],
    orderWeight: 70,
    visualKey: "wood-block",
    materialProfile: "wood",
  },

  soapBar: {
    id: "soapBar",
    name: "Soap Bar",
    description: "Smooth, soft, and satisfying to finish.",
    unlockLevel: 3,
    baseValue: 18,
    machineSequence: ["cutter", "stamper", "packager"],
    sequenceVariants: [
      {
        requiresMachine: "polisher",
        machineSequence: ["cutter", "stamper", "polisher", "packager"],
      },
    ],
    orderWeight: 30,
    visualKey: "soap-bar",
    materialProfile: "soap",
  },

  ceramicCoaster: {
    id: "ceramicCoaster",
    name: "Ceramic Coaster",
    description: "Painted, stamped and glazed.",
    unlockLevel: 8,
    baseValue: 32,
    machineSequence: ["paintBooth", "stamper", "polisher", "packager"],
    orderWeight: 25,
    visualKey: "ceramic-coaster",
    materialProfile: "ceramic",
  },

  crystal: {
    id: "crystal",
    name: "Crystal",
    description: "Cut and polished until it gleams.",
    unlockLevel: 10,
    baseValue: 45,
    machineSequence: ["cutter", "polisher", "sorter", "packager"],
    orderWeight: 20,
    visualKey: "crystal",
    materialProfile: "crystal",
    rarity: "rare",
  },

  toyRobot: {
    id: "toyRobot",
    name: "Toy Robot",
    description: "Each section is built on its own, then put together.",
    unlockLevel: 12,
    // The longest chain in the factory, so the most valuable product.
    baseValue: 90,
    // Painted first: the Paint Booth sets the colour every part is made in.
    // The Assembler is then visited once per section, and once more for the final build
    // (the steps themselves are defined in machines/assembler/assemblerScoring.ts).
    machineSequence: ["paintBooth", "assembler", "assembler", "assembler", "assembler", "assembler", "packager"],
    stepLabels: [null, "Head", "Arms", "Legs", "Torso", "Build", null],
    stepHints: [
      null,
      "Fit the eyes, mouth and aerial.",
      "Fit a shoulder and a gripper to each arm.",
      "Fit a knee guard and a foot to each leg.",
      "Fit the gauge, buttons, neck and belt.",
      "Attach the head, arms and legs.",
      null,
    ],
    orderWeight: 20,
    visualKey: "toy-robot",
    materialProfile: "plastic",
  },

  goldIngot: {
    id: "goldIngot",
    name: "Gold Ingot",
    description: "Heavy, stamped, and mirror-bright.",
    unlockLevel: 15,
    baseValue: 60,
    machineSequence: ["stamper", "polisher", "sorter", "packager"],
    orderWeight: 15,
    visualKey: "gold-ingot",
    materialProfile: "gold",
    rarity: "rare",
  },
};

export const productList: ProductDefinition[] = Object.values(products).sort(
  (a, b) => a.unlockLevel - b.unlockLevel,
);
