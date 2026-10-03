import {
  ROBOT_BOUNDS,
  ROBOT_TORSO,
  finalSockets,
  robotFeatures,
  sitsBehind,
  type RobotPieceKind,
  type RobotShellKind,
} from "@/game/machines/assembler/assemblerScoring";

const INK = "#1c2a44";
const STEEL = "#c9d3de";
const AERIAL_WIRE = "M 0 5 L 0 2 L -3 0.5 L 3 -1.5 L -3 -3.5 L 0 -5 L 0 -8";
const GRIPPER = "M -8 8 L -8 2 Q -8 -1 -5 -1 L 5 -1 Q 8 -1 8 2 L 8 8";

/** A body panel: the robot's colour with a darker underside and a soft top highlight. */
function Panel({ x, y, w, h, r, color }: { x: number; y: number; w: number; h: number; r: number; color: string }) {
  return (
    <g>
      <rect x={x} y={y + 3} width={w} height={h} rx={r} fill={INK} opacity="0.4" />
      <rect x={x} y={y} width={w} height={h} rx={r} fill={color} stroke={INK} strokeWidth="2.5" />
      <rect x={x} y={y + h * 0.55} width={w} height={h * 0.45} rx={r} fill="#000000" opacity="0.14" />
      <rect x={x + 4} y={y + 4} width={w - 8} height={Math.min(10, h * 0.3)} rx={Math.min(5, r)} fill="#ffffff" opacity="0.35" />
    </g>
  );
}

/** A body section with none of its fittings, drawn around 0,0 at scale 1. */
function BareShell({ kind, color }: { kind: RobotShellKind; color: string }) {
  switch (kind) {
    case "head":
      return (
        <g>
          <rect x="-42" y="-8" width="8" height="16" rx="3" fill={STEEL} stroke={INK} strokeWidth="2" />
          <rect x="34" y="-8" width="8" height="16" rx="3" fill={STEEL} stroke={INK} strokeWidth="2" />
          <Panel x={-35} y={-26} w={70} h={52} r={14} color={color} />
          {/* The visor the eyes sit in */}
          <rect x="-26" y="-16" width="52" height="22" rx="10" fill={INK} />
        </g>
      );
    case "arm":
      return <Panel x={-10} y={-24} w={20} h={46} r={8} color={color} />;
    case "leg":
      return <Panel x={-12} y={-30} w={24} h={46} r={8} color={color} />;
    case "torso":
      return (
        <g>
          <Panel x={-42} y={-40} w={84} h={78} r={14} color={color} />
          {/* Chest plate the gauge and buttons mount on */}
          <rect x="-28" y="-24" width="56" height="34" rx="8" fill="#ffffff" opacity="0.9" stroke={INK} strokeWidth="2" />
          <rect x="-18" y="20" width="36" height="6" rx="3" fill={INK} opacity="0.45" />
        </g>
      );
  }
}

/** A body section, bare or with every fitting already on. Drawn around 0,0 at scale 1. */
export function RobotShell({ kind, color, complete = false }: { kind: RobotShellKind; color: string; complete?: boolean }) {
  if (!complete) return <BareShell kind={kind} color={color} />;
  const fittings = robotFeatures[kind].map((feature, index) => (
    <g key={index} transform={`translate(${feature.at.x} ${feature.at.y})`}>
      <RobotPiece kind={feature.kind} color={color} />
    </g>
  ));
  return (
    <g>
      {fittings.filter((_, index) => sitsBehind(robotFeatures[kind][index].kind))}
      <BareShell kind={kind} color={color} />
      {fittings.filter((_, index) => !sitsBehind(robotFeatures[kind][index].kind))}
    </g>
  );
}

/** Anything the player can pick up, drawn around 0,0 at scale 1. */
export function RobotPiece({ kind, color }: { kind: RobotPieceKind; color: string }) {
  switch (kind) {
    case "eye":
      return (
        <g>
          <circle r="6.5" fill="#ffffff" stroke={INK} strokeWidth="1.6" />
          <circle cx="1" cy="1" r="3" fill={INK} />
        </g>
      );
    case "mouth":
      return (
        <g>
          <rect x="-13" y="-3.5" width="26" height="7" rx="3" fill={INK} stroke={STEEL} strokeWidth="1" />
          {[-7, 0, 7].map((barX) => (
            <rect key={barX} x={barX - 1.5} y="-2" width="3" height="4" rx="1" fill="#ffffff" />
          ))}
        </g>
      );
    case "aerial":
      return (
        <g>
          {/* A thin sprung wire on a small mount, with a tiny light: an aerial, not a lever. */}
          <path d={AERIAL_WIRE} fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d={AERIAL_WIRE} fill="none" stroke={STEEL} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="-5" y="5" width="10" height="4" rx="1.5" fill={STEEL} stroke={INK} strokeWidth="1.4" />
          <circle cy="-9.5" r="2.6" fill="var(--sf-orange-500)" stroke={INK} strokeWidth="1.3" />
        </g>
      );
    case "shoulder":
      return <circle r="9" fill={STEEL} stroke={INK} strokeWidth="2.5" />;
    case "gripper":
      return (
        <g>
          <rect x="-6" y="-9" width="12" height="8" rx="2" fill={STEEL} stroke={INK} strokeWidth="2" />
          {/* Drawn twice (dark, then steel) so the claw reads on light and dark floors alike. */}
          <path d={GRIPPER} fill="none" stroke={INK} strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={GRIPPER} fill="none" stroke={STEEL} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "knee":
      return (
        <g>
          <rect x="-14" y="-5" width="28" height="10" rx="4" fill={STEEL} stroke={INK} strokeWidth="2" />
          <circle r="2.2" fill={INK} />
        </g>
      );
    case "foot":
      return (
        <g>
          <rect x="-18" y="-4" width="36" height="5" rx="2" fill={INK} opacity="0.4" />
          <rect x="-18" y="-8" width="36" height="16" rx="7" fill={STEEL} stroke={INK} strokeWidth="2.5" />
        </g>
      );
    case "gauge":
      return (
        <g>
          <circle r="9" fill="#ffffff" stroke={INK} strokeWidth="2" />
          <path d="M 0 0 L 5 -5" stroke="var(--sf-orange-500)" strokeWidth="2.5" strokeLinecap="round" />
          <circle r="1.5" fill={INK} />
        </g>
      );
    case "buttons":
      return (
        <g>
          <rect x="-6" y="-14" width="12" height="28" rx="6" fill={STEEL} stroke={INK} strokeWidth="1.5" />
          {[-9, 0, 9].map((dotY, i) => (
            <circle key={dotY} cy={dotY} r="3.2" fill={["#ef5350", "#ffca28", "#66bb6a"][i]} stroke={INK} strokeWidth="1.2" />
          ))}
        </g>
      );
    case "neck":
      return <rect x="-9" y="-6" width="18" height="12" rx="3" fill={STEEL} stroke={INK} strokeWidth="2" />;
    case "belt":
      return <rect x="-30" y="-5" width="60" height="10" rx="4" fill={STEEL} stroke={INK} strokeWidth="2" />;
    case "head":
    case "arm":
    case "leg":
      return <RobotShell kind={kind} color={color} complete />;
  }
}

/** The empty outline a part snaps into: roughly the part's own silhouette, so shape is the cue. */
export function RobotSocketOutline({ kind, active }: { kind: RobotPieceKind; active: boolean }) {
  const style = {
    fill: "#ffffff",
    fillOpacity: active ? 0.45 : 0.2,
    stroke: active ? "var(--fx-accent)" : "var(--fx-ink-soft)",
    strokeDasharray: "5 4",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    // Outlines are drawn inside a scaled group, so keep their weight constant on screen.
    vectorEffect: "non-scaling-stroke" as const,
    strokeWidth: active ? 3.5 : 2,
  };
  switch (kind) {
    case "eye":
      return <circle r="6.5" {...style} />;
    case "mouth":
      return <rect x="-13" y="-3.5" width="26" height="7" rx="3" {...style} />;
    case "aerial":
      return <rect x="-6" y="-13" width="12" height="23" rx="5" {...style} />;
    case "shoulder":
      return <circle r="9" {...style} />;
    case "gripper":
      return <rect x="-10" y="-9" width="20" height="19" rx="4" {...style} />;
    case "knee":
      return <rect x="-14" y="-5" width="28" height="10" rx="4" {...style} />;
    case "foot":
      return <rect x="-18" y="-8" width="36" height="16" rx="7" {...style} />;
    case "gauge":
      return <circle r="9" {...style} />;
    case "buttons":
      return <rect x="-6" y="-14" width="12" height="28" rx="6" {...style} />;
    case "neck":
      return <rect x="-9" y="-6" width="18" height="12" rx="3" {...style} />;
    case "belt":
      return <rect x="-30" y="-5" width="60" height="10" rx="4" {...style} />;
    case "head":
      return <rect x="-35" y="-26" width="70" height="52" rx="14" {...style} />;
    case "arm":
      return <path d="M -10 -16 Q -10 -36 0 -36 Q 10 -36 10 -16 L 10 37 L -10 37 Z" {...style} />;
    case "leg":
      return <path d="M -12 -30 L 12 -30 L 12 13 L 18 13 L 18 29 L -18 29 L -18 13 L -12 13 Z" {...style} />;
  }
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The finished robot, fitted into `rect`. In a space that is clearly wider
 * than tall (a box, say) it lies down, head to the left, to make use of the room.
 */
export function RobotFigure({ color, x, y, w, h }: Rect & { color: string }) {
  const b = ROBOT_BOUNDS;
  const standing = Math.min(w / b.w, h / b.h);
  const lying = Math.min(w / b.h, h / b.w);
  const lieDown = lying > standing * 1.15;
  const scale = lieDown ? lying : standing;
  const section = (socket: (typeof finalSockets)[number]) => (
    <g key={socket.id} transform={`translate(${socket.at.x} ${socket.at.y})`}>
      <RobotPiece kind={socket.kind} color={color} />
    </g>
  );

  return (
    <g
      transform={`translate(${x + w / 2} ${y + h / 2}) ${lieDown ? "rotate(-90) " : ""}scale(${scale}) translate(${-(b.x + b.w / 2)} ${-(b.y + b.h / 2)})`}
    >
      {/* Limbs first so the torso overlaps their joints; the head goes on last. */}
      {finalSockets.filter((socket) => socket.kind !== "head").map(section)}
      <g transform={`translate(${ROBOT_TORSO.x} ${ROBOT_TORSO.y})`}>
        <RobotShell kind="torso" color={color} complete />
      </g>
      {finalSockets.filter((socket) => socket.kind === "head").map(section)}
    </g>
  );
}
