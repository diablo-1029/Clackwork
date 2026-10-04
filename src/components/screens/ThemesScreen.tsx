"use client";

import type { CSSProperties } from "react";
import { audio } from "@/audio/audioManager";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chunky";
import { Icon } from "@/components/ui/Icon";
import { themeList } from "@/config/themes";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ThemeDefinition } from "@/types/game";
import { LockedTag, ScreenFrame } from "./ScreenFrame";

/** A miniature factory floor drawn with the theme's own variables. */
function ThemePreview({ theme }: { theme: ThemeDefinition }) {
  const trim = "color-mix(in srgb, var(--fx-machine) 30%, var(--fx-stage-b))";
  return (
    <div className="sf-stage relative h-28 overflow-hidden rounded-2xl" style={theme.vars as CSSProperties} aria-hidden>
      <div className="absolute inset-x-0 top-2 h-1.5" style={{ background: trim }} />
      {["left-4", "right-4"].map((side) => (
        <div
          key={side}
          className={`absolute top-6 h-10 w-8 rounded-t-full rounded-b-sm border-[3px] ${side}`}
          style={{
            borderColor: trim,
            background: "color-mix(in srgb, var(--fx-accent-2) 40%, var(--fx-stage-a))",
          }}
        />
      ))}
      <div
        className="absolute inset-x-0 bottom-0 h-7"
        style={{ background: "color-mix(in srgb, var(--fx-machine-dark) 30%, var(--fx-stage-b))" }}
      >
        <div className="sf-belt h-2" />
      </div>
      {/* A press with a product under it, standing on the belt. */}
      <div className="absolute bottom-7 left-1/2 flex h-16 w-24 -translate-x-1/2 flex-col items-center justify-end">
        <div className="h-3 w-full rounded-md" style={{ background: "var(--fx-machine)" }} />
        <div className="flex w-full flex-1 justify-between px-1">
          <div className="w-2.5" style={{ background: "var(--fx-machine-dark)" }} />
          <div className="mt-1 h-3 w-12 rounded-sm" style={{ background: "var(--fx-machine-light)" }} />
          <div className="w-2.5" style={{ background: "var(--fx-machine-dark)" }} />
        </div>
        <div className="absolute bottom-0 h-5 w-11 rounded-md" style={{ background: "var(--fx-accent)" }} />
      </div>
      <div className="absolute top-12 right-16 size-2.5 rounded-full" style={{ background: "var(--fx-particle)" }} />
      <div className="absolute top-9 left-16 size-1.5 rounded-full" style={{ background: "var(--fx-particle)" }} />
    </div>
  );
}

export function ThemesScreen() {
  const coins = usePlayerStore((s) => s.coins);
  const level = usePlayerStore((s) => s.factoryLevel);
  const owned = useProgressionStore((s) => s.themes);
  const purchaseTheme = useProgressionStore((s) => s.purchaseTheme);
  const selected = useSettingsStore((s) => s.selectedFactoryTheme);
  const setFactoryTheme = useSettingsStore((s) => s.setFactoryTheme);

  return (
    <ScreenFrame
      title="Themes"
      icon="theme"
      intro="Restyle the factory floor. Menus follow your light or dark setting instead."
    >
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {themeList.map((theme) => {
          const isOwned = owned.includes(theme.id);
          const isSelected = selected === theme.id;
          const locked = !isOwned && level < theme.unlockLevel;

          return (
            <li
              key={theme.id}
              className={`sf-raised flex flex-col gap-2.5 rounded-3xl p-3 ${isSelected ? "!border-brand" : ""} ${
                locked ? "opacity-80" : ""
              }`}
            >
              <ThemePreview theme={theme} />

              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 font-black">
                    {locked && <Icon name="lock" size={15} className="text-muted" />}
                    {theme.name}
                  </h3>
                  <p className="text-xs font-bold text-muted">{theme.description}</p>
                </div>

                {isSelected ? (
                  <Chip tone="green" className="shrink-0 py-1.5 text-success">
                    <Icon name="check" size={14} strokeWidth={3} /> In use
                  </Chip>
                ) : isOwned ? (
                  <Button variant="secondary" className="shrink-0 px-4" onClick={() => setFactoryTheme(theme.id)}>
                    Use
                  </Button>
                ) : locked ? (
                  <LockedTag level={theme.unlockLevel} />
                ) : (
                  <Button
                    silent
                    className={`shrink-0 px-4 ${coins >= theme.cost ? "" : "opacity-60"}`}
                    aria-disabled={coins < theme.cost}
                    onClick={() => {
                      const outcome = purchaseTheme(theme.id);
                      audio.play(outcome.ok ? "purchase" : "deny");
                      if (outcome.ok) setFactoryTheme(theme.id);
                    }}
                  >
                    <Icon name="coin" size={18} /> {theme.cost}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </ScreenFrame>
  );
}
