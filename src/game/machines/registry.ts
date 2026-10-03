import type { ComponentType } from "react";
import type { MachineId } from "@/types/game";
import { CutterMachine } from "./cutter/CutterMachine";
import { PackagerMachine } from "./packager/PackagerMachine";
import { PolisherMachine } from "./polisher/PolisherMachine";
import type { MachineProps } from "./shared";
import { StamperMachine } from "./stamper/StamperMachine";

/**
 * Playable machine modules. Adding a machine means building its module,
 * registering it here and flipping `implemented` in config/machines.ts.
 */
export const machineComponents: Partial<Record<MachineId, ComponentType<MachineProps>>> = {
  cutter: CutterMachine,
  stamper: StamperMachine,
  polisher: PolisherMachine,
  packager: PackagerMachine,
};
