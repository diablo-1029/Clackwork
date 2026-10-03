import type { ReactNode } from "react";

interface ScreenFrameProps {
  title: string;
  intro?: string;
  /** Keep the content in a readable column instead of spanning a wide window. */
  narrow?: boolean;
  children: ReactNode;
}

/** Shared scrollable layout for the menu screens. */
export function ScreenFrame({ title, intro, narrow, children }: ScreenFrameProps) {
  return (
    <section className="h-full overflow-y-auto rounded-3xl bg-surface p-4 sm:p-6" aria-labelledby="screen-title">
      <div className={narrow ? "mx-auto max-w-3xl" : undefined}>
        <h2 id="screen-title" className="text-2xl font-black tracking-tight">
          {title}
        </h2>
        {intro && <p className="mt-0.5 text-sm font-bold text-muted">{intro}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}

export function LockedTag({ level }: { level: number }) {
  return (
    <span className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-extrabold text-muted">Unlocks at Level {level}</span>
  );
}
