"use client";

import { motion } from "framer-motion";
import { useId, useRef, useState, type ReactNode } from "react";
import { audio } from "@/audio/audioManager";
import { useLoopSound } from "@/audio/useMachineAudio";
import { getMaterialColors, materialProfiles } from "@/game/products/materialProfiles";
import { ProductBody } from "@/game/products/ProductRenderer";
import { distance, lerp, measureTrace } from "@/lib/math";
import { useTraceDrag, type DragSession } from "@/lib/pointer/useTraceDrag";
import { PRODUCT_RECT, STAGE, type MachineProps } from "../shared";
import { pickCutPattern, pieceShift, splitAlong } from "./cutterGeometry";
import { calculateCutterQuality, isCutAttempt } from "./cutterScoring";

/** Progress along the guide at which the cut completes by itself. */
const AUTO_FINISH = 0.985;
/** How far neighbouring pieces slide apart per cut, in stage units. */
const SEPARATION = 9;

export function CutterMachine({
  runId,
  material,
  isGolden,
  richness,
  look,
  factoryLevel,
  active,
  showHint,
  onInteractionStart,
  onInteractionCancel,
  onComplete,
  burst,
}: MachineProps) {
  const id = useId().replace(/:/g, "");
  // Fixed for the life of this machine, even if onboarding flags or the level change mid-cut.
  const [pattern] = useState(() => pickCutPattern(runId, showHint, factoryLevel));
  const [hinting] = useState(showHint);
  const [cutsDone, setCutsDone] = useState(0);
  const [cutting, setCutting] = useState(false);

  const surfaceRef = useRef<SVGSVGElement>(null);
  const trailRef = useRef<SVGPolylineElement>(null);
  const bladeRef = useRef<SVGGElement>(null);
  const lastChip = useRef(0);
  const lastPointCount = useRef(0);
  const qualities = useRef<number[]>([]);
  const firstTouch = useRef(0);
  const loop = useLoopSound("cutLoop");

  const profile = materialProfiles[material];
  const colors = getMaterialColors(material, isGolden);
  const total = pattern.segments.length;
  const allCut = cutsDone >= total;
  // The guide currently offered; once everything is cut it stays on the last one.
  const segment = pattern.segments[Math.min(cutsDone, total - 1)];
  const { from, to } = segment;
  const splits = pattern.segments.map((s) => splitAlong(s.from, s.to));
  const normal = splits[0].normal;

  const moveBlade = (x: number, y: number) => {
    bladeRef.current?.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  };

  const clearTrail = () => {
    trailRef.current?.setAttribute("points", "");
    lastPointCount.current = 0;
  };

  const finish = (session: DragSession) => {
    loop.stop();
    setCutting(false);
    clearTrail();
    const input = { points: session.points, from, to };

    // A tap or tiny slip is not an attempt: quietly offer the same cut again.
    // Cuts already made are kept.
    if (!isCutAttempt(input)) {
      moveBlade(from.x, from.y);
      if (qualities.current.length === 0) onInteractionCancel();
      return;
    }

    qualities.current.push(calculateCutterQuality(input));
    audio.play(profile.cutSoundKey);
    [0.2, 0.5, 0.8].forEach((t) =>
      burst(
        { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) },
        { count: 6, colors: colors.particles, shape: profile.cutParticleStyle, spread: 46 },
      ),
    );

    const done = qualities.current.length;
    setCutsDone(done);
    if (done < total) {
      const next = pattern.segments[done];
      moveBlade(next.from.x, next.from.y);
      return;
    }

    onComplete({
      quality: qualities.current.reduce((sum, q) => sum + q, 0) / total,
      durationMs: performance.now() - firstTouch.current,
      metadata: { pattern: pattern.id, cuts: [...qualities.current] },
    });
  };

  useTraceDrag(surfaceRef, {
    enabled: active && !allCut,
    onStart: (session) => {
      if (firstTouch.current === 0) firstTouch.current = session.startedAt;
      setCutting(true);
      loop.start();
      onInteractionStart();
      if (session.start) moveBlade(session.start.x, session.start.y);
    },
    onFrame: (session) => {
      const { points, current } = session;
      if (!current) return;

      trailRef.current?.setAttribute("points", points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "));
      moveBlade(current.x, current.y);

      // Louder and brighter the faster the blade travels; resistance thickens the sound.
      const travelled = points.length - lastPointCount.current;
      lastPointCount.current = points.length;
      loop.setIntensity(Math.min(1, 0.25 + travelled * 0.2 + profile.cutResistance * 0.2));

      const now = performance.now();
      const overProduct =
        current.x > PRODUCT_RECT.x &&
        current.x < PRODUCT_RECT.x + PRODUCT_RECT.w &&
        current.y > PRODUCT_RECT.y &&
        current.y < PRODUCT_RECT.y + PRODUCT_RECT.h;
      if (overProduct && now - lastChip.current > 95) {
        lastChip.current = now;
        burst(current, { count: 2, colors: colors.particles, shape: profile.cutParticleStyle, spread: 26 });
      }

      const trace = measureTrace(points, from, to);
      return trace.endProgress >= AUTO_FINISH && distance(current, to) < 40;
    },
    onEnd: finish,
    onCancel: () => {
      loop.stop();
      setCutting(false);
      clearTrail();
      moveBlade(from.x, from.y);
      if (qualities.current.length === 0) onInteractionCancel();
    },
  });

  const guideAngle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  const lastCut = cutsDone > 0 ? pattern.segments[cutsDone - 1] : null;

  /** Piece `index` is everything between cut `index - 1` and cut `index`. */
  const piece = (index: number) => {
    let body: ReactNode = (
      <ProductBody material={material} isGolden={isGolden} richness={richness} look={look} {...PRODUCT_RECT} />
    );
    if (index > 0) body = <g clipPath={`url(#${id}-b${index - 1})`}>{body}</g>;
    if (index < total) body = <g clipPath={`url(#${id}-a${index})`}>{body}</g>;

    const shift = pieceShift(index, cutsDone) * SEPARATION;
    return (
      <motion.g
        key={index}
        initial={false}
        animate={{ x: normal.x * shift, y: normal.y * shift }}
        transition={{ type: "spring", stiffness: 520, damping: 22 }}
      >
        {body}
      </motion.g>
    );
  };

  return (
    <svg
      ref={surfaceRef}
      viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}
      className="sf-machine-surface h-full w-full"
      role="img"
      aria-label={`Cutter. Drag along the guide line to cut the product.${total > 1 ? ` Cut ${Math.min(cutsDone + 1, total)} of ${total}.` : ""}`}
    >
      <defs>
        {splits.map((split, index) => (
          <g key={index}>
            <clipPath id={`${id}-a${index}`}>
              <polygon points={split.sideA} />
            </clipPath>
            <clipPath id={`${id}-b${index}`}>
              <polygon points={split.sideB} />
            </clipPath>
          </g>
        ))}
      </defs>

      {/* Cutting bed */}
      <rect x="62" y="52" width="276" height="196" rx="22" fill="var(--fx-machine-dark)" opacity="0.92" />
      <rect x="70" y="60" width="260" height="180" rx="16" fill="var(--fx-machine)" />
      <rect x="70" y="60" width="260" height="60" rx="16" fill="var(--fx-machine-light)" opacity="0.28" />
      {[
        [82, 72],
        [318, 72],
        [82, 228],
        [318, 228],
      ].map(([bx, by]) => (
        <circle key={`${bx}-${by}`} cx={bx} cy={by} r="3.5" fill="var(--fx-machine-dark)" opacity="0.7" />
      ))}

      {/* The product, drawn as pieces that part along each finished cut. */}
      {Array.from({ length: total + 1 }, (_, index) => piece(index))}

      {/* Guide for the cut on offer */}
      {!allCut && (
        <g className={cutting ? "sf-guide sf-guide-active" : "sf-guide"}>
          <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="var(--fx-accent-2)" strokeWidth="9" strokeLinecap="round" opacity="0.28" />
          <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="7 7" />
          <circle cx={from.x} cy={from.y} r="7" fill="#ffffff" stroke="var(--fx-accent)" strokeWidth="3" />
          <path
            d="M -7 -7 L 5 0 L -7 7 Z"
            transform={`translate(${to.x} ${to.y}) rotate(${guideAngle})`}
            fill="var(--fx-accent)"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      )}

      {/* First-time hint: a dot that demonstrates the drag. */}
      {hinting && !cutting && cutsDone === 0 && active && (
        <motion.circle
          r="11"
          fill="#ffffff"
          fillOpacity="0.55"
          stroke="var(--fx-accent)"
          strokeWidth="3"
          initial={{ cx: from.x, cy: from.y, opacity: 0 }}
          animate={{ cx: [from.x, to.x], cy: [from.y, to.y], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.35, ease: "easeInOut" }}
        />
      )}

      {/* Live cutting trail, updated outside React while dragging. */}
      <polyline
        ref={trailRef}
        fill="none"
        stroke={colors.dark}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />

      {/* Flash along the cut that was just made. */}
      {lastCut && (
        <motion.line
          key={cutsDone}
          x1={lastCut.from.x}
          y1={lastCut.from.y}
          x2={lastCut.to.x}
          y2={lastCut.to.y}
          stroke="#ffffff"
          strokeLinecap="round"
          initial={{ opacity: 0.95, strokeWidth: 10 }}
          animate={{ opacity: 0, strokeWidth: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      )}

      {/* Blade */}
      <g ref={bladeRef} transform={`translate(${from.x} ${from.y})`} opacity={allCut ? 0 : 1} style={{ pointerEvents: "none" }}>
        <g className={cutting ? "sf-spin-fast" : "sf-pulse"}>
          <circle r="13" fill="#e8eef5" stroke="var(--fx-machine-dark)" strokeWidth="2" />
          {[0, 45, 90, 135].map((a) => (
            <rect key={a} x="-1.5" y="-13" width="3" height="26" rx="1.5" fill="var(--fx-machine-dark)" opacity="0.35" transform={`rotate(${a})`} />
          ))}
          <circle r="4.5" fill="var(--fx-accent)" />
        </g>
      </g>
    </svg>
  );
}
