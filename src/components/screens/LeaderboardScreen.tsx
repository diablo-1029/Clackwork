"use client";

import { useEffect, useState } from "react";
import { audio } from "@/audio/audioManager";
import { Button } from "@/components/ui/Button";
import { Chip, Panel, Ribbon } from "@/components/ui/Chunky";
import { NAME_MAX_LENGTH, cleanName, isNameAllowed } from "@/game/core/leaderboard";
import {
  fetchTopScores,
  getPlayerName,
  isOnlineBoardConfigured,
  setPlayerName,
  submitScore,
  type BoardPeriod,
  type OnlineEntry,
} from "@/lib/onlineBoard";
import { useGoalsStore } from "@/stores/goalsStore";
import { ScreenFrame } from "./ScreenFrame";

const rankTone = ["gold", "neutral", "orange"] as const;

function Row({ rank, name, score, products, you }: { rank: number; name: string; score: number; products: number; you?: boolean }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${you ? "sf-chip sf-tone-blue" : "sf-inset"}`}
      aria-current={you ? "true" : undefined}
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-black tabular-nums ${
          rank <= 3 ? `sf-tile sf-tone-${rankTone[rank - 1]}` : "text-muted"
        }`}
      >
        {rank}
      </span>
      <span className="min-w-0 flex-1 truncate font-extrabold">
        {name}
        {you && <span className="ml-1.5 text-xs font-black text-brand-deep">You</span>}
      </span>
      <span className="shrink-0 text-xs font-bold text-muted tabular-nums">{products} made</span>
      <span className="w-16 shrink-0 text-right font-black tabular-nums">{score.toLocaleString("en-US")}</span>
    </li>
  );
}

export function LeaderboardScreen() {
  const history = useGoalsStore((s) => s.stats.shiftHistory);
  const best = useGoalsStore((s) => s.stats.bestShift);
  const online = isOnlineBoardConfigured();

  const [entries, setEntries] = useState<OnlineEntry[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [period, setPeriod] = useState<BoardPeriod>("all");
  const nameRejected = cleanName(name).length > 0 && !isNameAllowed(cleanName(name));

  // Load the saved name and the shared board once the screen is open.
  useEffect(() => {
    let cancelled = false;
    const stored = getPlayerName();
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setName(stored);
      setSavedName(stored);
    }, 0);
    if (online) {
      fetchTopScores(20, undefined, undefined, period).then((rows) => {
        if (cancelled) return;
        setEntries(rows);
        setStatus(rows ? "ready" : "error");
      });
    }
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [online, period]);

  // Saving a name also posts the best score so far, then refreshes the list.
  const saveName = async () => {
    if (nameRejected) return;
    const clean = setPlayerName(name);
    if (!clean) return;
    audio.play("uiClick");
    setName(clean);
    setSavedName(clean);
    if (!online) return;
    setStatus("loading");
    if (best.score > 0) await submitScore({ name: clean, score: best.score, products: best.products });
    const rows = await fetchTopScores(20, undefined, undefined, period);
    setEntries(rows);
    setStatus(rows ? "ready" : "error");
  };

  return (
    <ScreenFrame title="Leaderboard" icon="xp" intro="The best shifts. Beat the clock, then beat your friends." narrow>
      {online && (
        <Panel className="p-4">
          <Ribbon tone="blue">Your name</Ribbon>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void saveName();
            }}
          >
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={NAME_MAX_LENGTH}
              placeholder="Pick a name"
              aria-label="Your name on the leaderboard"
              autoComplete="nickname"
              className="sf-inset min-h-12 min-w-0 flex-1 rounded-2xl border-2 border-line px-3 font-extrabold outline-none focus:border-brand"
            />
            <Button
              type="submit"
              silent
              variant="secondary"
              disabled={!name.trim() || name.trim() === savedName || nameRejected}
            >
              Save
            </Button>
          </form>
          {nameRejected && (
            <p className="mt-2 text-xs font-extrabold text-orange" role="alert">
              That name can&apos;t be used. Please pick another.
            </p>
          )}
          <p className="mt-2 text-xs font-bold text-muted">
            Scores post automatically after each shift. The board stores your name, your best score and a random id
            for this device, and shows the name and score to everyone who plays. Nothing else is collected.
          </p>
        </Panel>
      )}

      <Panel className={`p-4 ${online ? "mt-4" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Ribbon tone="gold">Everyone</Ribbon>
          {online && (
            <div role="radiogroup" aria-label="Period" className="sf-inset flex rounded-2xl p-1">
              {(
                [
                  ["all", "All time"],
                  ["week", "This week"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={period === value}
                  onClick={() => {
                    if (period === value) return;
                    audio.play("uiClick");
                    setStatus("loading");
                    setPeriod(value);
                  }}
                  className={`min-h-10 rounded-xl px-3 text-xs font-extrabold ${
                    period === value ? "sf-tile sf-tone-deep" : "text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {!online ? (
          <p className="mt-3 text-sm font-bold text-muted">
            The shared leaderboard is not switched on in this build. Your own best shifts are below.
          </p>
        ) : status === "loading" ? (
          <p className="mt-3 text-sm font-bold text-muted" aria-busy="true">
            Loading scores…
          </p>
        ) : status === "error" || !entries ? (
          <p className="mt-3 text-sm font-bold text-muted">
            Could not reach the leaderboard. Check your connection and try again.
          </p>
        ) : entries.length === 0 ? (
          <p className="mt-3 text-sm font-bold text-muted">
            {period === "week" ? "No scores this week yet. Play a shift and be the first." : "No scores yet. Play a shift and be the first."}
          </p>
        ) : (
          <ol className="mt-3 flex flex-col gap-1.5">
            {entries.map((entry) => (
              <Row key={`${entry.rank}-${entry.name}`} {...entry} />
            ))}
          </ol>
        )}
      </Panel>

      <Panel className="mt-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <Ribbon tone="deep">Your best shifts</Ribbon>
          {best.score > 0 && <Chip tone="gold">Best {best.score.toLocaleString("en-US")}</Chip>}
        </div>
        {history.length === 0 ? (
          <p className="mt-3 text-sm font-bold text-muted">Finish a shift to start your list.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-1.5">
            {history.map((record, index) => (
              <Row
                key={`${record.at}-${index}`}
                rank={index + 1}
                name={new Date(record.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                score={record.score}
                products={record.products}
              />
            ))}
          </ol>
        )}
      </Panel>
    </ScreenFrame>
  );
}
