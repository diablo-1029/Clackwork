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
    description: "Painted, then given a face, one part at a time.",
    unlockLevel: 12,
    baseValue: 50,
    // Painted before assembly so the spray never buries the face.
    machineSequence: ["paintBooth", "assembler", "packager"],
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
