import { useId } from "react";
import { PRODUCT_RECT } from "@/game/machines/shared";
import type { MaterialProfile } from "@/types/game";
import { getMaterialColors, materialProfiles } from "./materialProfiles";
import type { ProductLook, StampMark } from "./productLook";
import { RobotFace } from "./RobotParts";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ProductBodyProps extends Rect {
  material: MaterialProfile;
  isGolden?: boolean;
  /** 0–1 cosmetic boost from Better Materials. */
  richness?: number;
  r?: number;
  /** Marks left by earlier machines (cut seams, imprint, polish). */
  look?: ProductLook;
}

/** Size of the imprint relative to the Stamper slab it was designed on (160 × 78). */
const imprintScale = (rect: Rect) => Math.min(rect.w / 160, rect.h / 78);

/** The stamped logo, drawn the same way wherever the product appears. */
export function ProductImprint({ rect, mark, color }: { rect: Rect; mark: StampMark; color: string }) {
  return (
    <g
      transform={`translate(${rect.x + rect.w / 2 + mark.shift * rect.w} ${rect.y + rect.h / 2}) scale(${imprintScale(rect)})`}
      opacity={mark.strength}
    >
      <circle r="24" fill="none" stroke={color} strokeWidth="3.5" />
      <circle r="24" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.5" transform="translate(0 1.6)" />
      <path d="M0 -14 L4.1 -4.6 L14 -4.3 L6.2 2.2 L8.7 12 L0 6.4 L-8.7 12 L-6.2 2.2 L-14 -4.3 L-4.1 -4.6 Z" fill={color} />
    </g>
  );
}

/**
 * The product as an SVG group, drawn in whatever coordinate system the caller
 * uses. Soft-3D look: a darker underside, a top-lit gradient and a gloss.
 */
export function ProductBody({ material, isGolden = false, richness = 0, x, y, w, h, r = 14, look }: ProductBodyProps) {
  const id = useId().replace(/:/g, "");
  const profile = materialProfiles[material];
  const colors = getMaterialColors(material, isGolden);
  const depth = Math.max(3, h * 0.07);
  const polish = look?.polished ? 0.35 : 0;
  const shine = Math.min(1, (isGolden ? 0.85 : profile.shineIntensity) + richness * 0.3 + polish);
  const grain = profile.colorTreatment === "grain" && !isGolden;
  const bevel = profile.colorTreatment === "bevel";
  const facet = profile.colorTreatment === "facet";
  // Corners of the outer face and of the flat "table" in the middle of a cut stone.
  const inset = { x: w * 0.2, y: h * 0.24 };
  // A cast bar: a smooth raised top face, set in from softly sloped sides.
  const top = { x: x + w * 0.08, y: y + h * 0.13, w: w * 0.84, h: h * 0.7, r: Math.max(2, r * 0.55) };
  const [ox1, oy1, ox2, oy2] = [x, y, x + w, y + h];
  const [ix1, iy1, ix2, iy2] = [x + inset.x, y + inset.y, x + w - inset.x, y + h - inset.y];
  // Seams are recorded where the Cutter made them; map that space onto this rect.
  const seamTransform = `translate(${x} ${y}) scale(${w / PRODUCT_RECT.w} ${h / PRODUCT_RECT.h}) translate(${-PRODUCT_RECT.x} ${-PRODUCT_RECT.y})`;

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
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.22" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <rect x={x} y={y} width={w} height={h} rx={r} />
        </clipPath>
      </defs>

      <rect x={x} y={y + depth} width={w} height={h} rx={r} fill={colors.dark} />
      <rect x={x} y={y} width={w} height={h} rx={r} fill={`url(#${id}-fill)`} />
      {/* Glaze sits over the body and under the gloss, so a painted product still reads as shaped. */}
      {look?.paint && (
        <>
          <rect x={x} y={y} width={w} height={h} rx={r} fill={look.paint.color} />
          <rect x={x} y={y} width={w} height={h} rx={r} fill={`url(#${id}-shade)`} />
        </>
      )}

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

        {facet && (
          <g>
            <polygon points={`${ox1},${oy1} ${ox2},${oy1} ${ix2},${iy1} ${ix1},${iy1}`} fill="#ffffff" fillOpacity="0.3" />
            <polygon points={`${ox1},${oy1} ${ix1},${iy1} ${ix1},${iy2} ${ox1},${oy2}`} fill="#ffffff" fillOpacity="0.12" />
            <polygon points={`${ox2},${oy1} ${ox2},${oy2} ${ix2},${iy2} ${ix2},${iy1}`} fill="#000000" fillOpacity="0.07" />
            <polygon points={`${ox1},${oy2} ${ix1},${iy2} ${ix2},${iy2} ${ox2},${oy2}`} fill="#000000" fillOpacity="0.14" />
            <path
              d={`M ${ix1} ${iy1} H ${ix2} V ${iy2} H ${ix1} Z M ${ox1} ${oy1} L ${ix1} ${iy1} M ${ox2} ${oy1} L ${ix2} ${iy1} M ${ox2} ${oy2} L ${ix2} ${iy2} M ${ox1} ${oy2} L ${ix1} ${iy2}`}
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.6"
              strokeWidth={Math.max(1, h * 0.012)}
              strokeLinejoin="round"
            />
          </g>
        )}

        {bevel && (
          <g>
            {/* Sloped sides: lit from above, in shadow below. No hard edges, unlike a cut stone. */}
            <rect x={x} y={y} width={w} height={h * 0.5} fill="#ffffff" fillOpacity="0.12" />
            <rect x={x} y={y + h * 0.78} width={w} height={h * 0.22} fill="#000000" fillOpacity="0.16" />
            <rect x={top.x} y={top.y + top.h * 0.04} width={top.w} height={top.h} rx={top.r} fill="#000000" fillOpacity="0.14" />
            <rect x={top.x} y={top.y} width={top.w} height={top.h} rx={top.r} fill={`url(#${id}-fill)`} />
            <rect x={top.x} y={top.y} width={top.w} height={top.h * 0.5} rx={top.r} fill={`url(#${id}-gloss)`} />
            <rect
              x={top.x}
              y={top.y}
              width={top.w}
              height={top.h}
              rx={top.r}
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.4"
              strokeWidth={Math.max(1, h * 0.01)}
            />
          </g>
        )}

        {!grain && !facet && !bevel && (
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

        {look?.cuts.map((cut, index) => (
          <g key={index} transform={seamTransform}>
            <line x1={cut.from.x} y1={cut.from.y} x2={cut.to.x} y2={cut.to.y} stroke={colors.dark} strokeWidth="3" vectorEffect="non-scaling-stroke" />
            <line
              x1={cut.from.x}
              y1={cut.from.y}
              x2={cut.to.x}
              y2={cut.to.y}
              stroke="#ffffff"
              strokeOpacity="0.45"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              transform="translate(1.4 1.4)"
            />
          </g>
        ))}

        {look?.stamp && <ProductImprint rect={{ x, y, w, h }} mark={look.stamp} color={colors.dark} />}
      </g>

      {/* Assembled parts sit on top of everything, and the antenna reaches past the top edge. */}
      {look?.assembled && <RobotFace x={x} y={y} w={w} h={h} />}

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
  look,
}: {
  material: MaterialProfile;
  isGolden?: boolean;
  size?: number;
  locked?: boolean;
  /** Usually `finishedLook(product)`, so the icon shows the product as it leaves the factory. */
  look?: ProductLook;
}) {
  // Leave headroom for anything that sticks out above the body.
  const body = look?.assembled ? { y: 12, h: 30 } : { y: 5, h: 34 };
  return (
    <svg
      width={size}
      height={size * 0.75}
      viewBox="0 0 64 48"
      aria-hidden
      style={locked ? { filter: "grayscale(1)", opacity: 0.45 } : undefined}
    >
      <ProductBody material={material} isGolden={isGolden} look={look} x={6} y={body.y} w={52} h={body.h} r={7} />
    </svg>
  );
}
