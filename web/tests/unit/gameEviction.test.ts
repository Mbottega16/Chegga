import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  AUTO_EVICT_MAX_SHARE,
  EVICT_BATCH,
  isAutoEvictOn,
  lastUsedMs,
  planEviction,
  setAutoEvict,
  type EvictionCandidate,
} from "../../src/gameEviction";

const c = (id: string, endTime: number, lastAccessedAt?: number): EvictionCandidate => ({ id, endTime, lastAccessedAt });

describe("lastUsedMs", () => {
  it("uses the last open time, and the day played (in ms) for a game never opened", () => {
    expect(lastUsedMs(c("a", 1_700_000_000, 1_800_000_000_000))).toBe(1_800_000_000_000);
    expect(lastUsedMs(c("a", 1_700_000_000))).toBe(1_700_000_000_000);
  });
});

describe("planEviction", () => {
  const games = [
    c("opened-recently", 1_600_000_000, 1_800_000_000_000),
    c("never-opened-old", 1_500_000_000),
    c("never-opened-new", 1_790_000_000),
    c("opened-long-ago", 1_700_000_000, 1_600_000_000_000),
  ];

  it("takes the least recently used first", () => {
    expect(planEviction(games, { count: 4 })).toEqual([
      "never-opened-old", // 1.5e12
      "opened-long-ago", // 1.6e12
      "never-opened-new", // 1.79e12
      "opened-recently", // 1.8e12
    ]);
  });

  it("stops at the count", () => {
    expect(planEviction(games, { count: 2 })).toEqual(["never-opened-old", "opened-long-ago"]);
  });

  it("never takes more than there are", () => {
    expect(planEviction(games, { count: 99 })).toHaveLength(4);
  });

  it("caps the take at a share of all games, rounded down", () => {
    expect(planEviction(games, { count: 99, maxShare: 0.5 })).toHaveLength(2);
    expect(planEviction(games, { count: 99, maxShare: AUTO_EVICT_MAX_SHARE })).toHaveLength(1);
    expect(planEviction([c("only", 1)], { count: 99, maxShare: AUTO_EVICT_MAX_SHARE })).toEqual([]);
  });

  it("defaults to one batch", () => {
    const many = Array.from({ length: EVICT_BATCH + 20 }, (_, i) => c(`g${String(i).padStart(3, "0")}`, 1_000_000 + i));
    expect(planEviction(many)).toHaveLength(EVICT_BATCH);
  });

  it("breaks ties by the older game, then by id, so the answer is stable", () => {
    const tied = [c("b", 20, 5), c("a", 20, 5), c("z", 10, 5)];
    expect(planEviction(tied, { count: 3 })).toEqual(["z", "a", "b"]);
  });

  it("does not change the input and handles nothing or zero", () => {
    const copy = JSON.parse(JSON.stringify(games));
    planEviction(games);
    expect(games).toEqual(copy);
    expect(planEviction([])).toEqual([]);
    expect(planEviction(games, { count: 0 })).toEqual([]);
    expect(planEviction(games, { count: -5 })).toEqual([]);
  });
});

describe("the auto-evict preference", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is off until the visitor turns it on, and can be turned off again", () => {
    expect(isAutoEvictOn()).toBe(false);
    setAutoEvict(true);
    expect(isAutoEvictOn()).toBe(true);
    setAutoEvict(false);
    expect(isAutoEvictOn()).toBe(false);
  });

  it("is off when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(isAutoEvictOn()).toBe(false);
    expect(() => setAutoEvict(true)).not.toThrow();
  });
});
