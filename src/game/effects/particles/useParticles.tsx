"use client";

import { motion } from "framer-motion";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { STAGE, type BurstOptions } from "@/game/machines/shared";
import type { Point } from "@/lib/math";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ParticleDensity } from "@/types/settings";

/** Hard caps on live decorative particles, per the performance budget. */
export const PARTICLE_CAP = 60;
export const PARTICLE_CAP_REDUCED = 18;

const densityScale: Record<ParticleDensity, number> = { low: 0.5, medium: 1, high: 1.6 };

interface Particle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
  rotate: number;
  duration: number;
  shape: NonNullable<BurstOptions["shape"]>;
}

const defaultColors = ["var(--fx-particle)", "var(--fx-accent)", "#ffffff"];

/**
 * A small DOM particle system for one machine stage. `burst` takes stage
 * coordinates; `layer` must be rendered inside the stage's 4:3 box.
 */
export function useParticles(): { burst: (at: Point, options?: BurstOptions) => void; layer: ReactNode } {
  const [particles, setParticles] = useState<Particle[]>([]);
  const nextId = useRef(0);
  const density = useSettingsStore((s) => s.particleDensity);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  const burst = useCallback(
    (at: Point, options: BurstOptions = {}) => {
      const cap = reducedMotion ? PARTICLE_CAP_REDUCED : PARTICLE_CAP;
      const scale = densityScale[density] * (reducedMotion ? 0.35 : 1);
      const count = Math.max(reducedMotion ? 0 : 1, Math.round((options.count ?? 10) * scale));
      if (count === 0) return;

      const colors = options.colors ?? defaultColors;
      const spread = options.spread ?? 60;
      const shape = options.shape ?? "dot";

      const created: Particle[] = Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        const reach = spread * (0.35 + Math.random() * 0.65);
        return {
          id: nextId.current++,
          x: at.x,
          y: at.y,
          dx: Math.cos(angle) * reach,
          // Bias downwards a little so debris appears to fall.
          dy: Math.sin(angle) * reach * 0.8 + spread * 0.25,
          size: shape === "spark" ? 5 + Math.random() * 5 : 4 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotate: (Math.random() - 0.5) * 320,
          duration: 0.45 + Math.random() * 0.35,
          shape,
        };
      });

      // Oldest particles are dropped first so the cap always holds.
      setParticles((current) => [...current, ...created].slice(-cap));
    },
    [density, reducedMotion],
  );

  const remove = useCallback((id: number) => {
    setParticles((current) => current.filter((p) => p.id !== id));
  }, []);

  const layer = (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute block"
          style={{
            left: `${(p.x / STAGE.w) * 100}%`,
            top: `${(p.y / STAGE.h) * 100}%`,
            width: p.size,
            height: p.shape === "chip" ? p.size * 0.55 : p.size,
            marginLeft: -p.size / 2,
            marginTop: -p.size / 2,
            background: p.color,
            borderRadius: p.shape === "dot" ? "50%" : p.shape === "chip" ? 2 : 1,
            clipPath:
              p.shape === "spark"
                ? "polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)"
                : undefined,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
          animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0.4, rotate: p.rotate }}
          transition={{ duration: p.duration, ease: "easeOut" }}
          onAnimationComplete={() => remove(p.id)}
        />
      ))}
    </div>
  );

  return { burst, layer };
}
