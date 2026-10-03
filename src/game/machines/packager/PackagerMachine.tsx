"use client";

import { motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { audio } from "@/audio/audioManager";
import { useLoopSound } from "@/audio/useMachineAudio";
import { ProductBody } from "@/game/products/ProductRenderer";
import { distance, measureTrace, type Point } from "@/lib/math";
import { useTraceDrag, type DragSession } from "@/lib/pointer/useTraceDrag";
import { STAGE, type MachineProps } from "../shared";
import { calculatePackagerQuality, isTapeAttempt } from "./packagerScoring";

const BOX = { x: 96, y: 66, w: 208, h: 168, r: 12 } as const;
const SEAM_Y = BOX.y + BOX.h / 2;
/** The tape is pulled from the dispenser on the left across the seam to the far edge. */
const TAPE_FROM: Point = { x: 68, y: SEAM_Y };
const TAPE_TO: Point = { x: 332, y: SEAM_Y };
/** How close to the tape tab a press must land, in stage units. Generous for touch. */
const GRAB_RADIUS = 48;
const AUTO_FINISH = 0.985;
const TAPE_WIDTH = 30;

export function PackagerMachine({
  material,
  isGolden,
  richness,
  look,
  active,
  showHint,
  onInteractionStart,
  onInteractionCancel,
  onComplete,
  burst,
}: MachineProps) {
  const id = useId().replace(/:/g, "");
  const [hinting] = useState(showHint);
  const [stage, setStage] = useState<"idle" | "taping" | "sealed">("idle");
  const surfaceRef = useRef<SVGSVGElement>(null);
  const tapeRef = useRef<SVGPolylineElement>(null);
  const tabRef = useRef<SVGGElement>(null);
  const timers = useRef<number[]>([]);
  const loop = useLoopSound("tapeLoop");

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const drawTape = (points: Point[]) => {
    const path = [TAPE_FROM, ...points].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    tapeRef.current?.setAttribute("points", path);
    const tip = points[points.length - 1] ?? TAPE_FROM;
    tabRef.current?.setAttribute("transform", `translate(${tip.x.toFixed(1)} ${tip.y.toFixed(1)})`);
  };

  const retract = () => {
    loop.stop();
    drawTape([]);
    setStage("idle");
    onInteractionCancel();
  };

  const finish = (session: DragSession) => {
    loop.stop();
    const input = { points: session.points, from: TAPE_FROM, to: TAPE_TO };

    // Letting go right away just lets the tape spring back.
    if (!isTapeAttempt(input)) {
      retract();
      return;
    }

    const quality = calculatePackagerQuality(input);
    const tip = session.points[session.points.length - 1];
    setStage("sealed");

    audio.play("tapeSnap");
    timers.current.push(window.setTimeout(() => audio.play("boxClose"), 90));
    burst(tip, { count: 8, spread: 40, colors: ["#ffffff", "var(--fx-accent)", "var(--fx-accent-2)"] });
    burst({ x: BOX.x + BOX.w / 2, y: SEAM_Y }, { count: quality >= 95 ? 14 : 8, spread: 90, shape: "spark" });

    onComplete({ quality, durationMs: performance.now() - session.startedAt });
  };

  useTraceDrag(surfaceRef, {
    enabled: active && stage !== "sealed",
    canStart: (point) => distance(point, TAPE_FROM) <= GRAB_RADIUS,
    onStart: () => {
      setStage("taping");
      loop.start();
      onInteractionStart();
    },
    onFrame: (session) => {
      const { points, current } = session;
      if (!current) return;
      drawTape(points);

      // The pull rises in pitch as the tape stretches further.
      const trace = measureTrace(points, TAPE_FROM, TAPE_TO);
      loop.setIntensity(0.3 + trace.endProgress * 0.7);
      return trace.endProgress >= AUTO_FINISH;
    },
    onEnd: finish,
    onCancel: retract,
  });

  const sealed = stage === "sealed";

  return (
    <svg
      ref={surfaceRef}
      viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}
      className="sf-machine-surface h-full w-full"
      role="img"
      aria-label="Packager. Drag the tape from the dispenser across the box to seal it."
    >
      <defs>
        <linearGradient id={`${id}-card`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e3b885" />
          <stop offset="1" stopColor="#c99760" />
        </linearGradient>
        <clipPath id={`${id}-box`}>
          <rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx={BOX.r} />
        </clipPath>
      </defs>

      {/* Packing table */}
      <rect x="40" y="44" width="320" height="212" rx="24" fill="var(--fx-machine-dark)" opacity="0.92" />
      <rect x="48" y="52" width="304" height="196" rx="18" fill="var(--fx-machine)" />
      <rect x="48" y="52" width="304" height="64" rx="18" fill="var(--fx-machine-light)" opacity="0.25" />

      <motion.g
        initial={false}
        animate={sealed ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={{ duration: 0.34, ease: "easeOut" }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        {/* Box interior with the product nestled inside */}
        <rect x={BOX.x} y={BOX.y + 7} width={BOX.w} height={BOX.h} rx={BOX.r} fill="#8a623a" />
        <rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx={BOX.r} fill="#a87a4a" />
        <ProductBody material={material} isGolden={isGolden} richness={richness} look={look} x={BOX.x + 34} y={BOX.y + 40} w={BOX.w - 68} h={BOX.h - 80} r={12} />

        {/* Flaps fold shut over the product as the box arrives */}
        <g clipPath={`url(#${id}-box)`}>
          <motion.rect
            x={BOX.x}
            y={BOX.y}
            width={BOX.w}
            height={BOX.h / 2}
            fill={`url(#${id}-card)`}
            initial={{ scaleY: 0.12 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.34, delay: 0.12, ease: "easeOut" }}
            style={{ transformBox: "fill-box", transformOrigin: "top" }}
          />
          <motion.rect
            x={BOX.x}
            y={SEAM_Y}
            width={BOX.w}
            height={BOX.h / 2}
            fill={`url(#${id}-card)`}
            initial={{ scaleY: 0.12 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.34, delay: 0.12, ease: "easeOut" }}
            style={{ transformBox: "fill-box", transformOrigin: "bottom" }}
          />
        </g>
        <rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx={BOX.r} fill="none" stroke="#8a623a" strokeWidth="2" />
        <line x1={BOX.x} y1={SEAM_Y} x2={BOX.x + BOX.w} y2={SEAM_Y} stroke="#8a623a" strokeWidth="2" />

        {/* Seam guide */}
        {!sealed && (
          <g className={stage === "taping" ? "sf-guide sf-guide-active" : "sf-guide"}>
            <line x1={TAPE_FROM.x} y1={SEAM_Y} x2={TAPE_TO.x} y2={SEAM_Y} stroke="var(--fx-accent-2)" strokeWidth={TAPE_WIDTH} opacity="0.2" />
            <line x1={TAPE_FROM.x} y1={SEAM_Y} x2={TAPE_TO.x} y2={SEAM_Y} stroke="#ffffff" strokeWidth="2.5" strokeDasharray="7 7" strokeLinecap="round" />
            <rect x={TAPE_TO.x - 5} y={SEAM_Y - 19} width="10" height="38" rx="5" fill="var(--fx-accent)" stroke="#ffffff" strokeWidth="1.5" />
          </g>
        )}

        {/* The tape itself, updated outside React while dragging */}
        <polyline
          ref={tapeRef}
          fill="none"
          stroke="var(--fx-accent)"
          strokeOpacity="0.88"
          strokeWidth={TAPE_WIDTH}
          strokeLinejoin="round"
          strokeLinecap="butt"
        />

        {/* Sealed sticker */}
        {sealed && (
          <motion.g
            initial={{ scale: 0, rotate: -30, opacity: 0 }}
            animate={{ scale: 1, rotate: -8, opacity: 1 }}
            transition={{ type: "spring", stiffness: 480, damping: 16, delay: 0.08 }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <circle cx={BOX.x + BOX.w - 40} cy={BOX.y + 40} r="20" fill="var(--sf-success)" stroke="#ffffff" strokeWidth="3" />
            <path
              d={`M ${BOX.x + BOX.w - 49} ${BOX.y + 40} l 6 7 l 12 -13`}
              fill="none"
              stroke="#ffffff"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.g>
        )}

        {/* Shine sweep across the finished box */}
        {sealed && (
          <g clipPath={`url(#${id}-box)`}>
            <motion.rect
              y={BOX.y - 20}
              width="46"
              height={BOX.h + 40}
              fill="#ffffff"
              opacity="0.5"
              transform="skewX(-18)"
              initial={{ x: BOX.x - 40 }}
              animate={{ x: BOX.x + BOX.w + 90 }}
              transition={{ duration: 0.45, delay: 0.1, ease: "easeInOut" }}
            />
          </g>
        )}
      </motion.g>

      {/* Dispenser */}
      <g style={{ pointerEvents: "none" }}>
        <rect x="22" y={SEAM_Y - 30} width="40" height="60" rx="12" fill="var(--fx-machine-dark)" />
        <circle cx="42" cy={SEAM_Y} r="19" fill="var(--fx-accent)" className={stage === "taping" ? "sf-spin-fast" : undefined} />
        <circle cx="42" cy={SEAM_Y} r="8" fill="var(--fx-machine-dark)" />
      </g>

      {/* Tape tab: the thing to grab */}
      {!sealed && (
        <g ref={tabRef} transform={`translate(${TAPE_FROM.x} ${TAPE_FROM.y})`} style={{ pointerEvents: "none" }}>
          <g className={stage === "idle" && active ? "sf-pulse" : undefined}>
            <rect x="-9" y={-TAPE_WIDTH / 2 - 3} width="18" height={TAPE_WIDTH + 6} rx="6" fill="#ffffff" stroke="var(--fx-accent)" strokeWidth="3" />
            <path d="M -2 -5 L 3 0 L -2 5" fill="none" stroke="var(--fx-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      )}

      {/* First-time hint */}
      {hinting && stage === "idle" && active && (
        <motion.circle
          r="11"
          cy={SEAM_Y}
          fill="#ffffff"
          fillOpacity="0.55"
          stroke="var(--fx-accent)"
          strokeWidth="3"
          style={{ pointerEvents: "none" }}
          initial={{ cx: TAPE_FROM.x, opacity: 0 }}
          animate={{ cx: [TAPE_FROM.x, TAPE_TO.x], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.35, ease: "easeInOut" }}
        />
      )}
    </svg>
  );
}
