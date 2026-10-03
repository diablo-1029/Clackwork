import type { Point } from "@/lib/math";
import type { ProductLook } from "@/game/products/productLook";
import type { MaterialProfile, ProductDefinition } from "@/types/game";

/** Every machine draws into the same 4:3 stage so layout and input math are shared. */
export const STAGE = { w: 400, h: 300 } as const;

/** Where the product sits on the stage for machines that work on it directly. */
export const PRODUCT_RECT = { x: 100, y: 85, w: 200, h: 130, r: 16 } as const;

export interface MachineCompletion {
  quality: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface MachineProps {
  runId: string;
  product: ProductDefinition;
  material: MaterialProfile;
  isGolden: boolean;
  /** 0–1, how far Better Materials has been upgraded; purely cosmetic. */
  richness: number;
  /** Marks earlier machines left on this product. */
  look: ProductLook;
  factoryLevel: number;
  /** Input is accepted only while true. */
  active: boolean;
  /** Show the extra first-time hint animation. */
  showHint: boolean;
  onInteractionStart: () => void;
  onInteractionCancel: () => void;
  /** Report the result. The run controller ignores repeat calls. */
  onComplete: (completion: MachineCompletion) => void;
  /** Spawn decorative particles at a stage position. */
  burst: (at: Point, options?: BurstOptions) => void;
}

export interface BurstOptions {
  count?: number;
  colors?: string[];
  spread?: number;
  shape?: "dot" | "chip" | "spark";
}

/** Converts a pointer event position into stage coordinates. Null if the stage has no size. */
export function toStagePoint(
  event: { clientX: number; clientY: number },
  element: Element | null,
): Point | null {
  const rect = element?.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return null;
  return {
    x: ((event.clientX - rect.left) / rect.width) * STAGE.w,
    y: ((event.clientY - rect.top) / rect.height) * STAGE.h,
  };
}
