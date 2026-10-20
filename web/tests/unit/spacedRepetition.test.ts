import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { advanceSpacedRepetition, describeSpacedBox, isDueForReview, SPACED_INTERVAL_MS } from "../../src/savedPuzzles";
import { getProgress, isDue, isSolved, recordAttempt } from "../../src/puzzleProgress";
import type { SavedPuzzleRecord } from "../../src/db";

// Two spaced-repetition systems live in the app, with different ladders:
//   savedPuzzles.ts    saved positions: boxes 1-5, 1/3/7/14/30 days
//   puzzleProgress.ts  trainer puzzles: boxes 1-5, 1/3/7/21/60 days, kept in localStorage
// These fixtures pin each one's math. They do not claim the two should match.

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

function saved(over: Partial<SavedPuzzleRecord> = {}): SavedPuzzleRecord {
  return { id: "g:5", username: "tester", savedAt: NOW, ...over } as SavedPuzzleRecord;
}

describe("saved positions: the box ladder", () => {
  it("climbs 1 -> 2 -> 3 -> 4 -> 5 on right answers, with the matching wait each time", () => {
    let record = saved(); // no box yet: counts as box 1
    const seen: Array<[number | undefined, number]> = [];
    for (let i = 0; i < 4; i++) {
      record = advanceSpacedRepetition(record, true, NOW);
      seen.push([record.box, (record.nextDueAt ?? 0) - NOW]);
    }
    expect(seen).toEqual([
      [2, 3 * DAY],
      [3, 7 * DAY],
      [4, 14 * DAY],
      [5, 30 * DAY],
    ]);
  });

  it("stays in box 5 at 30 days however many right answers follow", () => {
    let record = saved({ box: 5 });
    for (let i = 0; i < 3; i++) record = advanceSpacedRepetition(record, true, NOW);
    expect(record.box).toBe(5);
    expect((record.nextDueAt ?? 0) - NOW).toBe(30 * DAY);
    expect(record.reviewCount).toBe(3);
  });

  it("drops to box 1 with a 1-day wait on a wrong answer, from any box", () => {
    for (const box of [1, 2, 3, 4, 5]) {
      const failed = advanceSpacedRepetition(saved({ box }), false, NOW);
      expect(failed.box).toBe(1);
      expect((failed.nextDueAt ?? 0) - NOW).toBe(1 * DAY);
    }
  });

  it("counts every review and stamps the time, right or wrong", () => {
    const first = advanceSpacedRepetition(saved(), true, NOW);
    const second = advanceSpacedRepetition(first, false, NOW + 5);
    expect(first).toMatchObject({ reviewCount: 1, lastReviewedAt: NOW });
    expect(second).toMatchObject({ reviewCount: 2, lastReviewedAt: NOW + 5 });
  });

  it("returns a new record and leaves the old one alone", () => {
    const before = saved({ box: 2 });
    const copy = { ...before };
    const after = advanceSpacedRepetition(before, true, NOW);
    expect(before).toEqual(copy);
    expect(after).not.toBe(before);
  });

  it("keeps the interval table in whole days, rising with the box", () => {
    const days = [1, 2, 3, 4, 5].map((box) => SPACED_INTERVAL_MS[box] / DAY);
    expect(days).toEqual([1, 3, 7, 14, 30]);
  });
});

describe("saved positions: when a record is due", () => {
  it("is due when it has no due time yet", () => {
    expect(isDueForReview(saved(), NOW)).toBe(true);
    expect(isDueForReview(saved({ nextDueAt: 0 }), NOW)).toBe(true);
  });

  it("is not due 1ms early, and is due at the exact due time", () => {
    const record = saved({ nextDueAt: NOW + DAY });
    expect(isDueForReview(record, NOW + DAY - 1)).toBe(false);
    expect(isDueForReview(record, NOW + DAY)).toBe(true);
    expect(isDueForReview(record, NOW + DAY + 1)).toBe(true);
  });

  it("is not due right after a review", () => {
    const record = advanceSpacedRepetition(saved(), true, NOW);
    expect(isDueForReview(record, NOW)).toBe(false);
  });
});

describe("describeSpacedBox", () => {
  it("names each box and the mastered box", () => {
    expect([1, 2, 3, 4, 5].map((b) => describeSpacedBox(b))).toEqual([
      "Box 1 (Daily)",
      "Box 2 (3d)",
      "Box 3 (1w)",
      "Box 4 (2w)",
      "Mastered 🏆",
    ]);
  });

  it("defaults to box 1 and falls back to a plain label for an unknown box", () => {
    expect(describeSpacedBox()).toBe("Box 1 (Daily)");
    expect(describeSpacedBox(9)).toBe("Box 9");
  });
});

// puzzleProgress.ts keeps its state in localStorage, so these tests give it a
// small in-memory stand-in and a fixed clock.
describe("trainer puzzles: progress and due times", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const entry = (id = "p1") => getProgress("tester")[id];

  it("climbs boxes 1-5 with waits of 1, 3, 7, 21 and 60 days, then stays at 60", () => {
    const seen: Array<[number | undefined, number]> = [];
    for (let i = 0; i < 6; i++) {
      recordAttempt("tester", "p1", true);
      seen.push([entry().box, (entry().nextDueAt ?? 0) - NOW]);
    }
    expect(seen).toEqual([
      [1, 1 * DAY],
      [2, 3 * DAY],
      [3, 7 * DAY],
      [4, 21 * DAY],
      [5, 60 * DAY],
      [5, 60 * DAY],
    ]);
  });

  it("drops to box 1 with a 1-day wait after a wrong answer", () => {
    for (let i = 0; i < 4; i++) recordAttempt("tester", "p1", true);
    expect(entry().box).toBe(4);
    recordAttempt("tester", "p1", false);
    expect(entry().box).toBe(1);
    expect((entry().nextDueAt ?? 0) - NOW).toBe(1 * DAY);
  });

  it("counts attempts and stamps the time", () => {
    recordAttempt("tester", "p1", false);
    recordAttempt("tester", "p1", true);
    expect(entry()).toMatchObject({ attempts: 2, lastAttemptAt: NOW });
  });

  it("marks a puzzle solved on the first right answer and never un-solves it", () => {
    recordAttempt("tester", "p1", false);
    expect(isSolved("tester", "p1")).toBe(false);
    recordAttempt("tester", "p1", true);
    expect(isSolved("tester", "p1")).toBe(true);
    recordAttempt("tester", "p1", false);
    expect(isSolved("tester", "p1")).toBe(true);
  });

  it("keeps each username and each puzzle separate", () => {
    recordAttempt("tester", "p1", true);
    recordAttempt("someone-else", "p1", false);
    recordAttempt("tester", "p2", true);
    expect(entry("p1").box).toBe(1);
    expect(entry("p2").box).toBe(1);
    expect(getProgress("someone-else")["p1"].solved).toBe(false);
    expect(isSolved("tester", "p1")).toBe(true);
    expect(isSolved("someone-else", "p1")).toBe(false);
  });

  it("treats a never-seen puzzle, and an old entry with no due time, as due now", () => {
    expect(isDue("tester", "never-seen")).toBe(true);
    store.set(
      "chegga-web:puzzle-progress:tester",
      JSON.stringify({ old: { solved: true, attempts: 1, lastAttemptAt: 1 } }),
    );
    expect(isDue("tester", "old")).toBe(true);
  });

  it("is not due 1ms early and is due at the exact due time", () => {
    recordAttempt("tester", "p1", true); // due in 1 day
    vi.setSystemTime(NOW + DAY - 1);
    expect(isDue("tester", "p1")).toBe(false);
    vi.setSystemTime(NOW + DAY);
    expect(isDue("tester", "p1")).toBe(true);
  });
});
