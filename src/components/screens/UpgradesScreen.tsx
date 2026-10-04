"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { audio } from "@/audio/audioManager";
import { Button } from "@/components/ui/Button";
import { Tile, type Tone } from "@/components/ui/Chunky";
import { Icon, type IconName } from "@/components/ui/Icon";
import { upgradeList } from "@/config/upgrades";
import { canPurchaseUpgrade, describeUpgradeEffect } from "@/game/progression/upgradeLogic";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import type { UpgradeId } from "@/types/game";
import { LockedTag, ScreenFrame } from "./ScreenFrame";

const upgradeArt: Record<UpgradeId, { icon: IconName; tone: Tone }> = {
  betterMaterials: { icon: "product", tone: "blue" },
  goldenTouch: { icon: "sparkle", tone: "gold" },
};

export function UpgradesScreen() {
  const coins = usePlayerStore((s) => s.coins);
  const level = usePlayerStore((s) => s.factoryLevel);
  const owned = useProgressionStore((s) => s.upgrades);
  const purchaseUpgrade = useProgressionStore((s) => s.purchaseUpgrade);
  const setOnboarding = useProgressionStore((s) => s.setOnboarding);

  useEffect(() => {
    setOnboarding("hasSeenUpgradeIntro");
  }, [setOnboarding]);

  return (
    <ScreenFrame title="Upgrades" icon="upgrades" intro="Spend coins to make every order worth more.">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {upgradeList.map((upgrade) => {
          const current = owned[upgrade.id] ?? 0;
          const check = canPurchaseUpgrade(upgrade.id, current, coins, level);
          const locked = check.reason === "locked";
          const maxed = check.reason === "maxed";
          const art = upgradeArt[upgrade.id];

          return (
            <li key={upgrade.id} className="sf-raised flex flex-col gap-3 rounded-3xl p-4">
              <div className="flex items-center gap-3">
                <Tile tone={locked ? "neutral" : art.tone} className="size-14 rounded-2xl">
                  <Icon name={locked ? "lock" : art.icon} size={30} />
                </Tile>
                <div className="min-w-0">
                  <h3 className={`text-lg leading-tight font-black uppercase ${locked ? "text-muted" : ""}`}>{upgrade.name}</h3>
                  <p className="text-sm font-bold text-muted">{upgrade.description}</p>
                </div>
              </div>

              {locked ? (
                <div>
                  <LockedTag level={upgrade.unlockLevel} />
                </div>
              ) : (
                <>
                  {/* One pip per level. Re-keyed on purchase so the row pops. */}
                  <motion.div
                    key={current}
                    initial={{ scale: 1.04 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2"
                    role="img"
                    aria-label={`Level ${current} of ${upgrade.maxLevel}`}
                  >
                    <div className="flex flex-1 gap-1">
                      {Array.from({ length: upgrade.maxLevel }, (_, i) => (
                        <span
                          key={i}
                          className={`h-3.5 flex-1 rounded-full ${i < current ? "sf-tile sf-tone-orange" : "sf-inset"}`}
                        />
                      ))}
                    </div>
                    <span className="shrink-0 text-xs font-black text-muted tabular-nums">
                      {current} / {upgrade.maxLevel}
                    </span>
                  </motion.div>

                  <dl className="sf-inset flex items-center gap-2 rounded-2xl p-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <dt className="text-[11px] font-black tracking-wider text-muted uppercase">Now</dt>
                      <dd className="font-extrabold">{describeUpgradeEffect(upgrade.id, current)}</dd>
                    </div>
                    <Icon name="arrowRight" size={18} className="shrink-0 text-muted" />
                    <div className="min-w-0 flex-1">
                      <dt className="text-[11px] font-black tracking-wider text-muted uppercase">Next</dt>
                      <dd className={`font-extrabold ${maxed ? "" : "text-success"}`}>
                        {maxed ? "Fully upgraded" : describeUpgradeEffect(upgrade.id, current + 1)}
                      </dd>
                    </div>
                  </dl>

                  <Button
                    silent
                    disabled={maxed}
                    aria-disabled={!check.ok}
                    className={`w-full ${check.ok || maxed ? "" : "opacity-60"}`}
                    onClick={() => {
                      const outcome = purchaseUpgrade(upgrade.id);
                      audio.play(outcome.ok ? "purchase" : "deny");
                    }}
                  >
                    {maxed ? (
                      "Max level"
                    ) : (
                      <>
                        Upgrade · <Icon name="coin" size={18} /> {check.cost}
                      </>
                    )}
                  </Button>
                  {check.reason === "coins" && (
                    <p className="-mt-1 text-center text-xs font-bold text-muted">{check.cost - coins} more coins needed</p>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </ScreenFrame>
  );
}
