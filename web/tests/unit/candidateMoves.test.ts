import { describe, it, expect } from "vitest";
import { buildCandidates, buildOverlay, formatCandidateEval, isSacrifice, quickArrows } from "../../src/candidateMoves";
import type { AnalysisLine } from "../../src/engine";
import { CLASS_COLOR } from "../../src/classificationColors";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function line(multipv: number, scoreCp: number | undefined, pv: string, scoreMate?: number): AnalysisLine {
  return { multipv, depth: 12, scoreCp, scoreMate, pv: [pv] };
}

const LINES = [line(1, 30, "e2e4"), line(2, 22, "d2d4"), line(3, -20, "g1f3"), line(4, -90, "a2a3")];

describe("buildCandidates", () => {
  it("ranks by score and tiers each move by its gap to the best", () => {
    const c = buildCandidates(START, LINES);
    expect(c.map((x) => x.san)).toEqual(["e4", "d4", "Nf3", "a3"]);
    expect(c.map((x) => x.rank)).toEqual([1, 2, 3, 4]);
    expect(c.map((x) => x.gapCp)).toEqual([0, 8, 50, 120]);
    expect(c.map((x) => x.tier)).toEqual(["best", "best", "good", "mistake"]);
  });

  it("puts a mate ahead of any centipawn score", () => {
    const c = buildCandidates(START, [line(1, 250, "e2e4"), line(2, undefined, "d2d4", 3)]);
    expect(c[0].uci).toBe("d2d4");
    expect(formatCandidateEval(c[0])).toBe("M3");
    expect(c[1].tier).toBe("blunder"); // +2.5 is a long way short of a forced mate
  });

  it("drops a line whose move doesn't fit the position, and duplicates", () => {
    const c = buildCandidates(START, [line(1, 10, "e2e5"), line(2, 5, "e2e4"), line(3, 4, "e2e4")]);
    expect(c.map((x) => x.uci)).toEqual(["e2e4"]);
  });

  it("formats an evaluation from the mover's side", () => {
    const [c] = buildCandidates(START, [line(1, -135, "e2e4")]);
    expect(formatCandidateEval(c)).toBe("-1.4");
  });

  // White queen d5, lone Black king h8, White king g1: Qxg8 gives check
  // along the 8th rank and the g-file, so the only legal reply is the
  // forced Kxg8 -- a real queen-for-nothing sacrifice that the engine
  // (per this fabricated line) still calls the clear best move.
  const SAC_FEN = "7k/8/8/3Q4/8/8/8/6K1 w - - 0 1";

  it("tags a real sacrifice that's still the engine's top line as brilliant", () => {
    const [c] = buildCandidates(SAC_FEN, [line(1, 900, "d5g8")]);
    expect(c.tier).toBe("brilliant");
  });

  it("does not tag an ordinary best move (nothing to recapture with) as brilliant", () => {
    // Same queen, a quiet move to a square nothing attacks -- best by
    // score, but not a sacrifice of anything.
    const [c] = buildCandidates(SAC_FEN, [line(1, 200, "d5a2")]);
    expect(c.tier).toBe("best");
  });
});

// Exported for the move a human actually played (main.ts's live juice and
// the review marker), where the tier comes from grading rather than from a
// candidate list.
describe("isSacrifice", () => {
  const SAC_FEN = "7k/8/8/3Q4/8/8/8/6K1 w - - 0 1";

  it("is true for a piece left where a cheaper one takes it", () => {
    expect(isSacrifice(SAC_FEN, "d5g8")).toBe(true);
  });

  it("is false for a quiet move nothing can capture", () => {
    expect(isSacrifice(SAC_FEN, "d5a2")).toBe(false);
  });

  it("is false for a move that doesn't fit the position", () => {
    // The caller pairs a cached pre-move FEN with the move played; if the
    // two ever drift apart it degrades to "not a sacrifice", never throws.
    expect(isSacrifice(SAC_FEN, "e2e4")).toBe(false);
  });
});

describe("buildOverlay", () => {
  const candidates = buildCandidates(START, LINES);

  it("shades only the strong candidates, on their destination squares", () => {
    const { tints } = buildOverlay(candidates, undefined, undefined);
    expect(tints.map((t) => t.square)).toEqual(["e4", "d4", "f3"]); // best, best, good -- not the a3 mistake
    expect(tints[0].color).toBe(CLASS_COLOR.best);
    expect(tints[2].color).toBe(CLASS_COLOR.good);
  });

  it("draws the best move, and the played move in its own tier's color", () => {
    const { arrows } = buildOverlay(candidates, "a2a3", "mistake");
    expect(arrows.map((a) => a.kind)).toEqual(["best", "played"]);
    expect(arrows[0]).toMatchObject({ from: "e2", to: "e4" });
    expect(arrows[1]).toMatchObject({ from: "a2", to: "a3", color: CLASS_COLOR.mistake });
  });

  it("draws one arrow when the played move was the best move", () => {
    expect(buildOverlay(candidates, "e2e4", "best").arrows.map((a) => a.kind)).toEqual(["best"]);
  });

  it("adds a preview arrow for a tapped candidate", () => {
    const { arrows } = buildOverlay(candidates, "e2e4", "best", "g1f3");
    expect(arrows.map((a) => a.kind)).toEqual(["best", "preview"]);
    expect(arrows[1].color).toBe(CLASS_COLOR.good);
  });

  it("has nothing to draw with no candidates", () => {
    expect(buildOverlay([], undefined, undefined)).toEqual({ tints: [], arrows: [], trails: [] });
  });

  it("draws a trail per shaded candidate, not deduped by destination", () => {
    const { trails } = buildOverlay(candidates, undefined, undefined);
    expect(trails).toEqual([
      { from: "e2", to: "e4", color: CLASS_COLOR.best, tier: "best" },
      { from: "d2", to: "d4", color: CLASS_COLOR.best, tier: "best" },
      { from: "g1", to: "f3", color: CLASS_COLOR.good, tier: "good" },
    ]);
  });

  it("shades a brilliant candidate in its own color, and the best-move arrow follows it", () => {
    const sacCandidates = buildCandidates("7k/8/8/3Q4/8/8/8/6K1 w - - 0 1", [line(1, 900, "d5g8")]);
    const { tints, arrows } = buildOverlay(sacCandidates, undefined, undefined);
    expect(tints).toEqual([{ square: "g8", color: CLASS_COLOR.brilliant, opacity: 0.7, tier: "brilliant" }]);
    expect(arrows[0]).toMatchObject({ kind: "best", color: CLASS_COLOR.brilliant });
  });
});

describe("quickArrows", () => {
  it("uses the stored best move before the engine answers", () => {
    expect(quickArrows("e2e4", "a2a3", "mistake").map((a) => a.kind)).toEqual(["best", "played"]);
    expect(quickArrows("e2e4", "e2e4", "best").map((a) => a.kind)).toEqual(["best"]);
    expect(quickArrows(undefined, "a2a3", "mistake").map((a) => a.kind)).toEqual(["played"]);
  });
});
