import { describe, it, expect } from "vitest";
import {
  AVATAR_CACHE_KEY,
  AVATAR_TTL_MS,
  avatarKey,
  initialsFor,
  isFresh,
  loadAvatarCache,
  namesToLookUp,
  pruneAvatarCache,
  renderAvatarInner,
  runAvatarLookups,
  safeAvatarUrl,
  saveAvatarCache,
  type AvatarCache,
} from "../../src/opponentAvatars";
import { findRecentGames, toPickerCard } from "../../src/gamePicker";
import { renderRecentList } from "../../src/gamePickerView";
import { game } from "./_factories";

const PIC = "https://images.chesscomfiles.com/uploads/v1/user/123.abcd.200x200o.png";
const NOW = 1_800_000_000_000;

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe("safeAvatarUrl", () => {
  it("keeps https links on Chess.com's image server", () => {
    expect(safeAvatarUrl(PIC)).toBe(PIC);
    expect(safeAvatarUrl("https://chesscomfiles.com/a.png")).toBe("https://chesscomfiles.com/a.png");
  });

  it("refuses anything else", () => {
    expect(safeAvatarUrl("http://images.chesscomfiles.com/a.png")).toBeNull();
    expect(safeAvatarUrl("https://evil.example/a.png")).toBeNull();
    expect(safeAvatarUrl("https://images.chesscomfiles.com.evil.example/a.png")).toBeNull();
    expect(safeAvatarUrl("javascript:alert(1)")).toBeNull();
    expect(safeAvatarUrl("not a url")).toBeNull();
    expect(safeAvatarUrl(42)).toBeNull();
    expect(safeAvatarUrl(undefined)).toBeNull();
  });

  it("returns a link that cannot break out of an HTML attribute", () => {
    const tricky = safeAvatarUrl('https://images.chesscomfiles.com/a"onerror="x.png')!;
    expect(tricky).not.toContain('"');
  });
});

describe("initialsFor", () => {
  it("takes the first letters of the first two words of a name", () => {
    expect(initialsFor("KingTcan")).toBe("KT");
    expect(initialsFor("magnus_carlsen")).toBe("MC");
    expect(initialsFor("MichaelBottega")).toBe("MB");
    expect(initialsFor("rival")).toBe("R");
  });

  it("falls back to the first character, or a question mark", () => {
    expect(initialsFor("123")).toBe("1");
    expect(initialsFor("  ")).toBe("?");
  });
});

describe("isFresh", () => {
  it("is fresh for a week, then stale", () => {
    expect(isFresh({ url: PIC, at: NOW - 1000 }, NOW)).toBe(true);
    expect(isFresh({ url: null, at: NOW - 1000 }, NOW)).toBe(true); // "no picture" is an answer too
    expect(isFresh({ url: PIC, at: NOW - AVATAR_TTL_MS - 1 }, NOW)).toBe(false);
    expect(isFresh(undefined, NOW)).toBe(false);
  });

  it("treats a lookup dated in the future (a clock set back) as stale", () => {
    expect(isFresh({ url: PIC, at: NOW + 60_000 }, NOW)).toBe(false);
  });
});

describe("namesToLookUp", () => {
  const card = (opponent: string, site: "chesscom" | "lichess" = "chesscom") => ({ opponent, site });

  it("lists each Chess.com opponent once, in list order", () => {
    expect(namesToLookUp([card("KingTcan"), card("rival"), card("kingtcan")], {}, NOW)).toEqual(["KingTcan", "rival"]);
  });

  it("skips Lichess players, names a URL could not carry, and fresh answers", () => {
    const cache: AvatarCache = {
      known: { url: PIC, at: NOW - 1000 },
      nopic: { url: null, at: NOW - 1000 },
      old: { url: PIC, at: NOW - AVATAR_TTL_MS - 1 },
    };
    const cards = [card("lichessfan", "lichess"), card("White"), card("a b"), card("known"), card("nopic"), card("old")];
    expect(namesToLookUp(cards, cache, NOW)).toEqual(["White", "old"]);
  });
});

describe("the saved copy", () => {
  it("round-trips through storage", () => {
    const storage = fakeStorage();
    saveAvatarCache({ kingtcan: { url: PIC, at: NOW }, rival: { url: null, at: NOW } }, storage);
    expect(loadAvatarCache(storage)).toEqual({ kingtcan: { url: PIC, at: NOW }, rival: { url: null, at: NOW } });
  });

  it("drops anything malformed or unsafe when read back", () => {
    const storage = fakeStorage({
      [AVATAR_CACHE_KEY]: JSON.stringify({
        good: { url: PIC, at: NOW },
        evil: { url: "https://evil.example/x.png", at: NOW },
        script: { url: "javascript:alert(1)", at: NOW },
        noTime: { url: PIC },
        badTime: { url: PIC, at: "yesterday" },
        notAnObject: "hello",
      }),
    });
    expect(loadAvatarCache(storage)).toEqual({ good: { url: PIC, at: NOW } });
  });

  it("survives broken or missing storage", () => {
    expect(loadAvatarCache(fakeStorage({ [AVATAR_CACHE_KEY]: "{not json" }))).toEqual({});
    expect(loadAvatarCache(fakeStorage({ [AVATAR_CACHE_KEY]: "[1,2]" }))).toEqual({});
    expect(loadAvatarCache(null)).toEqual({});
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadAvatarCache(throwing)).toEqual({});
    expect(() => saveAvatarCache({ a: { url: null, at: NOW } }, throwing)).not.toThrow();
  });

  it("keeps only the newest answers", () => {
    const cache: AvatarCache = {};
    for (let i = 0; i < 10; i++) cache[`p${i}`] = { url: null, at: NOW + i };
    expect(Object.keys(pruneAvatarCache(cache, 3)).sort()).toEqual(["p7", "p8", "p9"]);
  });
});

describe("runAvatarLookups", () => {
  it("looks names up one at a time and stores every answer", async () => {
    const stored: [string, string | null][] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    let wanted = ["a1", "b2", "c3"];
    const result = await runAvatarLookups({
      wanted: () => wanted,
      fetchAvatar: async (name) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight -= 1;
        return name === "b2" ? null : `${PIC}?${name}`;
      },
      store: (name, url) => {
        stored.push([name, url]);
        wanted = wanted.filter((n) => n !== name);
      },
    });
    expect(result).toBe("done");
    expect(maxInFlight).toBe(1);
    expect(stored).toEqual([
      ["a1", `${PIC}?a1`],
      ["b2", null],
      ["c3", `${PIC}?c3`],
    ]);
  });

  it("stops at the first error and does not store that name", async () => {
    const stored: string[] = [];
    const result = await runAvatarLookups({
      wanted: () => ["a1", "b2", "c3"].filter((n) => !stored.includes(n)),
      fetchAvatar: async (name) => {
        if (name === "b2") throw new Error("429");
        return PIC;
      },
      store: (name) => stored.push(name),
    });
    expect(result).toBe("stopped");
    expect(stored).toEqual(["a1"]);
  });

  it("tries each name once even when the list does not shrink", async () => {
    const calls: string[] = [];
    const result = await runAvatarLookups({
      wanted: () => ["a1", "b2"],
      fetchAvatar: async (name) => {
        calls.push(name);
        return null;
      },
      store: () => {},
    });
    expect(result).toBe("done");
    expect(calls).toEqual(["a1", "b2"]);
  });

  it("waits while a sync is running, and gives up if it never ends", async () => {
    let busyChecks = 0;
    const calls: string[] = [];
    const waited: number[] = [];
    const result = await runAvatarLookups({
      wanted: () => (calls.length ? [] : ["a1"]),
      fetchAvatar: async (name) => {
        calls.push(name);
        return null;
      },
      store: () => {},
      busy: () => ++busyChecks <= 3, // busy for three checks, then free
      wait: async (ms) => {
        waited.push(ms);
      },
    });
    expect(result).toBe("done");
    expect(waited).toEqual([1000, 1000, 1000]);
    expect(calls).toEqual(["a1"]);

    const never = await runAvatarLookups({
      wanted: () => ["a1"],
      fetchAvatar: async () => PIC,
      store: () => {},
      busy: () => true,
      wait: async () => {},
      maxBusyWaitMs: 3000,
    });
    expect(never).toBe("stopped");
  });
});

describe("the last-10 list", () => {
  it("knows which site each game came from", () => {
    expect(toPickerCard(game({ chessComUuid: "abc-123" })).site).toBe("chesscom");
    expect(toPickerCard(game({ chessComUuid: "lichess:xyz" })).site).toBe("lichess");
  });

  it("shows a known Chess.com picture, and initials for everyone else", () => {
    const games = [
      game({ chessComUuid: "c1", blackUsername: "KingTcan", endTime: 3 }),
      game({ chessComUuid: "c2", blackUsername: "rival", endTime: 2 }),
      game({ chessComUuid: "lichess:l1", blackUsername: "KingTcan", endTime: 1 }),
    ];
    const html = renderRecentList(findRecentGames(games), null, "", { [avatarKey("KingTcan")]: { url: PIC, at: NOW } });
    const rows = html.split("<li>").slice(1);
    expect(rows[0]).toContain(`<img src="${PIC}"`);
    expect(rows[0]).toContain('referrerpolicy="no-referrer"');
    expect(rows[0]).toContain('alt=""');
    expect(rows[1]).toContain(">R</span>"); // no picture known yet
    expect(rows[2]).not.toContain("<img"); // Lichess has no pictures, even for the same name
    expect(rows[2]).toContain(">KT</span>");
  });

  it("never renders an unsafe picture link", () => {
    const html = renderAvatarInner("x", "https://evil.example/a.png");
    expect(html).not.toContain("<img");
  });
});
