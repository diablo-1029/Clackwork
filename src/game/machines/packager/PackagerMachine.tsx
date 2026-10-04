"use client";

import { motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { audio } from "@/audio/audioManager";
import { useLoopSound } from "@/audio/useMachineAudio";
import { ProductBody } from "@/game/products/ProductRenderer";
import { distance, measureTrace, type Point } from "@/lib/math";
import { useTraceDrag, type DragSession } from "@/lib/pointer/useTraceDrag";
import { STAGE, type MachineProps } from "../shared";
import { StepPips } from "../StepPips";
import { calculatePackagerQuality, isTapeAttempt, tapeRuns } from "./packagerScoring";

const BOX = { x: 96, y: 66, w: 208, h: 168, r: 12 } as const;
const SEAM_Y = BOX.y + BOX.h / 2;
/** How close to the tape tab a press must land, in stage units. Generous for touch. */
const GRAB_RADIUS = 48;
const AUTO_FINISH = 0.985;
const TAPE_WIDTH = 30;

const pointsAttr = (points: Point[]) => points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

export function PackagerMachine({
  material,
  isGolden,
  richness,
  look,
  variant,
  active,
  showHint,
  onInteractionStart,
  onInteractionCancel,
  onComplete,
  burst,
}: MachineProps) {
  const id = useId().replace(/:/g, "");
  const [hinting] = useState(showHint);
  // One strip of tape per run, laid in order. "cross" has two.
  const [runs] = useState(() => tapeRuns(variant));
  /** Finished strips, as drawn. */
  const [laid, setLaid] = useState<string[]>([]);
  const [taping, setTaping] = useState(false);

  const surfaceRef = useRef<SVGSVGElement>(null);
  const tapeRef = useRef<SVGPolylineElement>(null);
  const tabRef = useRef<SVGGElement>(null);
  const qualities = useRef<number[]>([]);
  const firstTouch = useRef(0);
  const timers = useRef<number[]>([]);
  const loop = useLoopSound("tapeLoop");

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const sealed = laid.length >= runs.length;
  const run = runs[Math.min(laid.length, runs.length - 1)];
  const { from, to } = run;
  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

  const drawTape = (points: Point[]) => {
    tapeRef.current?.setAttribute("points", pointsAttr([from, ...points]));
    const tip = points[points.length - 1] ?? from;
    tabRef.current?.setAttribute("transform", `translate(${tip.x.toFixed(1)} ${tip.y.toFixed(1)}) rotate(${angle})`);
  };

  const retract = () => {
    loop.stop();
    drawTape([]);
    setTaping(false);
    if (qualities.current.length === 0) onInteractionCancel();
  };

  const finish = (session: DragSession) => {
    loop.stop();
    const input = { points: session.points, from, to };

    // Letting go right away just lets the tape spring back. Strips already laid stay.
    if (!isTapeAttempt(input)) {
      retract();
      return;
    }

    qualities.current.push(calculatePackagerQuality(input));
    const tip = session.points[session.points.length - 1];
    setTaping(false);
    setLaid((current) => [...current, pointsAttr([from, ...session.points])]);
    tapeRef.current?.setAttribute("points", "");

    audio.play("tapeSnap");
    burst(tip, { count: 8, spread: 40, colors: ["#ffffff", "var(--fx-accent)", "var(--fx-accent-2)"] });

    if (qualities.current.length < runs.length) return;

    const quality = qualities.current.reduce((sum, q) => sum + q, 0) / runs.length;
    timers.current.push(window.setTimeout(() => audio.play("boxClose"), 90));
    burst({ x: BOX.x + BOX.w / 2, y: SEAM_Y }, { count: quality >= 95 ? 14 : 8, spread: 90, shape: "spark" });
    onComplete({
      quality,
      durationMs: performance.now() - firstTouch.current,
      metadata: { variant, strips: [...qualities.current] },
    });
  };

  useTraceDrag(surfaceRef, {
    enabled: active && !sealed,
    canStart: (point) => distance(point, from) <= GRAB_RADIUS,
    onStart: (session) => {
      if (firstTouch.current === 0) firstTouch.current = session.startedAt;
      setTaping(true);
      loop.start();
      onInteractionStart();
    },
    onFrame: (session) => {
      const { points, current } = session;
      if (!current) return;
      drawTape(points);

      // The pull rises in pitch as the tape stretches further.
      const trace = measureTrace(points, from, to);
      loop.setIntensity(0.3 + trace.endProgress * 0.7);
      return trace.endProgress >= AUTO_FINISH;
    },
    onEnd: finish,
    onCancel: retract,
  });

  return (
    <svg
      ref={surfaceRef}
      viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}
      className="sf-machine-surface h-full w-full"
      role="img"
      aria-label={`Packager. Drag the tape from the dispenser to the far edge of the box to seal it.${
        runs.length > 1 ? ` Strip ${Math.min(laid.length + 1, runs.length)} of ${runs.length}.` : ""
      }`}
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

        {/* Strips already laid */}
        {laid.map((points, index) => (
          <polyline key={index} points={points} fill="none" stroke="var(--fx-accent)" strokeOpacity="0.88" strokeWidth={TAPE_WIDTH} strokeLinejoin="round" strokeLinecap="butt" />
        ))}

        {/* Guide for the strip on offer */}
        {!sealed && (
          <g className={taping ? "sf-guide sf-guide-active" : "sf-guide"}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="var(--fx-accent-2)" strokeWidth={TAPE_WIDTH} opacity="0.2" />
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#ffffff" strokeWidth="2.5" strokeDasharray="7 7" strokeLinecap="round" />
            <rect x="-5" y="-19" width="10" height="38" rx="5" transform={`translate(${to.x} ${to.y}) rotate(${angle})`} fill="var(--fx-accent)" stroke="#ffffff" strokeWidth="1.5" />
          </g>
        )}

        {/* The strip being pulled, updated outside React while dragging */}
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

      {runs.length > 1 && <StepPips total={runs.length} done={laid.length} x={344} y={30} />}

      {/* Dispenser, sitting behind the start of the strip on offer */}
      {!sealed && (
        <g transform={`translate(${from.x} ${from.y}) rotate(${angle})`} style={{ pointerEvents: "none" }}>
          <rect x="-46" y="-30" width="40" height="60" rx="12" fill="var(--fx-machine-dark)" />
          <circle cx="-26" cy="0" r="19" fill="var(--fx-accent)" className={taping ? "sf-spin-fast" : undefined} />
          <circle cx="-26" cy="0" r="8" fill="var(--fx-machine-dark)" />
        </g>
      )}

      {/* Tape tab: the thing to grab */}
      {!sealed && (
        <g
          // Re-keyed per strip so the tab starts at the new dispenser.
          key={laid.length}
          ref={tabRef}
          transform={`translate(${from.x} ${from.y}) rotate(${angle})`}
          style={{ pointerEvents: "none" }}
        >
          <g className={!taping && active ? "sf-pulse" : undefined}>
            <rect x="-9" y={-TAPE_WIDTH / 2 - 3} width="18" height={TAPE_WIDTH + 6} rx="6" fill="#ffffff" stroke="var(--fx-accent)" strokeWidth="3" />
            <path d="M -2 -5 L 3 0 L -2 5" fill="none" stroke="var(--fx-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      )}

      {/* First-time hint */}
      {hinting && !taping && laid.length === 0 && active && (
        <motion.circle
          r="11"
          fill="#ffffff"
          fillOpacity="0.55"
          stroke="var(--fx-accent)"
          strokeWidth="3"
          style={{ pointerEvents: "none" }}
          initial={{ cx: from.x, cy: from.y, opacity: 0 }}
          animate={{ cx: [from.x, to.x], cy: [from.y, to.y], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.35, ease: "easeInOut" }}
        />
      )}
    </svg>
  );
}
