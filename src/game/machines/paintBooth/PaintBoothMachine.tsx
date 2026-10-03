"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { audio } from "@/audio/audioManager";
import { useLoopSound } from "@/audio/useMachineAudio";
import { goldenColors, materialProfiles } from "@/game/products/materialProfiles";
import { ProductBody } from "@/game/products/ProductRenderer";
import { hashString, type Point } from "@/lib/math";
import { useTraceDrag } from "@/lib/pointer/useTraceDrag";
import { PRODUCT_RECT, STAGE, type MachineProps } from "../shared";
import {
  PAINT_CELL,
  calculatePaintBoothQuality,
  depositPaint,
  paintBoothTuning,
  paintCellCenter,
  paintCoverage,
} from "./paintBoothScoring";

const { cols, rows, nozzleRadius, thickThreshold, coveredThreshold } = paintBoothTuning;
const FALLBACK_GLAZE = "#2f7fd8";
/** Overspray marks kept for redraws; older ones are dropped. */
const MAX_SPLATS = 80;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The glaze for this order: stable per run, gold for Golden orders. */
function pickGlaze(runId: string, palette: string[] | undefined, isGolden: boolean): string {
  if (isGolden) return goldenColors.base;
  if (!palette || palette.length === 0) return FALLBACK_GLAZE;
  return palette[hashString(runId) % palette.length];
}

export function PaintBoothMachine({
  runId,
  material,
  isGolden,
  richness,
  look,
  active,
  onInteractionStart,
  onComplete,
  burst,
}: MachineProps) {
  const id = useId().replace(/:/g, "");
  const [glaze] = useState(() => pickGlaze(runId, materialProfiles[material].glazeColors, isGolden));
  const [done, setDone] = useState(false);
  const [spraying, setSpraying] = useState(false);
  const [percent, setPercent] = useState(0);

  const surfaceRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nozzleRef = useRef<SVGGElement>(null);
  const cells = useRef(new Float32Array(cols * rows));
  const pooled = useRef(new Set<number>());
  const splats = useRef<Point[]>([]);
  const nozzle = useRef<Point | null>(null);
  const frame = useRef(0);
  const flowing = useRef(false);
  const oversprayMs = useRef(0);
  const sprayedMs = useRef(0);
  const lastMist = useRef(0);
  const touched = useRef(false);
  const finished = useRef(false);
  const loop = useLoopSound("sprayLoop");

  /** Runs `draw` with the canvas scaled to stage units. Skipped while the canvas has no size. */
  const withCanvas = useCallback((draw: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || canvas.width === 0 || canvas.height === 0) return;
    const scale = canvas.width / STAGE.w;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    draw(ctx);
  }, []);

  const drawSplat = useCallback(
    (ctx: CanvasRenderingContext2D, at: Point) => {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = glaze;
      ctx.beginPath();
      ctx.arc(at.x, at.y, nozzleRadius * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    },
    [glaze],
  );

  const drawPool = useCallback((ctx: CanvasRenderingContext2D, index: number) => {
    const center = paintCellCenter(index);
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.beginPath();
    // A short drip: pooled paint reads as darker and running.
    ctx.ellipse(center.x, center.y + PAINT_CELL.h * 0.4, PAINT_CELL.w * 0.55, PAINT_CELL.h * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  /** Rebuilds the whole picture from the thickness grid, e.g. after a resize. */
  const redraw = useCallback(() => {
    withCanvas((ctx) => {
      const { x, y, w, h, r } = PRODUCT_RECT;
      ctx.clearRect(0, 0, STAGE.w, STAGE.h);
      splats.current.forEach((at) => drawSplat(ctx, at));

      ctx.save();
      roundedRect(ctx, x, y, w, h, r);
      ctx.clip();
      ctx.fillStyle = glaze;
      for (let i = 0; i < cells.current.length; i++) {
        const thickness = cells.current[i];
        if (thickness <= 0) continue;
        const center = paintCellCenter(i);
        ctx.globalAlpha = Math.min(1, thickness / coveredThreshold);
        ctx.beginPath();
        ctx.arc(center.x, center.y, PAINT_CELL.w * 0.95, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      pooled.current.forEach((index) => drawPool(ctx, index));
      ctx.restore();
    });
  }, [withCanvas, drawSplat, drawPool, glaze]);

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

  const stopFlow = useCallback(() => {
    flowing.current = false;
    cancelAnimationFrame(frame.current);
  }, []);

  useEffect(() => stopFlow, [stopFlow]);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    stopFlow();
    loop.stop();
    setSpraying(false);
    setDone(true);
    setPercent(100);
    audio.play("polishDone");
    burst(
      { x: PRODUCT_RECT.x + PRODUCT_RECT.w / 2, y: PRODUCT_RECT.y + PRODUCT_RECT.h / 2 },
      { count: 12, spread: 110, shape: "spark", colors: ["#ffffff", glaze] },
    );
    onComplete({
      quality: calculatePaintBoothQuality({ cells: cells.current, oversprayMs: oversprayMs.current }),
      durationMs: sprayedMs.current,
      metadata: { glaze, oversprayMs: Math.round(oversprayMs.current) },
    });
  };

  /** One frame of spraying at the nozzle's current position. */
  const spray = (dtMs: number, now: number) => {
    const at = nozzle.current;
    if (!at) return;
    sprayedMs.current += dtMs;

    const offTile = depositPaint(cells.current, at, dtMs);
    if (offTile) {
      oversprayMs.current += dtMs;
      if (splats.current.length < MAX_SPLATS) splats.current.push(at);
    }

    // Cells that just pooled get a drip, once.
    const fresh: number[] = [];
    for (let i = 0; i < cells.current.length; i++) {
      if (cells.current[i] > thickThreshold && !pooled.current.has(i)) {
        pooled.current.add(i);
        fresh.push(i);
      }
    }

    withCanvas((ctx) => {
      const { x, y, w, h, r } = PRODUCT_RECT;
      if (offTile) drawSplat(ctx, at);

      ctx.save();
      roundedRect(ctx, x, y, w, h, r);
      ctx.clip();
      const mist = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, nozzleRadius);
      mist.addColorStop(0, glaze);
      mist.addColorStop(1, "rgba(255, 255, 255, 0)");
      // Opacity builds with time under the spray, like the thickness grid does.
      ctx.globalAlpha = Math.min(1, (paintBoothTuning.flowPerMs * dtMs) / coveredThreshold) * 1.6;
      ctx.fillStyle = mist;
      ctx.beginPath();
      ctx.arc(at.x, at.y, nozzleRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      fresh.forEach((index) => drawPool(ctx, index));
      ctx.restore();
    });

    if (now - lastMist.current > 140) {
      lastMist.current = now;
      burst(at, { count: 2, spread: 24, colors: [glaze, "#ffffff"] });
    }

    const coverage = paintCoverage(cells.current);
    setPercent(Math.round(coverage * 100));
    if (coverage >= paintBoothTuning.autoFinishCoverage) finish();
  };

  const startFlow = () => {
    if (flowing.current) return;
    flowing.current = true;
    let last = performance.now();
    const tick = (now: number) => {
      if (!flowing.current) return;
      // Clamped so a paused tab cannot dump a puddle of paint on return.
      spray(Math.min(50, now - last), now);
      last = now;
      if (flowing.current) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const moveNozzle = (at: Point) => {
    nozzle.current = at;
    nozzleRef.current?.setAttribute("transform", `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`);
  };

  const lift = () => {
    stopFlow();
    loop.stop();
    setSpraying(false);
  };

  useTraceDrag(surfaceRef, {
    enabled: active && !done,
    onStart: (session) => {
      if (!touched.current) {
        touched.current = true;
        onInteractionStart();
      }
      if (session.start) moveNozzle(session.start);
      setSpraying(true);
      loop.start();
      loop.setIntensity(0.8);
      startFlow();
    },
    onFrame: (session) => {
      if (session.current) moveNozzle(session.current);
    },
    onEnd: () => {
      lift();
      // Lifting the nozzle is fine: the coat can be finished with another pass.
      if (paintCoverage(cells.current) >= paintBoothTuning.releaseFinishCoverage) finish();
    },
    onCancel: lift,
  });

  const { x, y, w, h } = PRODUCT_RECT;
  const painted = { ...look, paint: { color: glaze } };

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${STAGE.w} ${STAGE.h}`} className="absolute inset-0 h-full w-full" aria-hidden>
        {/* Booth bed with a masking frame around the tile */}
        <rect x="52" y="44" width="296" height="212" rx="24" fill="var(--fx-machine-dark)" opacity="0.92" />
        <rect x="60" y="52" width="280" height="196" rx="18" fill="var(--fx-machine)" />
        <rect x="60" y="52" width="280" height="64" rx="18" fill="var(--fx-machine-light)" opacity="0.28" />
        <rect
          x={x - 7}
          y={y - 7}
          width={w + 14}
          height={h + 14}
          rx={PRODUCT_RECT.r + 6}
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeDasharray="6 6"
        />
        {/* Once finished, the even glazed tile shows through as the sprayed layer fades. */}
        <ProductBody material={material} isGolden={isGolden} richness={richness} look={done ? painted : look} {...PRODUCT_RECT} />
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
        aria-label="Paint Booth. Hold and sweep the spray across the tile for an even coat. Keep moving, and stay on the tile."
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

        {/* Coverage meter */}
        <g>
          <rect x="110" y="264" width="180" height="12" rx="6" fill="var(--fx-machine-dark)" opacity="0.85" />
          <rect x="112" y="266" width={(176 * percent) / 100} height="8" rx="4" fill={glaze} style={{ transition: "width 120ms linear" }} />
          <text x="302" y="275" fontSize="13" fontWeight="800" fill="var(--fx-ink)">
            {percent}%
          </text>
        </g>

        {/* Spray nozzle */}
        {!done && (
          <g ref={nozzleRef} transform={`translate(${x + 24} ${y + 24})`} style={{ pointerEvents: "none" }}>
            <circle r={nozzleRadius} fill={glaze} fillOpacity={spraying ? 0.16 : 0.08} stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="4 5" />
            <g className={!spraying && active ? "sf-pulse" : undefined}>
              <circle r="11" fill="#ffffff" stroke="var(--fx-machine-dark)" strokeWidth="2.5" />
              <circle r="5" fill={glaze} />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
