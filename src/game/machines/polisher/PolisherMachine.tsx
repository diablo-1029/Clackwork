"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { audio } from "@/audio/audioManager";
import { useLoopSound } from "@/audio/useMachineAudio";
import { materialProfiles } from "@/game/products/materialProfiles";
import { ProductBody } from "@/game/products/ProductRenderer";
import { distance, hashString, seededRandom, type Point } from "@/lib/math";
import { useTraceDrag, type DragSession } from "@/lib/pointer/useTraceDrag";
import { PRODUCT_RECT, STAGE, type MachineProps } from "../shared";
import { calculatePolisherQuality, initialPolish, polishCoverage, polisherTuning } from "./polisherScoring";

const { cols, rows, polishedThreshold } = polisherTuning;
const CELL_W = PRODUCT_RECT.w / cols;
const CELL_H = PRODUCT_RECT.h / rows;
/** Polishing pad radius, in stage units. */
const BRUSH = 30;
/** Spacing between polish stamps along a stroke. */
const STAMP_STEP = 7;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function PolisherMachine({
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
  const id = useId().replace(/:/g, "");
  const [done, setDone] = useState(false);
  const [buffing, setBuffing] = useState(false);
  const [percent, setPercent] = useState(0);

  const surfaceRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SVGGElement>(null);
  // Some variants arrive partly clean: only the dull regions need work.
  const [initial] = useState(() => initialPolish(variant, runId));
  const [baseline] = useState(() => polishCoverage(initial));
  const cells = useRef(new Float32Array(initial));
  const lastStamp = useRef<Point | null>(null);
  const touched = useRef(false);
  /** Time actually spent buffing; pauses between strokes do not count. */
  const buffedMs = useRef(0);
  const strokeStart = useRef(0);
  const lastSparkle = useRef(0);
  const finished = useRef(false);
  const profile = materialProfiles[material];
  const loop = useLoopSound("polishLoop", profile.polishTone);
  const friction = profile.polishFriction;

  const endStroke = () => {
    if (strokeStart.current === 0) return;
    buffedMs.current += performance.now() - strokeStart.current;
    strokeStart.current = 0;
  };

  /** Paints the dull film, then re-opens whatever has already been polished. */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    // A zero-size canvas (hidden or mid-layout) is skipped; the observer retries.
    if (!canvas || !ctx || canvas.width === 0 || canvas.height === 0) return;

    const scale = canvas.width / STAGE.w;
    const { x, y, w, h, r } = PRODUCT_RECT;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, STAGE.w, STAGE.h);

    ctx.save();
    roundedRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.fillStyle = "rgba(104, 110, 124, 0.86)";
    ctx.fillRect(x, y, w, h);

    // Smudges and scuffs, identical on every redraw of the same run.
    const random = seededRandom(hashString(runId));
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 ? "rgba(70, 76, 90, 0.35)" : "rgba(170, 176, 188, 0.28)";
      ctx.beginPath();
      ctx.ellipse(x + random() * w, y + random() * h, 12 + random() * 26, 6 + random() * 14, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(60, 66, 80, 0.35)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) {
      const sx = x + random() * w;
      const sy = y + random() * h;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 14 + random() * 26, sy + (random() - 0.5) * 12);
      ctx.stroke();
    }
    ctx.restore();

    // Clear the film over clean cells with soft, overlapping brushes: the inside of a
    // clean area ends up fully clear and its border fades, instead of showing each cell.
    ctx.globalCompositeOperation = "destination-out";
    const reach = CELL_W * 1.8;
    for (let i = 0; i < cells.current.length; i++) {
      const value = cells.current[i];
      if (value <= 0) continue;
      const cx = x + ((i % cols) + 0.5) * CELL_W;
      const cy = y + (Math.floor(i / cols) + 0.5) * CELL_H;
      const brush = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
      brush.addColorStop(0, `rgba(0, 0, 0, ${Math.min(1, value)})`);
      brush.addColorStop(0.55, `rgba(0, 0, 0, ${Math.min(1, value) * 0.6})`);
      brush.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = brush;
      ctx.beginPath();
      ctx.arc(cx, cy, reach, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [runId]);

  // Keep the canvas resolution matched to its on-screen size, including after rotation.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);
      if (width === 0 || height === 0) return;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      redraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  /** Polishes one pad-sized spot. Returns a cell that just became shiny, if any. */
  const stamp = (at: Point): Point | null => {
    const { x, y } = PRODUCT_RECT;
    let fresh: Point | null = null;

    const minCol = Math.max(0, Math.floor((at.x - BRUSH - x) / CELL_W));
    const maxCol = Math.min(cols - 1, Math.floor((at.x + BRUSH - x) / CELL_W));
    const minRow = Math.max(0, Math.floor((at.y - BRUSH - y) / CELL_H));
    const maxRow = Math.min(rows - 1, Math.floor((at.y + BRUSH - y) / CELL_H));

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const center = { x: x + (col + 0.5) * CELL_W, y: y + (row + 0.5) * CELL_H };
        const d = distance(center, at);
        if (d > BRUSH) continue;
        const index = row * cols + col;
        const before = cells.current[index];
        // Stickier materials take a little more buffing per pass.
        const after = Math.min(1, before + (1 - d / BRUSH) * (0.62 - friction * 0.2));
        cells.current[index] = after;
        if (before < polishedThreshold && after >= polishedThreshold) fresh = center;
      }
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx && canvas.width > 0) {
      const gradient = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, BRUSH);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0.55)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(at.x, at.y, BRUSH, 0, Math.PI * 2);
      ctx.fill();
    }
    return fresh;
  };

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    endStroke();
    loop.stop();
    setBuffing(false);
    setDone(true);
    setPercent(100);
    audio.play("polishDone");
    burst({ x: PRODUCT_RECT.x + PRODUCT_RECT.w / 2, y: PRODUCT_RECT.y + PRODUCT_RECT.h / 2 }, { count: 12, spread: 110, shape: "spark", colors: ["#ffffff", "var(--fx-accent-2)"] });
    onComplete({
      quality: calculatePolisherQuality({ cells: cells.current, durationMs: buffedMs.current }),
      durationMs: buffedMs.current,
    });
  };

  const polishAlong = (session: DragSession): boolean => {
    const target = session.current;
    if (!target) return false;
    padRef.current?.setAttribute("transform", `translate(${target.x.toFixed(1)} ${target.y.toFixed(1)})`);

    const from = lastStamp.current ?? target;
    const span = distance(from, target);
    const steps = Math.max(1, Math.ceil(span / STAMP_STEP));
    let fresh: Point | null = null;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      fresh = stamp({ x: from.x + (target.x - from.x) * t, y: from.y + (target.y - from.y) * t }) ?? fresh;
    }
    lastStamp.current = target;
    loop.setIntensity(Math.min(1, 0.35 + span * 0.05));

    const now = performance.now();
    if (fresh && now - lastSparkle.current > 130) {
      lastSparkle.current = now;
      burst(fresh, { count: 2, spread: 22, shape: "spark", colors: ["#ffffff"] });
    }

    const coverage = polishCoverage(cells.current);
    // The meter shows progress through the dull part, so it always starts at 0.
    setPercent(Math.round(((coverage - baseline) / Math.max(0.01, 1 - baseline)) * 100));
    return coverage >= polisherTuning.autoFinishCoverage;
  };

  useTraceDrag(surfaceRef, {
    enabled: active && !done,
    onStart: (session) => {
      if (!touched.current) {
        touched.current = true;
        onInteractionStart();
      }
      strokeStart.current = session.startedAt;
      lastStamp.current = null;
      setBuffing(true);
      loop.start();
      if (polishAlong(session)) finish();
    },
    onFrame: polishAlong,
    onEnd: () => {
      endStroke();
      loop.stop();
      setBuffing(false);
      // Lifting the pad is fine: polishing can continue with another stroke.
      if (polishCoverage(cells.current) >= polisherTuning.releaseFinishCoverage) finish();
    },
    onCancel: () => {
      endStroke();
      loop.stop();
      setBuffing(false);
    },
  });

  const { x, y, w, h } = PRODUCT_RECT;

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${STAGE.w} ${STAGE.h}`} className="absolute inset-0 h-full w-full" aria-hidden>
        <rect x="62" y="52" width="276" height="196" rx="22" fill="var(--fx-machine-dark)" opacity="0.92" />
        <rect x="70" y="60" width="260" height="180" rx="16" fill="var(--fx-machine)" />
        <rect x="70" y="60" width="260" height="60" rx="16" fill="var(--fx-machine-light)" opacity="0.28" />
        <ProductBody material={material} isGolden={isGolden} richness={richness} look={{ ...look, polished: true }} {...PRODUCT_RECT} />
      </svg>

      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-300"
        style={{ opacity: done ? 0 : 1 }}
        aria-hidden
      />

      <svg
        ref={surfaceRef}
        viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}
        className="sf-machine-surface absolute inset-0 h-full w-full"
        role="img"
        aria-label="Polisher. Rub the product until every dull spot shines."
      >
        <defs>
          <clipPath id={`${id}-clip`}>
            <rect x={x} y={y} width={w} height={h} rx={PRODUCT_RECT.r} />
          </clipPath>
        </defs>

        {done && (
          <g clipPath={`url(#${id}-clip)`}>
            <motion.rect
              y={y - 20}
              width="50"
              height={h + 40}
              fill="#ffffff"
              opacity="0.6"
              transform="skewX(-18)"
              initial={{ x: x - 40 }}
              animate={{ x: x + w + 90 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </g>
        )}

        {/* Progress meter */}
        <g>
          <rect x="110" y="262" width="180" height="12" rx="6" fill="var(--fx-machine-dark)" opacity="0.85" />
          <rect x="112" y="264" width={(176 * percent) / 100} height="8" rx="4" fill="var(--fx-accent)" style={{ transition: "width 120ms linear" }} />
          <text x="302" y="273" fontSize="13" fontWeight="800" fill="var(--fx-ink)">
            {percent}%
          </text>
        </g>

        {/* Polishing pad */}
        {!done && (
          <g ref={padRef} transform={`translate(${x + w - 26} ${y + h - 22})`} style={{ pointerEvents: "none" }}>
            <g className={buffing ? "sf-spin-fast" : active ? "sf-pulse" : undefined}>
              <circle r="24" fill="#ffffff" fillOpacity="0.92" stroke="var(--fx-machine-dark)" strokeWidth="2.5" />
              <circle r="15" fill="none" stroke="var(--fx-accent-2)" strokeWidth="4" strokeDasharray="9 7" />
              <circle r="5.5" fill="var(--fx-accent)" />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
