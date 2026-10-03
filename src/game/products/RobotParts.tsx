import {
  ROBOT_BOUNDS,
  ROBOT_TORSO,
  robotSockets,
  type RobotPartKind,
} from "@/game/machines/assembler/assemblerScoring";

const INK = "#1c2a44";
const STEEL = "#c9d3de";
const GRIPPER = "M -8 37 L -8 31 Q -8 28 -5 28 L 5 28 Q 8 28 8 31 L 8 37";

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

/** The torso the other parts attach to, drawn around 0,0 in stage units. */
export function RobotTorso({ color }: { color: string }) {
  return (
    <g>
      {/* Neck and hip joints peek out from behind the body. */}
      <rect x="-9" y="-48" width="18" height="12" rx="3" fill={STEEL} stroke={INK} strokeWidth="2" />
      <rect x="-30" y="34" width="60" height="10" rx="4" fill={STEEL} stroke={INK} strokeWidth="2" />
      <Panel x={-42} y={-40} w={84} h={78} r={14} color={color} />
      {/* Chest plate with a gauge and three buttons */}
      <rect x="-28" y="-24" width="56" height="34" rx="8" fill="#ffffff" opacity="0.9" stroke={INK} strokeWidth="2" />
      <circle cx="-13" cy="-7" r="9" fill="#ffffff" stroke={INK} strokeWidth="2" />
      <path d="M -13 -7 L -8 -12" stroke="var(--sf-orange-500)" strokeWidth="2.5" strokeLinecap="round" />
      {[-13, -4, 5].map((dotY, i) => (
        <circle key={dotY} cx="14" cy={dotY} r="3.2" fill={["#ef5350", "#ffca28", "#66bb6a"][i]} stroke={INK} strokeWidth="1.2" />
      ))}
      <rect x="-18" y="20" width="36" height="6" rx="3" fill={INK} opacity="0.45" />
    </g>
  );
}

/** One attachable robot part, drawn around 0,0 in stage units. */
export function RobotPartShape({ kind, color }: { kind: RobotPartKind; color: string }) {
  switch (kind) {
    case "head":
      return (
        <g>
          {/* A thin aerial with a small light, and a bolt at each ear */}
          <path d="M 0 -26 L 0 -40" stroke={INK} strokeWidth="5.5" strokeLinecap="round" />
          <path d="M 0 -26 L 0 -40" stroke={STEEL} strokeWidth="2.5" strokeLinecap="round" />
          <circle cy="-43" r="4" fill="var(--sf-orange-500)" stroke={INK} strokeWidth="1.8" />
          <rect x="-42" y="-8" width="8" height="16" rx="3" fill={STEEL} stroke={INK} strokeWidth="2" />
          <rect x="34" y="-8" width="8" height="16" rx="3" fill={STEEL} stroke={INK} strokeWidth="2" />
          <Panel x={-35} y={-26} w={70} h={52} r={14} color={color} />
          {/* Visor with two eyes, and a small grille for a mouth */}
          <rect x="-26" y="-16" width="52" height="22" rx="10" fill={INK} />
          <circle cx="-12" cy="-5" r="6.5" fill="#ffffff" />
          <circle cx="12" cy="-5" r="6.5" fill="#ffffff" />
          <circle cx="-11" cy="-4" r="3" fill={INK} />
          <circle cx="13" cy="-4" r="3" fill={INK} />
          <rect x="-13" y="12" width="26" height="7" rx="3" fill={INK} />
          {[-7, 0, 7].map((barX) => (
            <rect key={barX} x={barX - 1.5} y="13.5" width="3" height="4" rx="1" fill="#ffffff" />
          ))}
        </g>
      );
    case "arm":
      return (
        <g>
          {/* Shoulder joint, upper arm, and a simple gripper */}
          <circle cy="-27" r="9" fill={STEEL} stroke={INK} strokeWidth="2.5" />
          <Panel x={-10} y={-24} w={20} h={46} r={8} color={color} />
          <rect x="-6" y="20" width="12" height="8" rx="2" fill={STEEL} stroke={INK} strokeWidth="2" />
          {/* Drawn twice (dark, then steel) so the gripper reads on light and dark floors alike. */}
          <path d={GRIPPER} fill="none" stroke={INK} strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={GRIPPER} fill="none" stroke={STEEL} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "leg":
      return (
        <g>
          {/* Thigh, knee band and a wide foot */}
          <Panel x={-12} y={-30} w={24} h={46} r={8} color={color} />
          <rect x="-12" y="-9" width="24" height="6" fill={INK} opacity="0.35" />
          <rect x="-18" y="17" width="36" height="5" rx="2" fill={INK} opacity="0.4" />
          <rect x="-18" y="13" width="36" height="16" rx="7" fill={STEEL} stroke={INK} strokeWidth="2.5" />
        </g>
      );
  }
}

/** The empty outline a part snaps into: the part's own silhouette, so shape is the cue. */
export function RobotSocketOutline({ kind, active }: { kind: RobotPartKind; active: boolean }) {
  const style = {
    fill: "#ffffff",
    fillOpacity: active ? 0.4 : 0.16,
    stroke: active ? "var(--fx-accent)" : "var(--fx-ink-soft)",
    strokeWidth: active ? 3.5 : 2,
    strokeDasharray: "6 5",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
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

  return (
    <g
      transform={`translate(${x + w / 2} ${y + h / 2}) ${lieDown ? "rotate(-90) " : ""}scale(${scale}) translate(${-(b.x + b.w / 2)} ${-(b.y + b.h / 2)})`}
    >
      {/* Limbs first so the torso overlaps their joints */}
      {robotSockets
        .filter((socket) => socket.kind !== "head")
        .map((socket) => (
          <g key={socket.id} transform={`translate(${socket.at.x} ${socket.at.y})`}>
            <RobotPartShape kind={socket.kind} color={color} />
          </g>
        ))}
      <g transform={`translate(${ROBOT_TORSO.x} ${ROBOT_TORSO.y})`}>
        <RobotTorso color={color} />
      </g>
      {robotSockets
        .filter((socket) => socket.kind === "head")
        .map((socket) => (
          <g key={socket.id} transform={`translate(${socket.at.x} ${socket.at.y})`}>
            <RobotPartShape kind={socket.kind} color={color} />
          </g>
        ))}
    </g>
  );
}
