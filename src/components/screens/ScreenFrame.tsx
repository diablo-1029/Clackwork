import type { ReactNode } from "react";
import { Chip } from "@/components/ui/Chunky";
import { Icon, type IconName } from "@/components/ui/Icon";

interface ScreenFrameProps {
  title: string;
  icon: IconName;
  intro?: string;
  /** Shown at the right of the header band, e.g. a collection counter. */
  aside?: ReactNode;
  /** Keep the content in a readable column instead of spanning a wide window. */
  narrow?: boolean;
  /** Called when the header icon is tapped. Used by Settings for its hidden tools. */
  onIconTap?: () => void;
  children: ReactNode;
}

/** Shared scrollable layout for the menu screens: a coloured header band over raised cards. */
export function ScreenFrame({ title, icon, intro, aside, narrow, onIconTap, children }: ScreenFrameProps) {
  return (
    <section className="h-full overflow-y-auto rounded-3xl" aria-labelledby="screen-title">
      <div className={`pb-2 ${narrow ? "mx-auto max-w-3xl" : ""}`}>
        <header className="sf-tile sf-tone-deep flex items-center gap-3 rounded-3xl px-3 py-3 sm:px-5">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/20"
            aria-hidden
            onClick={onIconTap}
          >
            <Icon name={icon} size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="screen-title" className="text-2xl leading-tight font-black tracking-tight">
              {title}
            </h2>
            {intro && <p className="text-xs font-bold opacity-85 sm:text-sm">{intro}</p>}
          </div>
          {aside}
        </header>
        <div className="mt-3">{children}</div>
      </div>
    </section>
  );
}

export function LockedTag({ level }: { level: number }) {
  return (
    <Chip className="text-muted">
      <Icon name="lock" size={12} />
      Unlocks at Level {level}
    </Chip>
  );
}
