"use client";

import { motion } from "framer-motion";
import { useId, useRef, useState } from "react";
import { audio } from "@/audio/audioManager";
import { useLoopSound } from "@/audio/useMachineAudio";
import { getMaterialColors, materialProfiles } from "@/game/products/materialProfiles";
import { ProductBody } from "@/game/products/ProductRenderer";
import { distance, lerp, measureTrace } from "@/lib/math";
import { useTraceDrag, type DragSession } from "@/lib/pointer/useTraceDrag";
import { PRODUCT_RECT, STAGE, type MachineProps } from "../shared";
import { pickCutPattern, splitAlong } from "./cutterGeometry";
import { calculateCutterQuality, isCutAttempt } from "./cutterScoring";

/** Progress along the guide at which the cut completes by itself. */
const AUTO_FINISH = 0.985;
/** How far each half slides away from the cut, in stage units. */
const SEPARATION = 9;

export function CutterMachine({
  runId,
  material,
  isGolden,
  richness,
  active,
  showHint,
  onInteractionStart,
  onInteractionCancel,
  onComplete,
  burst,
}: MachineProps) {
  const id = useId().replace(/:/g, "");
  // Fixed for the life of this machine, even if onboarding flags change mid-cut.
  const [pattern] = useState(() => pickCutPattern(runId, showHint));
  const [hinting] = useState(showHint);
  const [stage, setStage] = useState<"idle" | "cutting" | "cut">("idle");

  const surfaceRef = useRef<SVGSVGElement>(null);
  const trailRef = useRef<SVGPolylineElement>(null);
  const bladeRef = useRef<SVGGElement>(null);
  const lastChip = useRef(0);
  const lastPointCount = useRef(0);
  const loop = useLoopSound("cutLoop");

  const profile = materialProfiles[material];
  const colors = getMaterialColors(material, isGolden);
  const { from, to } = pattern;
  const halves = splitAlong(from, to);

  const moveBlade = (x: number, y: number) => {
    bladeRef.current?.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  };

  const clearTrail = () => {
    trailRef.current?.setAttribute("points", "");
    moveBlade(from.x, from.y);
    lastPointCount.current = 0;
  };

  const finish = (session: DragSession) => {
    loop.stop();
    const input = { points: session.points, from, to };

    // A tap or tiny slip is not an attempt: quietly offer the cut again.
    if (!isCutAttempt(input)) {
      clearTrail();
      setStage("idle");
      onInteractionCancel();
      return;
    }

    const quality = calculateCutterQuality(input);
    setStage("cut");
    audio.play(profile.cutSoundKey);

    [0.2, 0.5, 0.8].forEach((t) =>
      burst(
        { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) },
        { count: 6, colors: colors.particles, shape: profile.cutParticleStyle, spread: 46 },
      ),
    );

    onComplete({
      quality,
      durationMs: performance.now() - session.startedAt,
      metadata: { pattern: pattern.id },
    });
  };

  useTraceDrag(surfaceRef, {
    enabled: active && stage !== "cut",
    onStart: (session) => {
      setStage("cutting");
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
      clearTrail();
      setStage("idle");
      onInteractionCancel();
    },
  });

  const cut = stage === "cut";
  const guideAngle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

  return (
    <svg
      ref={surfaceRef}
      viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}
      className="sf-machine-surface h-full w-full"
      role="img"
      aria-label="Cutter. Drag along the guide line to cut the product."
    >
      <defs>
        <clipPath id={`${id}-a`}>
          <polygon points={halves.sideA} />
        </clipPath>
        <clipPath id={`${id}-b`}>
          <polygon points={halves.sideB} />
        </clipPath>
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

      {/* The product, drawn as two halves that part along the cut. */}
      {([1, -1] as const).map((sign) => (
        <motion.g
          key={sign}
          clipPath={`url(#${id}-${sign === 1 ? "a" : "b"})`}
          initial={false}
          animate={
            cut
              ? { x: halves.normal.x * SEPARATION * sign, y: halves.normal.y * SEPARATION * sign }
              : { x: 0, y: 0 }
          }
          transition={{ type: "spring", stiffness: 520, damping: 22 }}
        >
          <ProductBody material={material} isGolden={isGolden} richness={richness} {...PRODUCT_RECT} />
        </motion.g>
      ))}

      {/* Guide */}
      {!cut && (
        <g className={stage === "cutting" ? "sf-guide sf-guide-active" : "sf-guide"}>
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
      {hinting && stage === "idle" && active && (
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
        opacity={cut ? 0 : 0.85}
      />

      {/* Flash along the finished cut. */}
      {cut && (
        <motion.line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke="#ffffff"
          strokeLinecap="round"
          initial={{ opacity: 0.95, strokeWidth: 10 }}
          animate={{ opacity: 0, strokeWidth: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      )}

      {/* Blade */}
      <g ref={bladeRef} transform={`translate(${from.x} ${from.y})`} opacity={cut ? 0 : 1} style={{ pointerEvents: "none" }}>
        <g className={stage === "cutting" ? "sf-spin-fast" : "sf-pulse"}>
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
