import type { ReactNode } from "react";

/** Shared scrollable layout for the menu screens. */
export function ScreenFrame({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="h-full overflow-y-auto rounded-3xl bg-surface p-4 sm:p-6" aria-labelledby="screen-title">
      <h2 id="screen-title" className="text-2xl font-black tracking-tight">
        {title}
      </h2>
      {intro && <p className="mt-0.5 text-sm font-bold text-muted">{intro}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function LockedTag({ level }: { level: number }) {
  return (
    <span className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-extrabold text-muted">Unlocks at Level {level}</span>
  );
}
