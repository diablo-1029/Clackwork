"use client";

import { motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { audio } from "@/audio/audioManager";
import { getMaterialColors, materialProfiles } from "@/game/products/materialProfiles";
import { STAGE, type MachineProps } from "../shared";
import { calculateSorterQuality, createSortQueue, sortShapes, type SortPick, type SortShape } from "./sorterScoring";

/** Where a gem waits to be sorted. */
const GATE = { x: 200, y: 112 } as const;
const BIN = { w: 132, h: 84, y: 188 } as const;
/** Left edge of each bin, in lane order. */
const BIN_X = [46, 222] as const;
/** How long a gem takes to fly into its bin before the next one arrives. */
const FLIGHT_MS = 240;

interface PieceProps {
  shape: SortShape;
  colors: ReturnType<typeof getMaterialColors>;
  /** Cut stones show facets; everything else is a smooth cast piece (a coin or a small bar). */
  faceted: boolean;
}

function Piece({ shape, colors, faceted }: PieceProps) {
  const id = useId().replace(/:/g, "");
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2={faceted ? 1 : 0} y2="1">
          <stop offset="0" stopColor={colors.light} />
          <stop offset="0.6" stopColor={colors.base} />
          <stop offset="1" stopColor={colors.dark} />
        </linearGradient>
      </defs>
      <path d={shape.path} fill={colors.dark} transform="translate(0 3)" />
      <path d={shape.path} fill={`url(#${id}-fill)`} stroke={colors.dark} strokeWidth="1.5" />
      {faceted ? (
        <path d={shape.facets} fill="#ffffff" fillOpacity="0.28" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.2" strokeLinejoin="round" />
      ) : (
        <>
          {/* A raised inner face with a soft rim and a highlight along the top. */}
          <path d={shape.path} transform="translate(0 1) scale(0.7)" fill={colors.dark} fillOpacity="0.35" />
          <path d={shape.path} transform="scale(0.7)" fill={`url(#${id}-fill)`} stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.6" />
          <path d="M -9 -8 Q 0 -12 9 -8" fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

export function SorterMachine({ runId, material, isGolden, active, onInteractionStart, onComplete, burst }: MachineProps) {
  const [queue] = useState(() => createSortQueue(runId));
  const [index, setIndex] = useState(0);
  /** Outcome per gem so far, for the progress pips. */
  const [outcomes, setOutcomes] = useState<boolean[]>([]);
  /** The lane the current gem is flying into, if it has been sent. */
  const [flight, setFlight] = useState<number | null>(null);
  const [lastPick, setLastPick] = useState<{ lane: number; correct: boolean; n: number } | null>(null);

  const picks = useRef<SortPick[]>([]);
  const arrivedAt = useRef(0);
  const startedAt = useRef(0);
  const touched = useRef(false);
  const finished = useRef(false);
  const timers = useRef<number[]>([]);
  const colors = getMaterialColors(material, isGolden);

  const total = queue.length;
  const shape = sortShapes.find((s) => s.id === queue[Math.min(index, total - 1)]) ?? sortShapes[0];
  const allSorted = outcomes.length >= total;

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  // The reaction clock starts when a gem is at the gate and input is open,
  // so time spent waiting for the machine to arrive is never counted.
  useEffect(() => {
    if (!active) return;
    arrivedAt.current = performance.now();
    if (startedAt.current === 0) startedAt.current = arrivedAt.current;
  }, [active, index]);

  const send = (lane: number) => {
    if (!active || finished.current || flight !== null || index >= total) return;
    const now = performance.now();
    const correct = sortShapes[lane]?.id === queue[index];

    if (!touched.current) {
      touched.current = true;
      onInteractionStart();
    }

    picks.current.push({ correct, reactionMs: now - arrivedAt.current });
    setFlight(lane);
    setLastPick({ lane, correct, n: picks.current.length });
    setOutcomes((current) => [...current, correct]);

    const landing = { x: BIN_X[lane] + BIN.w / 2, y: BIN.y + BIN.h / 2 };
    timers.current.push(
      window.setTimeout(() => {
        audio.play(correct ? "sortDrop" : "sortMiss");
        if (correct) burst(landing, { count: 6, spread: 44, shape: "spark", colors: colors.particles });
      }, FLIGHT_MS * 0.7),
    );

    if (picks.current.length >= total) {
      // The last pick completes the machine straight away; the gem still finishes its flight.
      finished.current = true;
      onComplete({
        quality: calculateSorterQuality(picks.current),
        durationMs: now - startedAt.current,
        metadata: { correct: picks.current.filter((pick) => pick.correct).length, total },
      });
      return;
    }

    timers.current.push(
      window.setTimeout(() => {
        setFlight(null);
        setIndex((current) => current + 1);
      }, FLIGHT_MS),
    );
  };

  // Arrow keys pick a bin, alongside the bin buttons themselves.
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") sendRef.current(0);
      else if (event.key === "ArrowRight") sendRef.current(sortShapes.length - 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const target = flight === null ? GATE : { x: BIN_X[flight] + BIN.w / 2, y: BIN.y + BIN.h / 2 - 6 };

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${STAGE.w} ${STAGE.h}`} className="h-full w-full" aria-hidden>
        {/* Feed belt down to the gate, then a chute to each bin */}
        <rect x="168" y="8" width="64" height="118" rx="12" fill="var(--fx-machine-dark)" opacity="0.92" />
        <rect x="176" y="8" width="48" height="110" rx="8" fill="var(--fx-belt)" />
        {[26, 50, 74].map((y) => (
          <rect key={y} x="176" y={y} width="48" height="4" fill="var(--fx-belt-stripe)" />
        ))}
        <path d={`M 176 ${GATE.y + 14} L ${BIN_X[0] + BIN.w / 2} ${BIN.y} M 224 ${GATE.y + 14} L ${BIN_X[1] + BIN.w / 2} ${BIN.y}`} stroke="var(--fx-machine-dark)" strokeOpacity="0.35" strokeWidth="26" strokeLinecap="round" />
        <circle cx={GATE.x} cy={GATE.y} r="33" fill="var(--fx-machine)" stroke="var(--fx-machine-dark)" strokeWidth="4" />
        <circle cx={GATE.x} cy={GATE.y} r="33" fill="none" stroke="var(--fx-accent-2)" strokeWidth="2" strokeDasharray="5 6" opacity="0.8" />

        {/* Bins, each marked with the shape it takes */}
        {sortShapes.map((bin, lane) => {
          const hit = lastPick?.lane === lane ? lastPick : null;
          return (
            <motion.g
              // Re-keyed per pick so the reaction replays even for the same bin twice running.
              key={hit ? `${bin.id}-${hit.n}` : bin.id}
              initial={{ x: 0, y: 0 }}
              // A small bounce when a gem lands where it belongs, a gentle shake when it does not.
              animate={hit ? (hit.correct ? { y: [0, 5, 0] } : { x: [0, -5, 5, -3, 0] }) : { x: 0, y: 0 }}
              transition={{ duration: 0.3, delay: (FLIGHT_MS * 0.7) / 1000 }}
            >
              <rect x={BIN_X[lane]} y={BIN.y + 6} width={BIN.w} height={BIN.h} rx="16" fill="var(--fx-machine-dark)" />
              <rect x={BIN_X[lane]} y={BIN.y} width={BIN.w} height={BIN.h} rx="16" fill="var(--fx-machine)" />
              <rect x={BIN_X[lane] + 8} y={BIN.y + 8} width={BIN.w - 16} height={BIN.h - 16} rx="10" fill="var(--fx-machine-dark)" opacity="0.55" />
              <path
                d={bin.path}
                transform={`translate(${BIN_X[lane] + 34} ${BIN.y + BIN.h / 2})`}
                fill="none"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <text x={BIN_X[lane] + 64} y={BIN.y + BIN.h / 2 + 6} fontSize="17" fontWeight="900" fill="#ffffff">
                {bin.label}
              </text>
            </motion.g>
          );
        })}

        {/* The gem at the gate (or in flight to a bin) */}
        {index < total && !(allSorted && flight === null) && (
          <motion.g
            key={index}
            initial={{ x: GATE.x, y: 16, opacity: 0, scale: 0.8 }}
            animate={
              flight === null
                ? { x: target.x, y: target.y, opacity: 1, scale: 1 }
                : { x: target.x, y: target.y, opacity: [1, 1, 0], scale: 0.62 }
            }
            transition={{ duration: flight === null ? 0.22 : FLIGHT_MS / 1000, ease: "easeOut" }}
          >
            <Piece shape={shape} colors={colors} faceted={materialProfiles[material].colorTreatment === "facet"} />
          </motion.g>
        )}

        {/* Progress pips: a tick for the right bin, a dash otherwise */}
        <g transform={`translate(${STAGE.w / 2 - ((total - 1) * 22) / 2} 290)`}>
          {queue.map((_, i) => {
            const outcome = outcomes[i];
            return (
              <g key={i} transform={`translate(${i * 22} 0)`}>
                <circle
                  r="8"
                  fill={outcome === undefined ? "none" : outcome ? "var(--sf-success)" : "var(--fx-machine-dark)"}
                  stroke={outcome === undefined ? "var(--fx-ink-soft)" : "#ffffff"}
                  strokeWidth={i === index && outcome === undefined ? 3 : 1.5}
                />
                {outcome === true && <path d="M -3.5 0 L -1 2.8 L 3.8 -2.8" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                {outcome === false && <path d="M -3.5 0 L 3.5 0" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Each bin is a real button, so touch, mouse and keyboard all work. */}
      {sortShapes.map((bin, lane) => (
        <button
          key={bin.id}
          type="button"
          className="sf-machine-surface absolute cursor-pointer rounded-2xl"
          style={{
            left: `${(BIN_X[lane] / STAGE.w) * 100}%`,
            top: `${((BIN.y - 8) / STAGE.h) * 100}%`,
            width: `${(BIN.w / STAGE.w) * 100}%`,
            height: `${((BIN.h + 20) / STAGE.h) * 100}%`,
          }}
          aria-label={`${bin.label} bin. The piece at the gate is ${shape.label.toLowerCase()}.`}
          disabled={!active || allSorted}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            event.preventDefault();
            send(lane);
          }}
          onKeyDown={(event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              send(lane);
            }
          }}
        />
      ))}
    </div>
  );
}
