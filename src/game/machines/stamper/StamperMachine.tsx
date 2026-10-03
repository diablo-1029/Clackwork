"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { audio } from "@/audio/audioManager";
import { getMaterialColors, materialProfiles } from "@/game/products/materialProfiles";
import { stampMark, stampOffset } from "@/game/products/productLook";
import { ProductBody, ProductImprint } from "@/game/products/ProductRenderer";
import { STAGE, type MachineProps } from "../shared";
import { calculateStamperQuality, markerPosition, nearestTarget, stampPlan, stamperTuning } from "./stamperScoring";

const TRACK = { x: 60, y: 262, w: 280, h: 14 } as const;
const SLAB = { x: 120, y: 150, w: 160, h: 78, r: 14 } as const;
const HEAD_REST_Y = 26;
/** How far the press head drops to meet the product. */
const HEAD_DROP = SLAB.y - (HEAD_REST_Y + 78) + 6;
/** Moment of impact within the press animation, in ms. */
const IMPACT_MS = 95;
/** The head needs this long to lift before it can press again. */
const REARM_MS = 520;

interface Press {
  position: number;
  target: number;
  quality: number;
}

export function StamperMachine({
  runId,
  material,
  isGolden,
  richness,
  look,
  variant,
  active,
  onInteractionStart,
  onComplete,
  burst,
}: MachineProps) {
  const [plan] = useState(() => stampPlan(variant, runId));
  const [presses, setPresses] = useState<Press[]>([]);
  const markerRef = useRef<SVGGElement>(null);
  const elapsed = useRef(0);
  const position = useRef(0);
  const startedAt = useRef(0);
  const rearmAt = useRef(0);
  const pressed = useRef<Press[]>([]);
  const timers = useRef<number[]>([]);
  const colors = getMaterialColors(material, isGolden);

  const finished = presses.length >= plan.targets.length;
  const imprintScale = plan.targets.length > 1 ? 0.6 : 1;
  // A narrower head when it has two smaller marks to make side by side.
  const headWidth = plan.targets.length > 1 ? 96 : 136;

  // Sweep the marker. Time only advances while the frame loop runs, so a hidden
  // tab simply pauses it; the clamp keeps it from jumping when the tab returns.
  useEffect(() => {
    if (!active || finished) return;
    let frame = 0;
    let last = performance.now();
    if (startedAt.current === 0) startedAt.current = last;

    const tick = (now: number) => {
      elapsed.current += Math.min(50, now - last);
      last = now;
      position.current = markerPosition(elapsed.current, plan.periodMs);
      markerRef.current?.setAttribute("transform", `translate(${(TRACK.x + position.current * TRACK.w).toFixed(1)} 0)`);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, finished, plan.periodMs]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const fire = () => {
    const now = performance.now();
    if (!active || pressed.current.length >= plan.targets.length || now < rearmAt.current) return;
    rearmAt.current = now + REARM_MS;

    const at = position.current;
    const remaining = plan.targets.filter((target) => !pressed.current.some((press) => press.target === target));
    const target = nearestTarget(at, remaining);
    const press: Press = { position: at, target, quality: calculateStamperQuality(at, target) };
    pressed.current = [...pressed.current, press];
    setPresses(pressed.current);
    if (pressed.current.length === 1) onInteractionStart();

    timers.current.push(
      window.setTimeout(() => {
        audio.play(materialProfiles[material].stampSoundKey);
        burst(
          { x: SLAB.x + SLAB.w / 2 + stampOffset(target) * SLAB.w, y: SLAB.y + 6 },
          { count: press.quality >= 95 ? 12 : 7, colors: colors.particles, spread: 70 },
        );
      }, IMPACT_MS),
    );

    if (pressed.current.length < plan.targets.length) return;

    onComplete({
      quality: pressed.current.reduce((sum, p) => sum + p.quality, 0) / pressed.current.length,
      durationMs: now - startedAt.current,
      metadata: { variant, presses: pressed.current.map((p) => ({ position: p.position, target: p.target })) },
    });
  };

  const perfectHalf = (stamperTuning.perfectZone * TRACK.w) / 2;
  const lastPress = presses[presses.length - 1];
  // The head sits over the mark it will make (or, with two marks, over the last one made).
  const headTarget = lastPress?.target ?? (plan.targets.length === 1 ? plan.targets[0] : 0.5);
  const headX = stampOffset(headTarget) * SLAB.w;

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${STAGE.w} ${STAGE.h}`} className="h-full w-full" aria-hidden>
        {/* Press frame */}
        <rect x="84" y="14" width="26" height="232" rx="10" fill="var(--fx-machine-dark)" />
        <rect x="290" y="14" width="26" height="232" rx="10" fill="var(--fx-machine-dark)" />
        <rect x="76" y="8" width="248" height="30" rx="12" fill="var(--fx-machine)" />
        <rect x="76" y="8" width="248" height="12" rx="6" fill="var(--fx-machine-light)" opacity="0.4" />
        <rect x="70" y="226" width="260" height="22" rx="10" fill="var(--fx-machine)" />

        {/* A light kick through the whole press on each impact */}
        <motion.g
          key={`kick-${presses.length}`}
          initial={{ y: 0 }}
          animate={presses.length > 0 ? { y: [0, 0, 4, 0] } : { y: 0 }}
          transition={{ duration: 0.3, times: [0, 0.3, 0.45, 1] }}
        >
          <ProductBody material={material} isGolden={isGolden} richness={richness} look={look} {...SLAB} />

          {/* Each imprint appears at the moment of impact, hidden behind the head until it lifts. */}
          {presses.map((press) => (
            <motion.g
              key={press.target}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: IMPACT_MS / 1000, duration: 0.05 }}
            >
              <ProductImprint rect={SLAB} mark={stampMark(press.position, press.quality, press.target, imprintScale)} color={colors.dark} />
            </motion.g>
          ))}
        </motion.g>

        {/* Press head: slides over its mark, drops fast, rebounds a little slower */}
        <g transform={`translate(${headX} 0)`} style={{ transition: "transform 90ms ease-out" }}>
          <motion.g
            key={`head-${presses.length}`}
            initial={{ y: 0 }}
            animate={presses.length > 0 ? { y: [0, HEAD_DROP, HEAD_DROP, 0] } : { y: 0 }}
            transition={{ duration: 0.5, times: [0, 0.19, 0.36, 1], ease: ["easeIn", "linear", "easeOut"] }}
          >
            <rect x="188" y={HEAD_REST_Y} width="24" height="44" fill="#c9d3de" />
            <rect x="188" y={HEAD_REST_Y} width="8" height="44" fill="#ffffff" opacity="0.5" />
            <rect x={200 - headWidth / 2} y={HEAD_REST_Y + 40} width={headWidth} height="38" rx="10" fill="var(--fx-machine)" />
            <rect x={200 - headWidth / 2} y={HEAD_REST_Y + 40} width={headWidth} height="14" rx="7" fill="var(--fx-machine-light)" opacity="0.45" />
            <rect x={200 - headWidth / 2 + 14} y={HEAD_REST_Y + 72} width={headWidth - 28} height="8" rx="3" fill="var(--fx-machine-dark)" />
          </motion.g>
        </g>

        {/* Timing track: each Perfect zone is marked by shape as well as colour */}
        <rect x={TRACK.x} y={TRACK.y} width={TRACK.w} height={TRACK.h} rx={TRACK.h / 2} fill="var(--fx-machine-dark)" opacity="0.85" />
        {plan.targets.map((target) => {
          const x = TRACK.x + target * TRACK.w;
          const done = presses.some((press) => press.target === target);
          return (
            <g key={target} opacity={done ? 0.35 : 1}>
              <rect x={x - TRACK.w * 0.11} y={TRACK.y} width={TRACK.w * 0.22} height={TRACK.h} fill="var(--fx-accent-2)" opacity="0.45" />
              <rect x={x - perfectHalf} y={TRACK.y - 5} width={perfectHalf * 2} height={TRACK.h + 10} rx="4" fill="var(--fx-accent)" stroke="#ffffff" strokeWidth="1.5" />
              <path d={`M ${x - 6} ${TRACK.y - 13} L ${x + 6} ${TRACK.y - 13} L ${x} ${TRACK.y - 6} Z`} fill="var(--fx-accent)" />
            </g>
          );
        })}

        <g ref={markerRef} transform={`translate(${TRACK.x} 0)`}>
          <rect x="-2.5" y={TRACK.y - 8} width="5" height={TRACK.h + 16} rx="2.5" fill="#ffffff" stroke="var(--fx-machine-dark)" strokeWidth="1.5" />
          <path d={`M -8 ${TRACK.y + TRACK.h + 18} L 8 ${TRACK.y + TRACK.h + 18} L 0 ${TRACK.y + TRACK.h + 8} Z`} fill="#ffffff" stroke="var(--fx-machine-dark)" strokeWidth="1.5" strokeLinejoin="round" />
        </g>
      </svg>

      {/* One big real button: works with touch, mouse and keyboard alike. */}
      <button
        type="button"
        className="sf-machine-surface absolute inset-0 h-full w-full cursor-pointer rounded-3xl"
        aria-label={plan.targets.length > 1 ? `Stamp the product. Mark ${Math.min(presses.length + 1, plan.targets.length)} of ${plan.targets.length}.` : "Stamp the product"}
        disabled={!active || finished}
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
