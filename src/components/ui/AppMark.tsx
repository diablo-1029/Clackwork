import { useId } from "react";

/** The game's own icon (the same art as src/app/icon.svg), for use beside the name. */
export function AppMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#138fe8" />
          <stop offset="1" stopColor="#0b2a63" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd966" />
          <stop offset="1" stopColor="#ff9f0a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id}-bg)`} />
      <rect x="13" y="27" width="38" height="24" rx="6" fill="#0b2a63" opacity=".55" />
      <rect x="13" y="24" width="38" height="24" rx="6" fill={`url(#${id}-gold)`} />
      <rect x="16" y="27" width="32" height="8" rx="4" fill="#fff" opacity=".45" />
      <path d="M32 12v40" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray="4 5" />
      <circle cx="32" cy="13" r="6" fill="#fff" stroke="#63d5ff" strokeWidth="3" />
    </svg>
  );
}
