"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { audio } from "@/audio/audioManager";
import { getMaterialColors } from "@/game/products/materialProfiles";
import { RobotPiece, RobotShell, RobotSocketOutline } from "@/game/products/RobotParts";
import type { Point } from "@/lib/math";
import { useTraceDrag } from "@/lib/pointer/useTraceDrag";
import { useSettingsStore } from "@/stores/settingsStore";
import { STAGE, type MachineProps } from "../shared";
import {
  calculateAssemblerQuality,
  partAt,
  resolveDrop,
  sitsBehind,
  stageForStep,
  type RobotPart,
} from "./assemblerScoring";

const translate = (at: Point) => `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`;

export function AssemblerMachine({
  runId,
  material,
  isGolden,
  look,
  step,
  active,
  onInteractionStart,
  onInteractionCancel,
  onComplete,
  burst,
}: MachineProps) {
  // Which section this visit builds: the product's chain visits the Assembler once per step.
  const [stage] = useState(() => stageForStep(step, runId));
  /** Which socket each placed part sits in. */
  const [placed, setPlaced] = useState<Record<string, string>>({});
  /** The part in the player's hand, so its sockets can light up and it can be drawn on top. */
  const [heldId, setHeldId] = useState<string | null>(null);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  const surfaceRef = useRef<SVGSVGElement>(null);
  const partRefs = useRef<Record<string, SVGGElement | null>>({});
  const held = useRef<string | null>(null);
  const placedRef = useRef<Record<string, string>>({});
  const offsets = useRef<number[]>([]);
  const wrongDrops = useRef(0);
  const startedAt = useRef(0);
  const finished = useRef(false);
  const timers = useRef<number[]>([]);

  // Every part wears the colour the Paint Booth gave the robot.
  const color = look.paint?.color ?? getMaterialColors(material, isGolden).base;

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  /** Moves a part's element directly; React state only changes when a part is picked up or placed. */
  const movePart = (partId: string, at: Point, animate: boolean) => {
    const element = partRefs.current[partId];
    if (!element) return;
    element.style.transition = animate && !reducedMotion ? "transform 180ms cubic-bezier(0.2, 1.4, 0.4, 1)" : "none";
    element.style.transform = translate(at);
  };

  const release = (at: Point | null) => {
    const partId = held.current;
    held.current = null;
    setHeldId(null);
    const part = stage.parts.find((p) => p.id === partId);
    if (!part) return;

    const outcome = at ? resolveDrop(stage, part.id, at, Object.values(placedRef.current)) : ({ kind: "miss" } as const);

    if (outcome.kind !== "placed") {
      // Back to the tray. Only a drop onto the wrong socket counts against the player.
      movePart(part.id, part.tray, true);
      if (outcome.kind === "wrong") {
        wrongDrops.current += 1;
        audio.play("sortMiss");
      }
      if (Object.keys(placedRef.current).length === 0 && wrongDrops.current === 0) onInteractionCancel();
      return;
    }

    const socket = stage.sockets.find((s) => s.id === outcome.socketId)!;
    placedRef.current = { ...placedRef.current, [part.id]: socket.id };
    offsets.current.push(outcome.offset);
    setPlaced(placedRef.current);
    movePart(part.id, socket.at, true);
    audio.play("snapIn");
    burst(socket.at, { count: 6, spread: 40, shape: "spark" });

    if (Object.keys(placedRef.current).length < stage.parts.length || finished.current) return;

    finished.current = true;
    timers.current.push(window.setTimeout(() => audio.play("boxClose"), 120));
    burst({ x: STAGE.w / 2, y: 130 }, { count: 12, spread: 110, shape: "spark" });
    onComplete({
      quality: calculateAssemblerQuality(stage, { offsets: offsets.current, wrongDrops: wrongDrops.current }),
      durationMs: performance.now() - startedAt.current,
      metadata: { stage: stage.id, wrongDrops: wrongDrops.current },
    });
  };

  const allPlaced = Object.keys(placed).length >= stage.parts.length;

  useTraceDrag(surfaceRef, {
    enabled: active && !allPlaced,
    canStart: (point) => partAt(stage, point, Object.keys(placedRef.current)) !== null,
    onStart: (session) => {
      const part = session.start ? partAt(stage, session.start, Object.keys(placedRef.current)) : null;
      if (!part) return;
      if (startedAt.current === 0) startedAt.current = session.startedAt;
      held.current = part.id;
      setHeldId(part.id);
      onInteractionStart();
      if (session.start) movePart(part.id, session.start, false);
    },
    onFrame: (session) => {
      if (held.current && session.current) movePart(held.current, session.current, false);
    },
    onEnd: (session) => release(session.current),
    onCancel: () => release(null),
  });

  const filledSockets = Object.values(placed);
  const heldKind = stage.parts.find((part) => part.id === heldId)?.kind ?? null;

  const renderPart = (part: RobotPart) => {
    const socket = stage.sockets.find((s) => s.id === placed[part.id]);
    return (
      <g
        key={part.id}
        ref={(element) => {
          partRefs.current[part.id] = element;
        }}
        style={{ transform: translate(socket ? socket.at : part.tray), pointerEvents: "none" }}
      >
        <g className={!socket && heldId === null && active ? "sf-pulse" : undefined}>
          <g transform={`scale(${stage.scale})`}>
            <RobotPiece kind={part.kind} color={color} />
          </g>
        </g>
      </g>
    );
  };

  // Placed parts that tuck behind their section are drawn under it; loose parts
  // and whatever is in hand stay in front, with the held part on top.
  const behind = stage.parts.filter((part) => placed[part.id] && sitsBehind(part.kind) && part.id !== heldId);
  const inFront = stage.parts
    .filter((part) => !behind.includes(part))
    .sort((a, b) => Number(a.id === heldId) - Number(b.id === heldId));

  return (
    <svg
      ref={surfaceRef}
      viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}
      className="sf-machine-surface h-full w-full"
      role="img"
      aria-label={`Assembler, ${stage.label}. ${stage.instruction} Drag each part onto the outline of the same shape. ${filledSockets.length} of ${stage.parts.length} parts in place.`}
    >
      {/* Workbench: side trays and a stand for the final build, one tray along the bottom otherwise */}
      {stage.id === "final" ? (
        <>
          <rect x="18" y="20" width="76" height="262" rx="18" fill="var(--fx-machine-dark)" opacity="0.55" />
          <rect x="306" y="6" width="76" height="278" rx="18" fill="var(--fx-machine-dark)" opacity="0.55" />
          <rect x="120" y="230" width="160" height="16" rx="8" fill="var(--fx-machine-dark)" />
          <rect x="112" y="240" width="176" height="22" rx="10" fill="var(--fx-machine)" />
          <rect x="112" y="240" width="176" height="8" rx="4" fill="var(--fx-machine-light)" opacity="0.4" />
        </>
      ) : (
        <>
          <rect x="40" y="14" width="320" height="210" rx="24" fill="var(--fx-machine-dark)" opacity="0.18" />
          <rect x="18" y="228" width="364" height="68" rx="18" fill="var(--fx-machine-dark)" opacity="0.55" />
        </>
      )}

      {/* A small pop when the last part goes on */}
      <motion.g
        initial={false}
        animate={allPlaced ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        {behind.map(renderPart)}

        {stage.shells.map((shell, index) => (
          <g key={index} transform={`translate(${shell.at.x} ${shell.at.y}) scale(${stage.scale})`} style={{ pointerEvents: "none" }}>
            <RobotShell kind={shell.kind} color={color} complete={shell.complete} />
          </g>
        ))}

        {/* Empty sockets, each the outline of the part it takes */}
        {stage.sockets
          .filter((socket) => !filledSockets.includes(socket.id))
          .map((socket) => (
            <g key={socket.id} transform={`translate(${socket.at.x} ${socket.at.y}) scale(${stage.scale})`} style={{ pointerEvents: "none" }}>
              <RobotSocketOutline kind={socket.kind} active={heldKind === socket.kind} />
            </g>
          ))}

        {inFront.map(renderPart)}
      </motion.g>
    </svg>
  );
}
