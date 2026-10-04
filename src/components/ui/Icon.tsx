import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "coin"
  | "soundOn"
  | "soundOff"
  | "sun"
  | "moon"
  | "settings"
  | "back"
  | "upgrades"
  | "lock"
  | "xp"
  | "streak"
  | "theme"
  | "product"
  | "factory"
  | "check"
  | "arrowRight"
  | "sparkle"
  | "reroll"
  | "goal"
  | "cutter"
  | "stamper"
  | "polisher"
  | "packager"
  | "paintBooth"
  | "assembler"
  | "sorter";

/** One visual family: 24px grid, rounded 2px strokes, currentColor. */
const paths: Record<IconName, ReactNode> = {
  coin: (
    <>
      <circle cx="12" cy="12" r="9" fill="var(--sf-gold-400)" stroke="var(--sf-orange-500)" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="var(--sf-orange-500)" strokeWidth="1.6" />
    </>
  ),
  soundOn: (
    <>
      <path d="M4 10v4h3l5 4V6L7 10H4Z" fill="currentColor" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  soundOff: (
    <>
      <path d="M4 10v4h3l5 4V6L7 10H4Z" fill="currentColor" />
      <path d="m16 9.5 5 5m0-5-5 5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  upgrades: (
    <>
      <path d="M12 19V6m0 0-5 5m5-5 5 5" />
      <path d="M5 21h14" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="3" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  xp: <path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9l-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8L12 3Z" />,
  streak: <path d="M12 3c1 3.5 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 1.5-4.5C10 10 11 8 12 3Z" />,
  theme: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-.5-1.5-.5-2.5 1-1.5 2-1.500H18a3 3 0 0 0 3-3c0-5-4-9-9-9Z" />
      <circle cx="8" cy="11" r="1" fill="currentColor" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" />
      <circle cx="16" cy="10" r="1" fill="currentColor" />
    </>
  ),
  product: (
    <>
      <path d="m12 3 8 4.500v9L12 21l-8-4.500v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.500M12 12v9" />
    </>
  ),
  factory: (
    <>
      <path d="M3 21V10l6 4v-4l6 4V5h6v16H3Z" />
      <path d="M8 17.500h2m4 0h2" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.500L19 7.5" />,
  arrowRight: <path d="M5 12h14m0 0-5-5m5 5-5 5" />,
  sparkle: <path d="M12 3l1.8 5.700L19.5 10.500l-5.7 1.800L12 18l-1.8-5.700L4.5 10.500l5.7-1.800L12 3Z" />,
  reroll: <path d="M4 11a8 8 0 0 1 14-4.500L20 8.500M20 4v4.500h-4.500M20 13a8 8 0 0 1-14 4.500L4 15.500M4 20v-4.500h4.500" />,
  goal: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  cutter: (
    <>
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
    </>
  ),
  stamper: (
    <>
      <path d="M12 3v7M7 10h10v4H7zM5 20h14" />
      <path d="M9 17h6" />
    </>
  ),
  polisher: (
    <>
      <circle cx="11" cy="13" r="6" />
      <path d="M11 10v6m-3-3h6M18 3l.800 2.200L21 6l-2.2.800L18 9l-.800-2.200L15 6l2.2-.800L18 3Z" />
    </>
  ),
  packager: (
    <>
      <rect x="4" y="7" width="16" height="13" rx="2" />
      <path d="M4 12h16M10 4h4v8h-4z" />
    </>
  ),
  paintBooth: (
    <>
      <rect x="4" y="5" width="12" height="6" rx="2" />
      <path d="M16 8h3v5h-7v3m0 0v4" />
    </>
  ),
  assembler: (
    <>
      <path d="M4 9h5V7a2 2 0 1 1 4 0v2h5v5h-2a2 2 0 1 0 0 4h2v2H4V9Z" />
    </>
  ),
  sorter: <path d="M12 21v-8m0 0L6 7m6 6 6-6M6 7V3m0 4H2m16 0V3m0 4h4" />,
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 22, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
