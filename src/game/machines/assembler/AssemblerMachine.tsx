"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { audio } from "@/audio/audioManager";
import { getMaterialColors } from "@/game/products/materialProfiles";
import { RobotPartShape, RobotSocketOutline, RobotTorso } from "@/game/products/RobotParts";
import type { Point } from "@/lib/math";
import { useTraceDrag } from "@/lib/pointer/useTraceDrag";
import { useSettingsStore } from "@/stores/settingsStore";
import { STAGE, type MachineProps } from "../shared";
import {
  ROBOT_TORSO,
  calculateAssemblerQuality,
  partAt,
  resolveDrop,
  robotParts,
  robotSockets,
  type RobotPartKind,
} from "./assemblerScoring";

const translate = (at: Point) => `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`;

/** Limbs are drawn before the torso so it overlaps their joints; the head goes on top. */
const DRAW_ORDER: RobotPartKind[] = ["arm", "leg", "head"];

export function AssemblerMachine({
  material,
  isGolden,
  look,
  active,
  onInteractionStart,
  onInteractionCancel,
  onComplete,
  burst,
}: MachineProps) {
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
    const part = robotParts.find((p) => p.id === partId);
    if (!part) return;

    const outcome = at ? resolveDrop(part.id, at, Object.values(placedRef.current)) : ({ kind: "miss" } as const);

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

    const socket = robotSockets.find((s) => s.id === outcome.socketId)!;
    placedRef.current = { ...placedRef.current, [part.id]: socket.id };
    offsets.current.push(outcome.offset);
    setPlaced(placedRef.current);
    movePart(part.id, socket.at, true);
    audio.play("snapIn");
    burst(socket.at, { count: 6, spread: 40, shape: "spark" });

    if (Object.keys(placedRef.current).length < robotParts.length || finished.current) return;

    finished.current = true;
    timers.current.push(window.setTimeout(() => audio.play("boxClose"), 120));
    burst(ROBOT_TORSO, { count: 12, spread: 110, shape: "spark" });
    onComplete({
      quality: calculateAssemblerQuality({ offsets: offsets.current, wrongDrops: wrongDrops.current }),
      durationMs: performance.now() - startedAt.current,
      metadata: { wrongDrops: wrongDrops.current },
    });
  };

  const allPlaced = Object.keys(placed).length >= robotParts.length;

  useTraceDrag(surfaceRef, {
    enabled: active && !allPlaced,
    canStart: (point) => partAt(point, Object.keys(placedRef.current)) !== null,
    onStart: (session) => {
      const part = session.start ? partAt(session.start, Object.keys(placedRef.current)) : null;
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
  const heldKind = robotParts.find((part) => part.id === heldId)?.kind ?? null;

  const renderPart = (part: (typeof robotParts)[number]) => {
    const socket = robotSockets.find((s) => s.id === placed[part.id]);
    return (
      <g
        key={part.id}
        ref={(element) => {
          partRefs.current[part.id] = element;
        }}
        style={{ transform: translate(socket ? socket.at : part.tray), pointerEvents: "none" }}
      >
        <g className={!socket && heldId === null && active ? "sf-pulse" : undefined}>
          <RobotPartShape kind={part.kind} color={color} />
        </g>
      </g>
    );
  };

  // Placed limbs sit behind the torso; loose parts, the head and whatever is in hand stay in front.
  const behindTorso = robotParts.filter((part) => placed[part.id] && part.kind !== "head" && part.id !== heldId);
  const inFront = robotParts
    .filter((part) => !behindTorso.includes(part))
    .sort((a, b) => Number(a.id === heldId) - Number(b.id === heldId) || DRAW_ORDER.indexOf(a.kind) - DRAW_ORDER.indexOf(b.kind));

  return (
    <svg
      ref={surfaceRef}
      viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}
      className="sf-machine-surface h-full w-full"
      role="img"
      aria-label={`Assembler. Drag the head, arms and legs onto the matching outlines around the robot's body. ${filledSockets.length} of ${robotParts.length} parts in place.`}
    >
      {/* Assembly stand, with a parts tray on each side */}
      <rect x="18" y="20" width="76" height="262" rx="18" fill="var(--fx-machine-dark)" opacity="0.55" />
      <rect x="306" y="6" width="76" height="278" rx="18" fill="var(--fx-machine-dark)" opacity="0.55" />
      <rect x="120" y="230" width="160" height="16" rx="8" fill="var(--fx-machine-dark)" />
      <rect x="112" y="240" width="176" height="22" rx="10" fill="var(--fx-machine)" />
      <rect x="112" y="240" width="176" height="8" rx="4" fill="var(--fx-machine-light)" opacity="0.4" />

      {/* A small pop when the last part goes on */}
      <motion.g
        initial={false}
        animate={allPlaced ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        {/* Empty sockets, each the outline of the part it takes */}
        {robotSockets
          .filter((socket) => !filledSockets.includes(socket.id))
          .map((socket) => (
            <g key={socket.id} transform={`translate(${socket.at.x} ${socket.at.y})`} style={{ pointerEvents: "none" }}>
              <RobotSocketOutline kind={socket.kind} active={heldKind === socket.kind} />
            </g>
          ))}

        {behindTorso.map(renderPart)}
        <g transform={`translate(${ROBOT_TORSO.x} ${ROBOT_TORSO.y})`} style={{ pointerEvents: "none" }}>
          <RobotTorso color={color} />
        </g>
        {inFront.map(renderPart)}
      </motion.g>
    </svg>
  );
}
