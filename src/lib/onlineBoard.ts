import { cleanName, isNameAllowed } from "@/game/core/leaderboard";

/**
 * The shared leaderboard, kept in a hosted Supabase database (see
 * docs/leaderboard-setup.md). The game talks to two database functions over
 * plain HTTPS; there is no SDK and no server of our own. Without the two
 * settings below the shared board is simply switched off.
 */
const URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const PLAYER_ID_KEY = "clackwork-player-id";
const PLAYER_NAME_KEY = "clackwork-player-name";

export interface OnlineEntry {
  rank: number;
  name: string;
  score: number;
  products: number;
  /** This row belongs to the player on this device. */
  you: boolean;
}

/** Which board to read: every player's best ever, or their best since Monday. */
export type BoardPeriod = "all" | "week";

export interface BoardConfig {
  url: string;
  key: string;
}

export const boardConfig: BoardConfig = { url: URL, key: KEY };

export function isOnlineBoardConfigured(config: BoardConfig = boardConfig): boolean {
  return /^https:\/\//.test(config.url) && config.key.length > 0;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** A random id for this device. It is how the board knows which row is yours; it is never shown. */
export function getPlayerId(): string {
  const store = storage();
  const saved = store?.getItem(PLAYER_ID_KEY);
  if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
          (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16),
        );
  store?.setItem(PLAYER_ID_KEY, id);
  return id;
}

export function getPlayerName(): string {
  return cleanName(storage()?.getItem(PLAYER_NAME_KEY) ?? "");
}

export function setPlayerName(name: string): string {
  const clean = cleanName(name);
  if (clean) storage()?.setItem(PLAYER_NAME_KEY, clean);
  return clean;
}

type Fetch = typeof fetch;

export const FEEDBACK_MAX_LENGTH = 500;

async function call(
  fn: string,
  body: Record<string, unknown>,
  config: BoardConfig,
  fetcher: Fetch,
): Promise<Response | null> {
  if (!isOnlineBoardConfigured(config)) return null;
  try {
    const response = await fetcher(`${config.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.key, Authorization: `Bearer ${config.key}` },
      body: JSON.stringify(body),
    });
    return response.ok ? response : null;
  } catch {
    // Offline or blocked: the game carries on without the shared board.
    return null;
  }
}

/** Posts a score. The database keeps only each player's best. Resolves false if it could not be posted. */
export async function submitScore(
  entry: { name: string; score: number; products: number },
  config: BoardConfig = boardConfig,
  fetcher: Fetch = fetch,
): Promise<boolean> {
  const name = cleanName(entry.name);
  if (!name || !isNameAllowed(name) || !(entry.score > 0)) return false;
  const response = await call(
    "submit_score",
    { p_player: getPlayerId(), p_name: name, p_score: Math.floor(entry.score), p_products: Math.floor(entry.products) },
    config,
    fetcher,
  );
  return response !== null;
}

/**
 * The top of the shared board, followed by the player's own row if it is further down.
 * Null if the board could not be reached.
 */
export async function fetchTopScores(
  limit = 20,
  config: BoardConfig = boardConfig,
  fetcher: Fetch = fetch,
  period: BoardPeriod = "all",
): Promise<OnlineEntry[] | null> {
  const player = getPlayerId();
  let response = await call("top_scores", { p_player: player, p_limit: limit, p_period: period }, config, fetcher);
  // A database that has not had the second setup script run only knows the all-time board.
  if (!response && period === "all") {
    response = await call("top_scores", { p_player: player, p_limit: limit }, config, fetcher);
  }
  if (!response) return null;
  try {
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return null;
    return rows.map((row) => ({
      rank: Number(row.rank) || 0,
      name: cleanName(String(row.name ?? "")) || "Player",
      score: Number(row.score) || 0,
      products: Number(row.products) || 0,
      you: Boolean(row.you),
    }));
  } catch {
    return null;
  }
}

/**
 * Sends a note from the Settings feedback form to the same database (docs/leaderboard-setup.md, step 4).
 * Resolves false if it could not be sent, including when the database refuses it for arriving too often.
 */
export async function sendFeedback(
  entry: { message: string; version: string; level: number },
  config: BoardConfig = boardConfig,
  fetcher: Fetch = fetch,
): Promise<boolean> {
  const message = entry.message
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, FEEDBACK_MAX_LENGTH);
  if (!message) return false;
  const response = await call(
    "send_feedback",
    { p_player: getPlayerId(), p_message: message, p_version: entry.version.slice(0, 20), p_level: Math.floor(entry.level) },
    config,
    fetcher,
  );
  return response !== null;
}
