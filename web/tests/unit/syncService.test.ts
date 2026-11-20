import { describe, it, expect } from "vitest";
import { ChessComClient, type ChessComRawGame } from "../../src/chessComClient";
import { syncGames, quickSyncRecentGames, type SyncProgress } from "../../src/syncService";
import type { GameRecord, SyncStateRecord } from "../../src/db";

function makeRawGame(uuid: string, username: string, endTime: number): ChessComRawGame {
  return {
    uuid,
    url: `https://chess.com/game/${uuid}`,
    pgn: `[Event "Live Chess"]\n[White "${username}"]\n[Black "opponent"]\n[Result "1-0"]\n\n1. e4 e5 1-0`,
    time_control: "180",
    time_class: "blitz",
    rules: "chess",
    rated: true,
    end_time: endTime,
    white: { username, rating: 1500, result: "win" },
    black: { username: "opponent", rating: 1500, result: "resigned" },
  };
}

function createMockDb() {
  const games = new Map<string, GameRecord>();
  const syncStates = new Map<string, SyncStateRecord>();

  const db = {
    transaction: (storeName: string) => {
      const store = {
        get: (key: [string, string]) => {
          const req: any = {};
          queueMicrotask(() => {
            req.result = syncStates.get(`${key[0]}:${key[1]}`);
            req.onsuccess?.();
          });
          return req;
        },
        put: (val: any) => {
          if (storeName === "syncState") {
            syncStates.set(`${val.username}:${val.yearMonth}`, val);
          } else if (storeName === "games") {
            games.set(val.chessComUuid, val);
          }
        },
        getKey: (key: string) => {
          const req: any = {};
          queueMicrotask(() => {
            req.result = games.has(key) ? key : undefined;
            req.onsuccess?.();
          });
          return req;
        },
      };
      const tx: any = {
        objectStore: () => store,
      };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    },
    close: () => {},
  } as unknown as IDBDatabase;

  return { db, games, syncStates };
}

describe("syncService HTTP 429 rate limit resilience", () => {
  it("pauses on 429 rate limit, surfaces visible 'Rate limited — sync will resume in X seconds' indicator, and resumes without dropping games", async () => {
    const USERNAME = "Alice";
    const { db, games, syncStates } = createMockDb();

    // 3 months of archives
    const archiveUrls = [
      "https://api.chess.com/pub/player/Alice/games/2026/01",
      "https://api.chess.com/pub/player/Alice/games/2026/02",
      "https://api.chess.com/pub/player/Alice/games/2026/03",
    ];

    const month1Games = [makeRawGame("game-01-1", USERNAME, 1704100000), makeRawGame("game-01-2", USERNAME, 1704200000)];
    const month2Games = [makeRawGame("game-02-1", USERNAME, 1706800000), makeRawGame("game-02-2", USERNAME, 1706900000)];
    const month3Games = [makeRawGame("game-03-1", USERNAME, 1709300000)];

    let month2Attempts = 0;
    const mockFetch = (async (url: string) => {
      if (url.endsWith("/games/archives")) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ archives: archiveUrls }),
        };
      }
      if (url.endsWith("/2026/01")) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ games: month1Games }),
        };
      }
      if (url.endsWith("/2026/02")) {
        month2Attempts++;
        // Hit rate limits on first 2 attempts of month 2!
        if (month2Attempts <= 2) {
          return {
            ok: false,
            status: 429,
            headers: { get: (h: string) => (h.toLowerCase() === "retry-after" ? "2" : null) },
            json: async () => ({ message: "Rate limit reached" }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ games: month2Games }),
        };
      }
      if (url.endsWith("/2026/03")) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ games: month3Games }),
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as unknown as typeof fetch;

    const sleeps: number[] = [];
    const client = new ChessComClient("test-agent", {
      minIntervalSeconds: 0,
      maxRetries: 5,
      baseDelayMs: 50,
      fetchImpl: mockFetch,
      randomFn: () => 0,
      sleepFn: async (ms) => {
        sleeps.push(ms);
      },
    });

    const progressLogs: SyncProgress[] = [];
    const statusTexts: string[] = [];

    const result = await syncGames(db, client, USERNAME, (progress) => {
      progressLogs.push({ ...progress });
      if (progress.statusText) {
        statusTexts.push(progress.statusText);
      }
    });

    // 1. Verify result totals
    expect(result.monthsProcessed).toBe(3);
    expect(result.gamesAdded).toBe(5);

    // 2. Verify visible 'Rate limited — sync will resume in X seconds' status indicator
    expect(statusTexts.length).toBeGreaterThanOrEqual(1);
    expect(statusTexts.some((txt) => /Rate limited — sync will resume in \d+ seconds/.test(txt))).toBe(true);

    // 3. Verify that the sync state machine resumed and marked all months complete
    expect(syncStates.size).toBe(3);
    expect(syncStates.get("Alice:2026-01")?.status).toBe("complete");
    expect(syncStates.get("Alice:2026-02")?.status).toBe("complete");

    // 4. Verify ZERO dropped games: all 5 games exist in IndexedDB
    expect(games.size).toBe(5);
    expect(games.has("game-01-1")).toBe(true);
    expect(games.has("game-01-2")).toBe(true);
    expect(games.has("game-02-1")).toBe(true);
    expect(games.has("game-02-2")).toBe(true);
    expect(games.has("game-03-1")).toBe(true);
  });

  it("quickSyncRecentGames pauses on rate limits, reports indicator, and catches up without dropping games", async () => {
    const USERNAME = "Bob";
    const { db, games, syncStates } = createMockDb();

    const archiveUrls = [
      "https://api.chess.com/pub/player/Bob/games/2026/01",
      "https://api.chess.com/pub/player/Bob/games/2026/02",
    ];

    const month2Games = [makeRawGame("bob-game-02-1", USERNAME, 1706800000), makeRawGame("bob-game-02-2", USERNAME, 1706900000)];
    let attempts = 0;

    const mockFetch = (async (url: string) => {
      if (url.endsWith("/games/archives")) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ archives: archiveUrls }),
        };
      }
      if (url.endsWith("/2026/02")) {
        attempts++;
        if (attempts === 1) {
          return {
            ok: false,
            status: 429,
            headers: { get: (h: string) => (h.toLowerCase() === "retry-after" ? "1" : null) },
            json: async () => ({ message: "rate limit" }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ games: month2Games }),
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as unknown as typeof fetch;

    const client = new ChessComClient("test-agent", {
      minIntervalSeconds: 0,
      maxRetries: 3,
      baseDelayMs: 20,
      fetchImpl: mockFetch,
      randomFn: () => 0,
      sleepFn: async () => {},
    });

    const statusTexts: string[] = [];
    const result = await quickSyncRecentGames(db, client, USERNAME, 2, (p) => {
      if (p.statusText) statusTexts.push(p.statusText);
    });

    expect(result.gamesAdded).toBe(2);
    expect(statusTexts.some((txt) => txt.includes("Rate limited — sync will resume in"))).toBe(true);
    expect(games.size).toBe(2);
    expect(games.has("bob-game-02-1")).toBe(true);
    expect(games.has("bob-game-02-2")).toBe(true);
  });
});
