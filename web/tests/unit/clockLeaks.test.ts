import { describe, it, expect } from "vitest";
import { computeClockLeaks, computeTimeouts } from "../../src/clockLeaks";
import type { MoveAnalysisRecord } from "../../src/db";
import { game, move } from "./_factories";

const g = game({ chessComUuid: "g1", userColor: "white", timeControl: "300" });

const PLENTY = "plenty (>70%)";
const CRITICAL = "critical (<10% time left)";

/** `n` own moves in one clock band, the first `bad` of them mistakes. */
function inBand(band: string, n: number, bad: number, startPly: number): MoveAnalysisRecord[] {
  return Array.from({ length: n }, (_, i) =>
    move({
      gameId: "g1",
      ply: startPly + i * 2,
      sideToMove: "white",
      timePressureBand: band,
      classification: i < bad ? "mistake" : "best",
      centipawnLoss: i < bad ? 200 : 0,
    }),
  );
}

describe("computeTimeouts", () => {
  it("counts losses and wins on time, and leaves daily games out", () => {
    const games = [
      game({ userColor: "white", userResult: "loss", whiteResult: "timeout", blackResult: "win" }),
      game({ userColor: "black", userResult: "loss", whiteResult: "win", blackResult: "timeout" }),
      game({ userColor: "white", userResult: "loss", whiteResult: "checkmated", blackResult: "win" }),
      game({ userColor: "white", userResult: "win", whiteResult: "win", blackResult: "timeout" }),
      game({ userColor: "white", userResult: "loss", whiteResult: "timeout", blackResult: "win", timeControl: "1/86400" }),
    ];
    expect(computeTimeouts(games)).toEqual({ games: 4, losses: 3, lossesOnTime: 2, winsOnTime: 1 });
  });
});

describe("computeClockLeaks", () => {
  it("returns null when no move has a clock time", () => {
    expect(computeClockLeaks([g], [move({ gameId: "g1", classification: "mistake" })], [g])).toBeNull();
  });

  it("counts mistakes per 100 moves in each clock band", () => {
    const own = [...inBand(PLENTY, 40, 4, 1), ...inBand(CRITICAL, 20, 8, 81)];
    const c = computeClockLeaks([g], own, [g])!;
    expect(c.movesWithClock).toBe(60);
    const byId = Object.fromEntries(c.bands.map((b) => [b.id, b]));
    expect(byId.plenty).toMatchObject({ moves: 40, mistakes: 4, rate: 10 });
    expect(byId.critical).toMatchObject({ moves: 20, mistakes: 8, rate: 40 });
    expect(byId.low.moves).toBe(0);
    expect(c.calmBand?.id).toBe("plenty");
    expect(c.worstBand?.id).toBe("critical");
    expect(c.bandLift).toBe(4);
    expect(c.advice[0]).toContain("less than 10% of your clock left");
    expect(c.advice[0]).toContain("4×");
  });

  it("works the band out from the clock when none is stored", () => {
    const own = [move({ gameId: "g1", ply: 1, clockSeconds: 20, classification: "mistake", centipawnLoss: 200 })];
    const c = computeClockLeaks([g], own, [g])!;
    expect(c.bands.find((b) => b.id === "critical")!.moves).toBe(1); // 20s of a 300s clock
  });

  it("splits moves by the time spent on them, and flags fast moves that go wrong", () => {
    // 5+0: each own move's clock is the previous one minus the time it took.
    const own: MoveAnalysisRecord[] = [];
    let clock = 300;
    for (let i = 0; i < 60; i++) {
      const fast = i % 2 === 0;
      clock -= fast ? 1 : 15;
      own.push(
        move({
          gameId: "g1",
          ply: 1 + i * 2,
          sideToMove: "white",
          clockSeconds: clock + 2000, // keep it positive; only differences matter
          timePressureBand: PLENTY,
          classification: fast && i % 4 === 0 ? "blunder" : "best",
          centipawnLoss: fast && i % 4 === 0 ? 400 : 0,
        }),
      );
    }
    // The first move's time comes from the starting clock (3000s), so it
    // lands in the 30-seconds-or-more bucket, not in these two.
    const c = computeClockLeaks([game({ chessComUuid: "g1", timeControl: "3000" })], own, [g])!;
    const byId = Object.fromEntries(c.think.map((t) => [t.id, t]));
    expect(byId.instant.moves + byId.think.moves).toBe(59);
    expect(byId.think.mistakes).toBe(0);
    expect(byId.instant.mistakes).toBeGreaterThan(10);
    expect(c.advice.some((a) => a.startsWith("Your fastest moves are your worst ones"))).toBe(true);
  });

  it("names losses on time when they are a real share of losses", () => {
    const losses = Array.from({ length: 6 }, (_, i) =>
      game({ userResult: "loss", whiteResult: i < 3 ? "timeout" : "resigned", blackResult: "win" }),
    );
    const c = computeClockLeaks([g], inBand(PLENTY, 30, 3, 1), losses)!;
    expect(c.timeouts.lossesOnTime).toBe(3);
    expect(c.advice.some((a) => a.startsWith("3 of your 6 losses were on time"))).toBe(true);
  });

  it("gives no advice when the clock does not hurt", () => {
    const own = [...inBand(PLENTY, 40, 4, 1), ...inBand(CRITICAL, 30, 3, 81)];
    const c = computeClockLeaks([g], own, [g])!;
    expect(c.bandLift).toBe(1);
    expect(c.advice).toEqual([]);
  });
});
