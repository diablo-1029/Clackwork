import type { HTMLAttributes, ReactNode } from "react";

/** Colour families shared by chips, tiles, meters and ribbons (see `.sf-tone-*` in globals.css). */
export type Tone = "neutral" | "blue" | "deep" | "orange" | "gold" | "green";

interface ToneProps extends HTMLAttributes<HTMLElement> {
  tone?: Tone;
}

/** A panel that stands off the page. */
export function Panel({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`sf-raised rounded-3xl ${className}`} {...props} />;
}

/** A small tinted label for a value: coins, streak, a tag. */
export function Chip({ tone = "neutral", className = "", ...props }: ToneProps) {
  return (
    <span
      className={`sf-chip sf-tone-${tone} inline-flex items-center gap-1 rounded-xl px-2 py-0.5 text-xs font-black ${className}`}
      {...props}
    />
  );
}

/** A solid coloured square, usually holding an icon. */
export function Tile({ tone = "deep", className = "", ...props }: ToneProps) {
  return (
    <span className={`sf-tile sf-tone-${tone} flex shrink-0 items-center justify-center rounded-xl ${className}`} {...props} />
  );
}

/** A banner heading. */
export function Ribbon({ tone = "deep", className = "", ...props }: ToneProps) {
  return (
    <span
      className={`sf-tile sf-tone-${tone} inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-black tracking-[0.14em] uppercase ${className}`}
      {...props}
    />
  );
}

interface MeterProps {
  value: number;
  max: number;
  label: string;
  tone?: Tone;
  className?: string;
  children?: ReactNode;
}

/** A chunky progress bar with a glossy fill. */
export function Meter({ value, max, label, tone = "blue", className = "h-4", children }: MeterProps) {
  const progress = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      className={`sf-meter sf-tone-${tone} ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className="sf-meter-fill" style={{ width: `${progress * 100}%` }} />
      {children}
    </div>
  );
}
