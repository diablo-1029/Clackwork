"use client";

import { useEffect } from "react";
import { Chip, Meter, Tile, type Tone } from "@/components/ui/Chunky";
import { Icon, type IconName } from "@/components/ui/Icon";
import { achievementContext, refreshGoals } from "@/game/core/goalActions";
import { achievementTarget, achievements } from "@/game/progression/achievements";
import { describeGoal, goalBonus, type GoalKind } from "@/game/progression/goals";
import { useGoalsStore } from "@/stores/goalsStore";
import { usePlayerStore } from "@/stores/playerStore";
import { ScreenFrame } from "./ScreenFrame";

export const goalArt: Record<GoalKind, { icon: IconName; tone: Tone }> = {
  products: { icon: "product", tone: "blue" },
  perfects: { icon: "sparkle", tone: "gold" },
  twist: { icon: "reroll", tone: "deep" },
  streak: { icon: "streak", tone: "orange" },
  coins: { icon: "coin", tone: "gold" },
  product: { icon: "factory", tone: "green" },
};

function Reward({ coins, done }: { coins: number; done: boolean }) {
  return done ? (
    <Chip tone="green" className="shrink-0 text-success">
      <Icon name="check" size={12} strokeWidth={3} /> +{coins}
    </Chip>
  ) : (
    <Chip tone="gold" className="shrink-0 text-sm">
      <Icon name="coin" size={14} /> {coins}
    </Chip>
  );
}

export function GoalsScreen() {
  const goals = useGoalsStore((s) => s.goals);
  const earned = useGoalsStore((s) => s.achievements);
  // Re-read whenever the stats move, so progress bars are current.
  useGoalsStore((s) => s.stats);
  const level = usePlayerStore((s) => s.factoryLevel);
  usePlayerStore((s) => s.totalPerfects);
  usePlayerStore((s) => s.totalProductsCompleted);
  const context = achievementContext();
  const doneToday = goals.items.filter((goal) => goal.done).length;

  // Opening the screen deals today's goals if the day has changed, and clears the tab's dot.
  useEffect(() => {
    refreshGoals();
    useGoalsStore.getState().clearUnseen();
  }, []);

  return (
    <ScreenFrame
      title="Goals"
      icon="goal"
      intro="Three new goals every day, and achievements that last."
      aside={
        <Chip tone="gold" className="shrink-0 px-2.5 py-1 text-sm" aria-label={`${doneToday} of ${goals.items.length} goals done today`}>
          {doneToday} / {goals.items.length}
        </Chip>
      }
    >
      <h3 className="text-lg font-black">Today</h3>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {goals.items.map((goal, index) => {
          const art = goalArt[goal.kind];
          return (
            <li key={`${goal.kind}-${index}`} className="sf-raised flex items-center gap-3 rounded-3xl p-3">
              <Tile tone={goal.done ? "green" : art.tone} className="size-12 rounded-2xl">
                <Icon name={goal.done ? "check" : art.icon} strokeWidth={goal.done ? 3 : 2} />
              </Tile>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="leading-tight font-black">{describeGoal(goal)}</h4>
                  <Reward coins={goal.reward} done={goal.done} />
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Meter
                    value={goal.progress}
                    max={goal.target}
                    label={describeGoal(goal)}
                    tone={goal.done ? "green" : "blue"}
                    className="h-3.5 flex-1"
                  />
                  <span className="shrink-0 text-xs font-black text-muted tabular-nums">
                    {goal.progress} / {goal.target}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="sf-inset mt-3 flex items-center justify-between gap-2 rounded-2xl px-3 py-2 text-sm font-extrabold">
        <span>{goals.bonusPaid ? "All three done. Come back tomorrow for new goals." : "Finish all three for a bonus"}</span>
        <Reward coins={goalBonus(level)} done={goals.bonusPaid} />
      </p>

      <h3 className="mt-6 flex items-center gap-2 text-lg font-black">
        Achievements
        <span className="text-sm font-extrabold text-muted tabular-nums">
          {earned.length} / {achievements.length}
        </span>
      </h3>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {achievements.map((definition) => {
          const done = earned.includes(definition.id);
          const target = achievementTarget(definition, context);
          const value = Math.min(target, definition.value(context));
          return (
            <li key={definition.id} className="sf-raised flex items-center gap-3 rounded-3xl p-3">
              <Tile tone={done ? "gold" : "neutral"} className="size-12 rounded-2xl">
                <Icon name="xp" fill={done ? "currentColor" : "none"} />
              </Tile>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h4 className={`leading-tight font-black ${done ? "" : "text-muted"}`}>{definition.name}</h4>
                  <Reward coins={definition.reward} done={done} />
                </div>
                <p className="text-xs font-bold text-muted">{definition.description}</p>
                {!done && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Meter value={value} max={target} label={definition.name} className="h-3 flex-1" />
                    <span className="shrink-0 text-xs font-black text-muted tabular-nums">
                      {value} / {target}
                    </span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </ScreenFrame>
  );
}
