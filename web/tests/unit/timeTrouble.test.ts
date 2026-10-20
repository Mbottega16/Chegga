import { describe, it, expect } from "vitest";
import { buildReview, describeStep, type ReviewGame } from "../../src/gameReview";
import type { MoveAnalysisRecord } from "../../src/db";
import { move } from "./_factories";

// Time-trouble detection, driven by %clk annotations in a PGN. Each fixture
// is a short game on a 180-second clock. White is the reviewer ("human").
//
//   panic: the mover's clock reads 10s or less (either side)
//   rush:  the reviewer spent 2.5s or less on a move graded mistake or blunder
//
// Panic wins when both are true.

const SAN = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"];

/** A PGN of the eight moves above; `clocks[i]` is the clock text after ply i+1, or null for none. */
function pgn(clocks: Array<string | null>, timeControl = "180+0"): string {
  const tokens = SAN.map((san, i) => {
    const number = i % 2 === 0 ? `${i / 2 + 1}. ` : `${Math.floor(i / 2) + 1}... `;
    const clock = clocks[i] ? ` {[%clk ${clocks[i]}]}` : "";
    return `${number}${san}${clock}`;
  });
  return `[Event "Clock Test"]\n[TimeControl "${timeControl}"]\n\n${tokens.join(" ")}`;
}

/** Grades per ply; unlisted plies are "best". */
function grades(over: Record<number, MoveAnalysisRecord["classification"]> = {}): MoveAnalysisRecord[] {
  return SAN.map((san, i) =>
    move({
      ply: i + 1,
      san,
      sideToMove: i % 2 === 0 ? "white" : "black",
      classification: over[i + 1] ?? "best",
      centipawnLoss: over[i + 1] && over[i + 1] !== "best" ? 200 : 0,
    }),
  );
}

const review = (clocks: Array<string | null>, g = grades(), tc = "180+0"): ReviewGame => buildReview(pgn(clocks, tc), g, "white");
const alerts = (r: ReviewGame) => r.steps.map((s) => s.clockAlert);

describe("time spent per move", () => {
  it("counts the first move from the base time and each later move from that side's previous clock", () => {
    const r = review(["0:02:59", "0:02:58", "0:02:55", "0:02:50"]);
    expect(r.steps.slice(0, 4).map((s) => s.timeSpentSec)).toEqual([1, 2, 4, 8]);
  });

  it("keeps one decimal for fractional clocks", () => {
    const r = review(["0:02:57.5"]);
    expect(r.steps[0].clockRemainingSec).toBe(177.5);
    expect(r.steps[0].timeSpentSec).toBe(2.5);
  });

  it("leaves time and alert empty for a move with no clock annotation, without shifting later moves", () => {
    const r = review(["0:02:59", null, "0:02:50"]);
    expect(r.steps[1].clockRemainingSec).toBeUndefined();
    expect(r.steps[1].timeSpentSec).toBeUndefined();
    expect(r.steps[1].clockAlert).toBeUndefined();
    expect(r.steps[2].clockRemainingSec).toBe(170);
    expect(r.steps[2].timeSpentSec).toBe(9); // 179 -> 170 on White's own clock
  });

  it("has no time data at all for a game without clocks", () => {
    const r = review([]);
    expect(r.steps.every((s) => s.clockRemainingSec === undefined && s.timeSpentSec === undefined)).toBe(true);
    expect(alerts(r).every((a) => a === undefined)).toBe(true);
  });

  it("has no time spent on the first move of a correspondence game (no base time)", () => {
    const r = review(["0:02:59"], grades(), "1/259200");
    expect(r.steps[0].clockRemainingSec).toBe(179);
    expect(r.steps[0].timeSpentSec).toBeUndefined();
  });
});

describe("panic: 10 seconds or less", () => {
  it("fires at exactly 10s and not at 10.5s", () => {
    const r = review(["0:02:59", "0:02:58", "0:00:10", "0:00:10.5"]);
    expect(r.steps[2].clockAlert).toBe("panic");
    expect(r.steps[3].clockAlert).toBeUndefined();
  });

  it("fires for the opponent's clock too", () => {
    const r = review(["0:02:59", "0:00:09"]);
    expect(r.steps[1].isHuman).toBe(false);
    expect(r.steps[1].clockAlert).toBe("panic");
  });

  it("fires on a move graded best, because it is about the clock", () => {
    const r = review(["0:02:59", "0:02:58", "0:00:05"]);
    expect(r.steps[2].classification).toBe("best");
    expect(r.steps[2].clockAlert).toBe("panic");
  });

  it("wins over rush when the move was both quick and low on time", () => {
    // White's clock goes 10s -> 8s on ply 7: 2s spent on a blunder, with 8s left.
    const r = review(["0:02:59", "0:02:58", "0:02:57", "0:02:57", "0:00:10", "0:02:57", "0:00:08"], grades({ 7: "blunder" }));
    expect(r.steps[6].timeSpentSec).toBe(2);
    expect(r.steps[6].clockAlert).toBe("panic");
  });

  it("is spoken in the step description with the rounded seconds", () => {
    const r = review(["0:02:59", "0:02:58", "0:00:07.6"]);
    expect(describeStep(r, 2)).toContain("⏱️ Panic: only 8s left!");
  });
});

describe("rush: a quick mistake or blunder by the reviewer", () => {
  it("fires for a blunder played in 2s", () => {
    const r = review(["0:02:59", "0:02:58", "0:02:57"], grades({ 3: "blunder" }));
    expect(r.steps[2].timeSpentSec).toBe(2);
    expect(r.steps[2].clockAlert).toBe("rush");
    expect(describeStep(r, 2)).toContain("⚡ Rushed: played in 2s.");
  });

  it("fires for a mistake too", () => {
    const r = review(["0:02:59", "0:02:58", "0:02:57"], grades({ 3: "mistake" }));
    expect(r.steps[2].clockAlert).toBe("rush");
  });

  it("fires at exactly 2.5s and not at 2.6s", () => {
    const at = review(["0:02:59", "0:02:58", "0:02:56.5"], grades({ 3: "blunder" }));
    expect(at.steps[2].timeSpentSec).toBe(2.5);
    expect(at.steps[2].clockAlert).toBe("rush");
    const over = review(["0:02:59", "0:02:58", "0:02:56.4"], grades({ 3: "blunder" }));
    expect(over.steps[2].timeSpentSec).toBe(2.6);
    expect(over.steps[2].clockAlert).toBeUndefined();
  });

  it("does not fire for a quick move that was fine", () => {
    const r = review(["0:02:59", "0:02:58", "0:02:57"], grades({ 3: "inaccuracy" }));
    expect(r.steps[2].clockAlert).toBeUndefined();
    const best = review(["0:02:59", "0:02:58", "0:02:57"]);
    expect(best.steps[2].clockAlert).toBeUndefined();
  });

  it("does not fire for a slow blunder", () => {
    const r = review(["0:02:59", "0:02:58", "0:02:40"], grades({ 3: "blunder" }));
    expect(r.steps[2].clockAlert).toBeUndefined();
    expect(describeStep(r, 2)).toContain("(19s)"); // White's clock: 179 -> 160
  });

  it("does not fire for the opponent's quick blunder", () => {
    const r = review(["0:02:59", "0:02:58"], grades({ 2: "blunder" }));
    expect(r.steps[1].timeSpentSec).toBe(2);
    expect(r.steps[1].isHuman).toBe(false);
    expect(r.steps[1].clockAlert).toBeUndefined();
  });

  it("needs a grade: an ungraded quick move is not a rush", () => {
    const r = buildReview(pgn(["0:02:59", "0:02:58", "0:02:57"]), [], "white");
    expect(r.steps[2].clockAlert).toBeUndefined();
  });
});

// "180+2": every move earns 2s back, so a quick move can leave the clock
// higher than before it.
describe("increment games", () => {
  const INC = "180+2";

  it("counts time spent as previous clock - new clock + increment", () => {
    // White: 180 -> 181 (1s spent) -> 181 (2s spent) -> 175 (8s spent)
    const r = review(["0:03:01", "0:03:01", "0:03:01", "0:03:01", "0:02:55"], grades(), INC);
    expect(r.steps[0].timeSpentSec).toBe(1);
    expect(r.steps[2].timeSpentSec).toBe(2);
    expect(r.steps[4].timeSpentSec).toBe(8);
  });

  it("still flags a quick blunder as a rush when the clock went up", () => {
    const r = review(["0:03:01", "0:03:01", "0:03:01"], grades({ 3: "blunder" }), INC);
    expect(r.steps[2].clockRemainingSec).toBe(181);
    expect(r.steps[2].clockAlert).toBe("rush");
  });

  it("leaves time empty when the clock rose by more than the increment", () => {
    const r = review(["0:03:00", "0:03:00", "0:03:10"], grades(), INC);
    expect(r.steps[2].timeSpentSec).toBeUndefined();
  });

  it("does not add anything for a game with no increment", () => {
    const r = review(["0:02:59", "0:02:58", "0:02:57"]);
    expect(r.steps[2].timeSpentSec).toBe(2);
  });
});
