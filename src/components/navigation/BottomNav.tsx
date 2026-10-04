"use client";

import { audio } from "@/audio/audioManager";
import { Icon, type IconName } from "@/components/ui/Icon";
import { upgradeList } from "@/config/upgrades";
import { isFeatureUnlocked } from "@/game/progression/unlocks";
import { canPurchaseUpgrade } from "@/game/progression/upgradeLogic";
import { useGoalsStore } from "@/stores/goalsStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import { useUiStore, type Screen } from "@/stores/uiStore";

const items: { screen: Screen; label: string; icon: IconName }[] = [
  { screen: "factory", label: "Factory", icon: "factory" },
  { screen: "goals", label: "Goals", icon: "goal" },
  { screen: "products", label: "Products", icon: "product" },
  { screen: "upgrades", label: "Upgrades", icon: "upgrades" },
  { screen: "themes", label: "Themes", icon: "theme" },
  { screen: "settings", label: "Settings", icon: "settings" },
];

export function BottomNav() {
  const screen = useUiStore((s) => s.screen);
  const setScreen = useUiStore((s) => s.setScreen);
  const coins = usePlayerStore((s) => s.coins);
  const level = usePlayerStore((s) => s.factoryLevel);
  const upgrades = useProgressionStore((s) => s.upgrades);

  const goalsUnlocked = isFeatureUnlocked("goals", level);
  const goalNews = useGoalsStore((s) => s.unseen) > 0;

  // A quiet dot on Upgrades whenever something is affordable: a nearby goal.
  const canUpgrade = upgradeList.some((u) => canPurchaseUpgrade(u.id, upgrades[u.id] ?? 0, coins, level).ok);

  return (
    <nav
      aria-label="Main"
      className="flex shrink-0 justify-center px-2 pt-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] lg:block lg:py-0 lg:pr-0 lg:pb-5 lg:pl-6"
    >
      {/* One dock along the bottom; a rail down the left side on wide screens. */}
      <div className="sf-raised flex w-full max-w-xl gap-1 rounded-3xl p-1.5 lg:w-24 lg:flex-col lg:gap-1.5">
        {items
          // Goals joins the dock once the feature unlocks.
          .filter((item) => item.screen !== "goals" || goalsUnlocked)
          .map((item) => {
            const current = item.screen === screen;
            const dot =
              !current &&
              ((item.screen === "upgrades" && canUpgrade && "Upgrade available") ||
                (item.screen === "goals" && goalNews && "Goal completed"));
            return (
              <button
                key={item.screen}
                type="button"
                aria-current={current ? "page" : undefined}
                onClick={() => {
                  if (current) return;
                  audio.play(item.screen === "factory" ? "uiBack" : "uiClick");
                  setScreen(item.screen);
                }}
                className={`relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[11px] font-extrabold transition-[transform,background-color] sm:text-xs lg:min-h-[4.25rem] lg:flex-none ${
                  current ? "sf-tile sf-tone-deep -translate-y-0.5" : "text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon name={item.icon} size={23} />
                {item.label}
                {dot && (
                  <span className="absolute top-1.5 right-[calc(50%-18px)] size-2.5 rounded-full bg-orange ring-2 ring-surface">
                    <span className="sr-only">{dot}</span>
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </nav>
  );
}
