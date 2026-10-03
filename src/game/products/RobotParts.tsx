import { robotSockets, type RobotPartKind } from "@/game/machines/assembler/assemblerScoring";
import { PRODUCT_RECT } from "@/game/machines/shared";

const INK = "#1c2a44";

/** One robot part, drawn around 0,0 in stage units. */
export function RobotPartShape({ kind }: { kind: RobotPartKind }) {
  switch (kind) {
    case "eye":
      return (
        <g>
          <circle r="16" fill={INK} transform="translate(0 2)" opacity="0.35" />
          <circle r="16" fill="#ffffff" stroke={INK} strokeWidth="3" />
          <circle r="8" fill={INK} />
          <circle cx="-3" cy="-3" r="2.6" fill="#ffffff" />
        </g>
      );
    case "mouth":
      return (
        <g>
          <rect x="-34" y="-9" width="68" height="22" rx="8" fill={INK} opacity="0.35" />
          <rect x="-34" y="-11" width="68" height="22" rx="8" fill={INK} />
          {[-21, -7, 7, 21].map((barX) => (
            <rect key={barX} x={barX - 4} y="-6" width="8" height="12" rx="2.5" fill="#ffffff" />
          ))}
        </g>
      );
    case "antenna":
      return (
        <g>
          <rect x="-3.5" y="-8" width="7" height="20" rx="3" fill="#c9d3de" stroke={INK} strokeWidth="2" />
          <rect x="-13" y="9" width="26" height="8" rx="4" fill={INK} />
          <circle cy="-13" r="8" fill="var(--sf-orange-500)" stroke={INK} strokeWidth="2.5" />
          <circle cx="-2.5" cy="-15.5" r="2" fill="#ffffff" opacity="0.9" />
        </g>
      );
  }
}

/** The empty outline a part snaps into: same silhouette as the part, so shape is the cue. */
export function RobotSocketOutline({ kind, active }: { kind: RobotPartKind; active: boolean }) {
  const stroke = {
    fill: "#ffffff",
    fillOpacity: active ? 0.3 : 0.12,
    stroke: active ? "var(--fx-accent)" : "#ffffff",
    strokeWidth: active ? 3.5 : 2,
    strokeDasharray: "6 5",
    strokeLinecap: "round" as const,
  };
  switch (kind) {
    case "eye":
      return <circle r="16" {...stroke} />;
    case "mouth":
      return <rect x="-34" y="-11" width="68" height="22" rx="8" {...stroke} />;
    case "antenna":
      return <path d="M -13 17 L -13 9 L -3.5 9 L -3.5 -6 A 8 8 0 1 1 3.5 -6 L 3.5 9 L 13 9 L 13 17 Z" {...stroke} />;
  }
}

/** The finished face: every part in its socket, mapped onto wherever the product is drawn. */
export function RobotFace({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${w / PRODUCT_RECT.w} ${h / PRODUCT_RECT.h}) translate(${-PRODUCT_RECT.x} ${-PRODUCT_RECT.y})`}>
      {robotSockets.map((socket) => (
        <g key={socket.id} transform={`translate(${socket.at.x} ${socket.at.y})`}>
          <RobotPartShape kind={socket.kind} />
        </g>
      ))}
    </g>
  );
}
