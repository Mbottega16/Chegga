import { describe, it, expect } from "vitest";
import {
  ChessComClient,
  ChessComHttpError,
  calculateBackoffWithJitter,
} from "../../src/chessComClient";

function mockResponse(status: number, data: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (k: string) => headers[k] ?? headers[k.toLowerCase()] ?? null,
    },
    json: async () => data,
  } as unknown as Response;
}

describe("calculateBackoffWithJitter", () => {
  it("computes exponential backoff with jitter within expected bounds", () => {
    // With deterministic randomFn returning 0 (lower bound = expDelay / 2)
    const minDelay1 = calculateBackoffWithJitter(1, { baseDelayMs: 1000, randomFn: () => 0 });
    expect(minDelay1).toBe(500); // 1000 / 2

    const minDelay2 = calculateBackoffWithJitter(2, { baseDelayMs: 1000, randomFn: () => 0 });
    expect(minDelay2).toBe(1000); // 2000 / 2

    const minDelay3 = calculateBackoffWithJitter(3, { baseDelayMs: 1000, randomFn: () => 0 });
    expect(minDelay3).toBe(2000); // 4000 / 2

    // With deterministic randomFn returning 1 (upper bound = expDelay)
    const maxDelay1 = calculateBackoffWithJitter(1, { baseDelayMs: 1000, randomFn: () => 1 });
    expect(maxDelay1).toBe(1000);

    const maxDelay2 = calculateBackoffWithJitter(2, { baseDelayMs: 1000, randomFn: () => 1 });
    expect(maxDelay2).toBe(2000);

    // Caps at maxDelayMs
    const capped = calculateBackoffWithJitter(10, { baseDelayMs: 1000, maxDelayMs: 30_000, randomFn: () => 1 });
    expect(capped).toBe(30_000);
  });

  it("honors Retry-After header with jitter", () => {
    // Retry-After of 5 seconds -> 5000ms base + jitter
    const delayWithJitter0 = calculateBackoffWithJitter(1, { retryAfterSeconds: 5, randomFn: () => 0 });
    expect(delayWithJitter0).toBe(5000);

    const delayWithJitter1 = calculateBackoffWithJitter(1, { retryAfterSeconds: 5, randomFn: () => 1 });
    expect(delayWithJitter1).toBe(5500); // 5000 + 10% (500)
  });
});

describe("ChessComClient HTTP 429 rate limit handling", () => {
  it("retries on HTTP 429 using exponential backoff with jitter and succeeds", async () => {
    const calls: string[] = [];
    const delays: number[] = [];
    let attempt = 0;

    const mockFetch = (async (url: string) => {
      calls.push(url);
      attempt++;
      if (attempt === 1) {
        return mockResponse(429, {}, { "Retry-After": "2" });
      }
      if (attempt === 2) {
        return mockResponse(429, {});
      }
      return mockResponse(200, { games: [{ uuid: "game1" }, { uuid: "game2" }] });
    }) as unknown as typeof fetch;

    const sleeps: number[] = [];
    const client = new ChessComClient("test-agent", {
      minIntervalSeconds: 0,
      maxRetries: 5,
      baseDelayMs: 100,
      fetchImpl: mockFetch,
      randomFn: () => 0.5,
      sleepFn: async (ms) => {
        sleeps.push(ms);
      },
    });

    const rateLimitUpdates: number[] = [];
    client.onRateLimit = (secondsLeft) => {
      rateLimitUpdates.push(secondsLeft);
    };

    const games = await client.getArchive("https://api.chess.com/pub/player/tester/games/2026/04");
    expect(games).toHaveLength(2);
    expect(games[0].uuid).toBe("game1");
    expect(calls).toHaveLength(3); // 2 rate limits, 1 success

    // Verify rate limit callbacks were fired
    expect(rateLimitUpdates.length).toBeGreaterThanOrEqual(2);
    expect(rateLimitUpdates).toContain(2); // From Retry-After: 2
    expect(sleeps.length).toBeGreaterThanOrEqual(2);
  });

  it("surfaces countdown via onRateLimit callback for multi-second delays", async () => {
    let attempt = 0;
    const mockFetch = (async () => {
      attempt++;
      if (attempt === 1) {
        return mockResponse(429, {}, { "Retry-After": "3" });
      }
      return mockResponse(200, { archives: ["https://api.chess.com/pub/player/tester/games/2026/01"] });
    }) as unknown as typeof fetch;

    const countdowns: number[] = [];
    const client = new ChessComClient("test-agent", {
      minIntervalSeconds: 0,
      maxRetries: 3,
      fetchImpl: mockFetch,
      randomFn: () => 0,
      sleepFn: async () => {}, // instant sleep for test speed
      onRateLimit: (sec) => countdowns.push(sec),
    });

    const urls = await client.getArchiveUrls("tester");
    expect(urls).toHaveLength(1);
    expect(attempt).toBe(2);
    // Countdowns should tick down: 3, 2, 1
    expect(countdowns).toEqual([3, 2, 1]);
  });

  it("throws ChessComHttpError(429) when maxRetries is exceeded", async () => {
    let callCount = 0;
    const mockFetch = (async (url: string) => {
      callCount++;
      return mockResponse(429, { message: "Too many requests" });
    }) as unknown as typeof fetch;

    const client = new ChessComClient("test-agent", {
      minIntervalSeconds: 0,
      maxRetries: 3,
      baseDelayMs: 10,
      fetchImpl: mockFetch,
      randomFn: () => 0,
      sleepFn: async () => {},
    });

    await expect(client.getArchive("https://api.chess.com/pub/player/tester/games/2026/01")).rejects.toThrow(
      ChessComHttpError,
    );
    expect(callCount).toBe(3);
  });

  it("retries and recovers from transient network failures", async () => {
    let attempts = 0;
    const mockFetch = (async () => {
      attempts++;
      if (attempts < 3) {
        throw new TypeError("Failed to fetch (network error)");
      }
      return mockResponse(200, { games: [] });
    }) as unknown as typeof fetch;

    const client = new ChessComClient("test-agent", {
      minIntervalSeconds: 0,
      maxRetries: 4,
      baseDelayMs: 10,
      fetchImpl: mockFetch,
      sleepFn: async () => {},
    });

    const games = await client.getArchive("https://api.chess.com/pub/player/tester/games/2026/01");
    expect(games).toEqual([]);
    expect(attempts).toBe(3);
  });
});

describe("ChessComClient default fetch", () => {
  // Browsers throw "Illegal invocation" when fetch runs with any receiver but
  // the global object; Node's fetch does not care. This stand-in behaves like
  // a browser, so storing fetch bare and calling `this.fetchImpl(url)` fails.
  it("calls the global fetch without the client as its receiver", async () => {
    const original = globalThis.fetch;
    let receiverOk = true;
    globalThis.fetch = function (this: unknown) {
      if (this !== undefined && this !== globalThis) receiverOk = false;
      return Promise.resolve(mockResponse(200, { archives: ["https://api.chess.com/pub/player/t/games/2026/11"] }));
    } as unknown as typeof fetch;
    try {
      const client = new ChessComClient("test", { minIntervalSeconds: 0 });
      expect(await client.getArchiveUrls("t")).toHaveLength(1);
      expect(receiverOk).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });
});
