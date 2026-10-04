import { describe, expect, it, vi } from "vitest";
import { fetchTopScores, isOnlineBoardConfigured, submitScore } from "@/lib/onlineBoard";
import { addShiftRecord, cleanName, type ShiftRecord } from "./leaderboard";

const record = (score: number, at = "2026-10-04T10:00:00.000Z"): ShiftRecord => ({ score, products: 3, at });

describe("own top shifts", () => {
  it("keeps the best first and only the top ten", () => {
    let list: ShiftRecord[] = [];
    for (let i = 1; i <= 14; i++) list = addShiftRecord(list, record(i * 100));
    expect(list).toHaveLength(10);
    expect(list[0].score).toBe(1400);
    expect(list[9].score).toBe(500);
  });

  it("ignores a shift that scored nothing", () => {
    expect(addShiftRecord([record(100)], record(0))).toEqual([record(100)]);
  });

  it("puts the earlier of two equal scores first", () => {
    const list = addShiftRecord([record(500, "2026-10-05T10:00:00.000Z")], record(500, "2026-10-04T10:00:00.000Z"));
    expect(list.map((r) => r.at)).toEqual(["2026-10-04T10:00:00.000Z", "2026-10-05T10:00:00.000Z"]);
  });
});

describe("names", () => {
  it("trims, single-spaces and caps the length", () => {
    expect(cleanName("  Ryan   Q  ")).toBe("Ryan Q");
    expect(cleanName("x".repeat(40))).toHaveLength(16);
    expect(cleanName("   ")).toBe("");
  });

  it("drops control characters and angle brackets", () => {
    expect(cleanName("a\u0000b<script>")).toBe("abscript");
  });
});

describe("shared board client", () => {
  const config = { url: "https://example.supabase.co", key: "public-key" };

  it("is off without both settings", () => {
    expect(isOnlineBoardConfigured({ url: "", key: "" })).toBe(false);
    expect(isOnlineBoardConfigured({ url: "https://example.supabase.co", key: "" })).toBe(false);
    expect(isOnlineBoardConfigured(config)).toBe(true);
  });

  it("does not call out when it is off", async () => {
    const fetcher = vi.fn();
    expect(await submitScore({ name: "Ryan", score: 100, products: 1 }, { url: "", key: "" }, fetcher)).toBe(false);
    expect(await fetchTopScores(20, { url: "", key: "" }, fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("posts a cleaned name and whole numbers to the submit function", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    expect(await submitScore({ name: "  Ryan  ", score: 1234.9, products: 5 }, config, fetcher)).toBe(true);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/submit_score");
    expect(init.headers.apikey).toBe("public-key");
    expect(JSON.parse(init.body)).toMatchObject({ p_name: "Ryan", p_score: 1234, p_products: 5 });
  });

  it("refuses an empty name or a zero score without calling out", async () => {
    const fetcher = vi.fn();
    expect(await submitScore({ name: "  ", score: 100, products: 1 }, config, fetcher)).toBe(false);
    expect(await submitScore({ name: "Ryan", score: 0, products: 0 }, config, fetcher)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reads the top scores and marks the player's own row", async () => {
    const rows = [
      { rank: 1, name: "Ana", score: 9000, products: 14, you: false },
      { rank: 2, name: "Ryan", score: 6752, products: 12, you: true },
    ];
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => rows });
    expect(await fetchTopScores(20, config, fetcher)).toEqual(rows);
  });

  it("returns null or false when the board cannot be reached", async () => {
    const down = vi.fn().mockRejectedValue(new Error("offline"));
    const refused = vi.fn().mockResolvedValue({ ok: false });
    expect(await fetchTopScores(20, config, down)).toBeNull();
    expect(await submitScore({ name: "Ryan", score: 100, products: 1 }, config, refused)).toBe(false);
  });
});
