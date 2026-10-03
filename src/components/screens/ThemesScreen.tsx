"use client";

import type { CSSProperties } from "react";
import { audio } from "@/audio/audioManager";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { themeList } from "@/config/themes";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { LockedTag, ScreenFrame } from "./ScreenFrame";

export function ThemesScreen() {
  const coins = usePlayerStore((s) => s.coins);
  const level = usePlayerStore((s) => s.factoryLevel);
  const owned = useProgressionStore((s) => s.themes);
  const purchaseTheme = useProgressionStore((s) => s.purchaseTheme);
  const selected = useSettingsStore((s) => s.selectedFactoryTheme);
  const setFactoryTheme = useSettingsStore((s) => s.setFactoryTheme);

  return (
    <ScreenFrame title="Themes" intro="Restyle the factory floor. Menus follow your light or dark setting instead.">
      <ul className="grid gap-3 sm:grid-cols-2">
        {themeList.map((theme) => {
          const isOwned = owned.includes(theme.id);
          const isSelected = selected === theme.id;
          const locked = !isOwned && level < theme.unlockLevel;

          return (
            <li
              key={theme.id}
              className={`flex flex-col gap-2 rounded-2xl border p-3 ${isSelected ? "border-brand ring-2 ring-brand" : "border-line"}`}
            >
              {/* Preview drawn with the theme's own variables. */}
              <div
                className="sf-stage relative flex h-24 items-center justify-center overflow-hidden rounded-xl"
                style={theme.vars as CSSProperties}
                aria-hidden
              >
                <div className="sf-belt absolute inset-x-0 bottom-0 h-2" />
                <div className="flex h-14 w-24 items-center justify-center rounded-xl" style={{ background: "var(--fx-machine)" }}>
                  <div className="h-7 w-12 rounded-md" style={{ background: "var(--fx-accent)" }} />
                </div>
                <div className="absolute top-3 right-4 size-3 rounded-full" style={{ background: "var(--fx-accent-2)" }} />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 font-black">
                    {locked && <Icon name="lock" size={15} className="text-muted" />}
                    {theme.name}
                  </h3>
                  <p className="text-xs font-bold text-muted">{theme.description}</p>
                </div>

                {isSelected ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-lg bg-success/15 px-2 py-1 text-xs font-extrabold text-success">
                    <Icon name="check" size={14} strokeWidth={3} /> Selected
                  </span>
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
