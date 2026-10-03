import { useId } from "react";
import type { MaterialProfile } from "@/types/game";
import { getMaterialColors, materialProfiles } from "./materialProfiles";

interface ProductBodyProps {
  material: MaterialProfile;
  isGolden?: boolean;
  /** 0–1 cosmetic boost from Better Materials. */
  richness?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
}

/**
 * The product as an SVG group, drawn in whatever coordinate system the caller
 * uses. Soft-3D look: a darker underside, a top-lit gradient and a gloss.
 */
export function ProductBody({ material, isGolden = false, richness = 0, x, y, w, h, r = 14 }: ProductBodyProps) {
  const id = useId().replace(/:/g, "");
  const profile = materialProfiles[material];
  const colors = getMaterialColors(material, isGolden);
  const depth = Math.max(3, h * 0.07);
  const shine = Math.min(1, (isGolden ? 0.85 : profile.shineIntensity) + richness * 0.3);
  const grain = profile.colorTreatment === "grain" && !isGolden;

  return (
    <g>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={colors.light} />
          <stop offset="0.55" stopColor={colors.base} />
          <stop offset="1" stopColor={colors.detail} />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.25 + shine * 0.55} />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <rect x={x} y={y} width={w} height={h} rx={r} />
        </clipPath>
      </defs>

      <rect x={x} y={y + depth} width={w} height={h} rx={r} fill={colors.dark} />
      <rect x={x} y={y} width={w} height={h} rx={r} fill={`url(#${id}-fill)`} />

      <g clipPath={`url(#${id}-clip)`}>
        {grain &&
          [0.2, 0.38, 0.56, 0.74, 0.9].map((t, i) => (
            <path
              key={t}
              d={`M ${x} ${y + h * t} C ${x + w * 0.3} ${y + h * (t + (i % 2 ? 0.06 : -0.05))}, ${x + w * 0.65} ${
                y + h * (t + (i % 2 ? -0.05 : 0.06))
              }, ${x + w} ${y + h * t}`}
              fill="none"
              stroke={colors.dark}
              strokeOpacity={0.28 + richness * 0.15}
              strokeWidth={Math.max(1, h * 0.014)}
            />
          ))}

        <rect x={x + w * 0.05} y={y + h * 0.06} width={w * 0.9} height={h * 0.34} rx={r * 0.7} fill={`url(#${id}-gloss)`} />

        {!grain && (
          <rect
            x={x + w * 0.07}
            y={y + h * 0.1}
            width={w * 0.86}
            height={h * 0.8}
            rx={r * 0.7}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.18 + shine * 0.2}
            strokeWidth={Math.max(1, h * 0.012)}
          />
        )}
      </g>

      {isGolden &&
        [
          [0.16, 0.24, 1],
          [0.82, 0.3, 0.7],
          [0.7, 0.78, 0.85],
        ].map(([px, py, s]) => (
          <path
            key={`${px}-${py}`}
            className="sf-twinkle"
            transform={`translate(${x + w * px} ${y + h * py}) scale(${(h / 130) * s})`}
            d="M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z"
            fill="#ffffff"
          />
        ))}
    </g>
  );
}

/** Small standalone product icon for cards, the order intro and the reward summary. */
export function ProductIcon({
  material,
  isGolden = false,
  size = 56,
  locked = false,
}: {
  material: MaterialProfile;
  isGolden?: boolean;
  size?: number;
  locked?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size * 0.75}
      viewBox="0 0 64 48"
      aria-hidden
      style={locked ? { filter: "grayscale(1)", opacity: 0.45 } : undefined}
    >
      <ProductBody material={material} isGolden={isGolden} x={6} y={5} w={52} h={34} r={7} />
    </svg>
  );
}
