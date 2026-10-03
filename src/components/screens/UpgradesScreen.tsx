"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { audio } from "@/audio/audioManager";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { upgradeList } from "@/config/upgrades";
import { canPurchaseUpgrade, describeUpgradeEffect } from "@/game/progression/upgradeLogic";
import { usePlayerStore } from "@/stores/playerStore";
import { useProgressionStore } from "@/stores/progressionStore";
import { LockedTag, ScreenFrame } from "./ScreenFrame";

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
    <ScreenFrame title="Upgrades" intro="Spend coins to make every order worth more.">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {upgradeList.map((upgrade) => {
          const current = owned[upgrade.id] ?? 0;
          const check = canPurchaseUpgrade(upgrade.id, current, coins, level);
          const locked = check.reason === "locked";
          const maxed = check.reason === "maxed";

          return (
            <li key={upgrade.id} className={`flex flex-col gap-2 rounded-2xl border border-line p-4 ${locked ? "opacity-75" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-lg leading-tight font-black uppercase">
                  {locked && <Icon name="lock" size={16} className="text-muted" />}
                  {upgrade.name}
                </h3>
                {/* Re-keyed on purchase so the level badge pops. */}
                <motion.span
                  key={current}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  className="shrink-0 rounded-lg bg-surface-2 px-2 py-1 text-xs font-black tabular-nums"
                >
                  Level {current} / {upgrade.maxLevel}
                </motion.span>
              </div>
              <p className="text-sm font-bold text-muted">{upgrade.description}</p>

              {locked ? (
                <div>
                  <LockedTag level={upgrade.unlockLevel} />
                </div>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-surface-2 p-2">
                      <dt className="text-[11px] font-black tracking-wider text-muted uppercase">Now</dt>
                      <dd className="font-extrabold">{describeUpgradeEffect(upgrade.id, current)}</dd>
                    </div>
                    <div className="rounded-xl bg-surface-2 p-2">
                      <dt className="text-[11px] font-black tracking-wider text-muted uppercase">Next</dt>
                      <dd className="font-extrabold">
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
                    <p className="text-center text-xs font-bold text-muted">{check.cost - coins} more coins needed</p>
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
