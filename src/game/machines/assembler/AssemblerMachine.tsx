"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { audio } from "@/audio/audioManager";
import { ProductBody } from "@/game/products/ProductRenderer";
import { RobotPartShape, RobotSocketOutline } from "@/game/products/RobotParts";
import type { Point } from "@/lib/math";
import { useTraceDrag } from "@/lib/pointer/useTraceDrag";
import { useSettingsStore } from "@/stores/settingsStore";
import { PRODUCT_RECT, STAGE, type MachineProps } from "../shared";
import {
  calculateAssemblerQuality,
  partAt,
  resolveDrop,
  robotParts,
  robotSockets,
  type RobotPartKind,
} from "./assemblerScoring";

const translate = (at: Point) => `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`;

export function AssemblerMachine({
  material,
  isGolden,
  richness,
  look,
  active,
  onInteractionStart,
  onInteractionCancel,
  onComplete,
  burst,
}: MachineProps) {
  /** Which socket each placed part sits in. */
  const [placed, setPlaced] = useState<Record<string, string>>({});
  /** The kind of part in the player's hand, so its sockets can light up. */
  const [heldKind, setHeldKind] = useState<RobotPartKind | null>(null);
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

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  /** Moves a part's element directly; React state only changes when a part is placed. */
  const movePart = (partId: string, at: Point, animate: boolean) => {
    const element = partRefs.current[partId];
    if (!element) return;
    element.style.transition = animate && !reducedMotion ? "transform 180ms cubic-bezier(0.2, 1.4, 0.4, 1)" : "none";
    element.style.transform = translate(at);
  };

  const release = (at: Point | null) => {
    const partId = held.current;
    held.current = null;
    setHeldKind(null);
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
    burst(
      { x: PRODUCT_RECT.x + PRODUCT_RECT.w / 2, y: PRODUCT_RECT.y + PRODUCT_RECT.h / 2 },
      { count: 12, spread: 110, shape: "spark" },
    );
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
      setHeldKind(part.kind);
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

  return (
    <svg
      ref={surfaceRef}
      viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}
      className="sf-machine-surface h-full w-full"
      role="img"
      aria-label={`Assembler. Drag each part onto the matching outline on the robot. ${filledSockets.length} of ${robotParts.length} parts in place.`}
    >
      {/* Workbench and parts tray */}
      <rect x="52" y="38" width="296" height="196" rx="24" fill="var(--fx-machine-dark)" opacity="0.92" />
      <rect x="60" y="46" width="280" height="180" rx="18" fill="var(--fx-machine)" />
      <rect x="60" y="46" width="280" height="60" rx="18" fill="var(--fx-machine-light)" opacity="0.28" />
      <rect x="44" y="232" width="312" height="60" rx="18" fill="var(--fx-machine-dark)" opacity="0.5" />

      {/* A small pop when the last part goes on */}
      <motion.g
        initial={false}
        animate={allPlaced ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        <ProductBody material={material} isGolden={isGolden} richness={richness} look={look} {...PRODUCT_RECT} />
      </motion.g>

      {/* Empty sockets, each the shape of the part it takes */}
      {robotSockets
        .filter((socket) => !filledSockets.includes(socket.id))
        .map((socket) => (
          <g key={socket.id} transform={`translate(${socket.at.x} ${socket.at.y})`} style={{ pointerEvents: "none" }}>
            <g className={heldKind === socket.kind ? "sf-pulse" : undefined}>
              <RobotSocketOutline kind={socket.kind} active={heldKind === socket.kind} />
            </g>
          </g>
        ))}

      {/* Parts: in the tray, in hand, or snapped into a socket */}
      {robotParts.map((part) => {
        const socket = robotSockets.find((s) => s.id === placed[part.id]);
        return (
          <g
            key={part.id}
            ref={(element) => {
              partRefs.current[part.id] = element;
            }}
            style={{ transform: translate(socket ? socket.at : part.tray), pointerEvents: "none" }}
          >
            <g className={!socket && heldKind === null && active ? "sf-pulse" : undefined}>
              <RobotPartShape kind={part.kind} />
            </g>
          </g>
        );
      })}
    </svg>
  );
}
