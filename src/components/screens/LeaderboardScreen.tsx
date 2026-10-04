"use client";

import { useEffect, useState } from "react";
import { audio } from "@/audio/audioManager";
import { Button } from "@/components/ui/Button";
import { Chip, Panel, Ribbon } from "@/components/ui/Chunky";
import { NAME_MAX_LENGTH } from "@/game/core/leaderboard";
import {
  fetchTopScores,
  getPlayerName,
  isOnlineBoardConfigured,
  setPlayerName,
  submitScore,
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
      fetchTopScores().then((rows) => {
        if (cancelled) return;
        setEntries(rows);
        setStatus(rows ? "ready" : "error");
      });
    }
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [online]);

  // Saving a name also posts the best score so far, then refreshes the list.
  const saveName = async () => {
    const clean = setPlayerName(name);
    if (!clean) return;
    audio.play("uiClick");
    setName(clean);
    setSavedName(clean);
    if (!online) return;
    setStatus("loading");
    if (best.score > 0) await submitScore({ name: clean, score: best.score, products: best.products });
    const rows = await fetchTopScores();
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
            <Button type="submit" silent variant="secondary" disabled={!name.trim() || name.trim() === savedName}>
              Save
            </Button>
          </form>
          <p className="mt-2 text-xs font-bold text-muted">
            Your name and best score are visible to everyone who plays. Scores post automatically after each shift.
          </p>
        </Panel>
      )}

      <Panel className={`p-4 ${online ? "mt-4" : ""}`}>
        <Ribbon tone="gold">Everyone</Ribbon>
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
          <p className="mt-3 text-sm font-bold text-muted">No scores yet. Play a shift and be the first.</p>
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
