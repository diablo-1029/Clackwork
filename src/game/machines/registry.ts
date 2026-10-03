import type { ComponentType } from "react";
import type { MachineId } from "@/types/game";
import { AssemblerMachine } from "./assembler/AssemblerMachine";
import { CutterMachine } from "./cutter/CutterMachine";
import { PackagerMachine } from "./packager/PackagerMachine";
import { PaintBoothMachine } from "./paintBooth/PaintBoothMachine";
import { PolisherMachine } from "./polisher/PolisherMachine";
import type { MachineProps } from "./shared";
import { SorterMachine } from "./sorter/SorterMachine";
import { StamperMachine } from "./stamper/StamperMachine";

/**
 * Playable machine modules. Adding a machine means building its module,
 * registering it here and flipping `implemented` in config/machines.ts.
 */
export const machineComponents: Partial<Record<MachineId, ComponentType<MachineProps>>> = {
  cutter: CutterMachine,
  assembler: AssemblerMachine,
  paintBooth: PaintBoothMachine,
  stamper: StamperMachine,
  polisher: PolisherMachine,
  sorter: SorterMachine,
  packager: PackagerMachine,
};
