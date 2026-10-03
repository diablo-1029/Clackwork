"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { audio } from "@/audio/audioManager";
import { getMaterialColors } from "@/game/products/materialProfiles";
import { stampMark } from "@/game/products/productLook";
import { ProductBody, ProductImprint } from "@/game/products/ProductRenderer";
import { STAGE, type MachineProps } from "../shared";
import { calculateStamperQuality, markerPosition, stamperTuning } from "./stamperScoring";

const TRACK = { x: 60, y: 262, w: 280, h: 14 } as const;
const SLAB = { x: 120, y: 150, w: 160, h: 78, r: 14 } as const;
const HEAD_REST_Y = 26;
/** How far the press head drops to meet the product. */
const HEAD_DROP = SLAB.y - (HEAD_REST_Y + 78) + 6;
/** Moment of impact within the press animation, in ms. */
const IMPACT_MS = 95;

export function StamperMachine({
  material,
  isGolden,
  richness,
  look,
  active,
  onComplete,
  burst,
}: MachineProps) {
  const [press, setPress] = useState<{ position: number; quality: number } | null>(null);
  const markerRef = useRef<SVGGElement>(null);
  const elapsed = useRef(0);
  const position = useRef(0);
  const startedAt = useRef(0);
  const timers = useRef<number[]>([]);
  const colors = getMaterialColors(material, isGolden);

  // Sweep the marker. Time only advances while the frame loop runs, so a hidden
  // tab simply pauses it; the clamp keeps it from jumping when the tab returns.
  useEffect(() => {
    if (!active || press) return;
    let frame = 0;
    let last = performance.now();
    if (startedAt.current === 0) startedAt.current = last;

    const tick = (now: number) => {
      elapsed.current += Math.min(50, now - last);
      last = now;
      position.current = markerPosition(elapsed.current);
      markerRef.current?.setAttribute("transform", `translate(${(TRACK.x + position.current * TRACK.w).toFixed(1)} 0)`);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, press]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const fire = () => {
    if (!active || press) return;
    const at = position.current;
    const quality = calculateStamperQuality(at);
    setPress({ position: at, quality });

    timers.current.push(
      window.setTimeout(() => {
        audio.play("stampThunk");
        burst(
          { x: SLAB.x + SLAB.w / 2, y: SLAB.y + 6 },
          { count: quality >= 95 ? 12 : 7, colors: colors.particles, spread: 70 },
        );
      }, IMPACT_MS),
    );

    onComplete({
      quality,
      durationMs: performance.now() - startedAt.current,
      metadata: { markerPosition: at },
    });
  };

  const perfectHalf = (stamperTuning.perfectZone * TRACK.w) / 2;
  const center = TRACK.x + TRACK.w / 2;
  // An off-center press leaves a visibly off-center, fainter imprint.
  const mark = press ? stampMark(press.position, press.quality) : null;

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${STAGE.w} ${STAGE.h}`} className="h-full w-full" aria-hidden>
        {/* Press frame */}
        <rect x="84" y="14" width="26" height="232" rx="10" fill="var(--fx-machine-dark)" />
        <rect x="290" y="14" width="26" height="232" rx="10" fill="var(--fx-machine-dark)" />
        <rect x="76" y="8" width="248" height="30" rx="12" fill="var(--fx-machine)" />
        <rect x="76" y="8" width="248" height="12" rx="6" fill="var(--fx-machine-light)" opacity="0.4" />
        <rect x="70" y="226" width="260" height="22" rx="10" fill="var(--fx-machine)" />

        {/* A light kick through the whole press on impact */}
        <motion.g
          initial={false}
          animate={press ? { y: [0, 0, 4, 0] } : { y: 0 }}
          transition={{ duration: 0.3, times: [0, 0.3, 0.45, 1] }}
        >
          <ProductBody material={material} isGolden={isGolden} richness={richness} look={look} {...SLAB} />

          {/* The imprint appears at the moment of impact, hidden behind the head until it lifts. */}
          {mark && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: IMPACT_MS / 1000, duration: 0.05 }}
            >
              <ProductImprint rect={SLAB} mark={mark} color={colors.dark} />
            </motion.g>
          )}
        </motion.g>

        {/* Press head: drops fast, rebounds a little slower */}
        <motion.g
          initial={false}
          animate={press ? { y: [0, HEAD_DROP, HEAD_DROP, 0] } : { y: 0 }}
          transition={{ duration: 0.5, times: [0, 0.19, 0.36, 1], ease: ["easeIn", "linear", "easeOut"] }}
        >
          <rect x="188" y={HEAD_REST_Y} width="24" height="44" fill="#c9d3de" />
          <rect x="188" y={HEAD_REST_Y} width="8" height="44" fill="#ffffff" opacity="0.5" />
          <rect x="132" y={HEAD_REST_Y + 40} width="136" height="38" rx="10" fill="var(--fx-machine)" />
          <rect x="132" y={HEAD_REST_Y + 40} width="136" height="14" rx="7" fill="var(--fx-machine-light)" opacity="0.45" />
          <rect x="146" y={HEAD_REST_Y + 72} width="108" height="8" rx="3" fill="var(--fx-machine-dark)" />
        </motion.g>

        {/* Timing track: the Perfect zone is marked by shape as well as colour */}
        <rect x={TRACK.x} y={TRACK.y} width={TRACK.w} height={TRACK.h} rx={TRACK.h / 2} fill="var(--fx-machine-dark)" opacity="0.85" />
        <rect x={center - TRACK.w * 0.16} y={TRACK.y} width={TRACK.w * 0.32} height={TRACK.h} fill="var(--fx-accent-2)" opacity="0.45" />
        <rect x={center - perfectHalf} y={TRACK.y - 5} width={perfectHalf * 2} height={TRACK.h + 10} rx="4" fill="var(--fx-accent)" stroke="#ffffff" strokeWidth="1.5" />
        <path d={`M ${center - 6} ${TRACK.y - 13} L ${center + 6} ${TRACK.y - 13} L ${center} ${TRACK.y - 6} Z`} fill="var(--fx-accent)" />

        <g ref={markerRef} transform={`translate(${TRACK.x} 0)`}>
          <rect x="-2.5" y={TRACK.y - 8} width="5" height={TRACK.h + 16} rx="2.5" fill="#ffffff" stroke="var(--fx-machine-dark)" strokeWidth="1.5" />
          <path d={`M -8 ${TRACK.y + TRACK.h + 18} L 8 ${TRACK.y + TRACK.h + 18} L 0 ${TRACK.y + TRACK.h + 8} Z`} fill="#ffffff" stroke="var(--fx-machine-dark)" strokeWidth="1.5" strokeLinejoin="round" />
        </g>
      </svg>

      {/* One big real button: works with touch, mouse and keyboard alike. */}
      <button
        type="button"
        className="sf-machine-surface absolute inset-0 h-full w-full cursor-pointer rounded-3xl"
        aria-label="Stamp the product"
        disabled={!active || press !== null}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.preventDefault();
          fire();
        }}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            fire();
          }
        }}
      />
    </div>
  );
}
