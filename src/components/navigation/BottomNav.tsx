"use client";

import { audio } from "@/audio/audioManager";
import { Icon, type IconName } from "@/components/ui/Icon";
import { upgradeList } from "@/config/upgrades";
import { canPurchaseUpgrade } from "@/game/progression/upgradeLogic";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import { useUiStore, type Screen } from "@/stores/uiStore";

const items: { screen: Screen; label: string; icon: IconName }[] = [
  { screen: "factory", label: "Factory", icon: "factory" },
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

  // A quiet dot on Upgrades whenever something is affordable: a nearby goal.
  const canUpgrade = upgradeList.some((u) => canPurchaseUpgrade(u.id, upgrades[u.id] ?? 0, coins, level).ok);

  return (
    <nav
      aria-label="Main"
      className="flex justify-center gap-1 px-2 pt-1.5 lg:px-6 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      {items.map((item) => {
        const current = item.screen === screen;
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
            className={`relative flex min-h-12 min-w-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[11px] font-extrabold transition-colors sm:max-w-28 sm:text-xs ${
              current ? "bg-brand-deep text-white" : "text-muted hover:bg-surface-2"
            }`}
          >
            <Icon name={item.icon} size={21} />
            {item.label}
            {item.screen === "upgrades" && canUpgrade && !current && (
              <span className="absolute top-1.5 right-[calc(50%-18px)] size-2.5 rounded-full bg-orange ring-2 ring-bg">
                <span className="sr-only">Upgrade available</span>
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
