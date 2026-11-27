import { describe, it, expect } from "vitest";
import { computeBlunderDnaProfile, ownMoveTimes, pieceOf, scoreBucket } from "../../src/blunderDnaProfile";
import { typicalMistake } from "../../src/blunderDnaView";
import type { MoveAnalysisRecord } from "../../src/db";
import { game, move } from "./_factories";

const g = game({ chessComUuid: "g1", userColor: "white", timeControl: "180+2" });

/** `n` own moves (white, odd plies from `startPly`), the first `bad` of them mistakes. */
function moves(n: number, bad: number, over: Partial<MoveAnalysisRecord>, startPly = 1): MoveAnalysisRecord[] {
  return Array.from({ length: n }, (_, i) =>
    move({
      gameId: "g1",
      ply: startPly + i * 2,
      sideToMove: "white",
      gamePhase: "middlegame",
      classification: i < bad ? "mistake" : "good",
      centipawnLoss: i < bad ? 200 : 10,
      ...over,
    }),
  );
}

describe("pieceOf", () => {
  it("names the piece a SAN move moves", () => {
    expect(pieceOf("Nf3")).toBe("n");
    expect(pieceOf("Qxd8+")).toBe("q");
    expect(pieceOf("exd5")).toBe("p");
    expect(pieceOf("e8=Q")).toBe("p");
    expect(pieceOf("O-O-O")).toBe("k");
    expect(pieceOf("Kh1")).toBe("k");
    expect(pieceOf("")).toBeUndefined();
  });
});

describe("scoreBucket", () => {
  it("reads the score from the mover's side", () => {
    expect(scoreBucket(move({ sideToMove: "white", evalBeforeCp: 250 }))).toBe("ahead");
    expect(scoreBucket(move({ sideToMove: "black", evalBeforeCp: -300 }))).toBe("ahead");
    expect(scoreBucket(move({ sideToMove: "black", evalBeforeCp: 300 }))).toBe("behind");
    expect(scoreBucket(move({ sideToMove: "white", evalBeforeCp: 120 }))).toBe("level");
    expect(scoreBucket(move({ sideToMove: "white", evalBeforeMate: 3 }))).toBe("ahead");
    expect(scoreBucket(move({ sideToMove: "white", evalBeforeMate: -2 }))).toBe("behind");
    expect(scoreBucket(move({ sideToMove: "white" }))).toBeUndefined();
  });
});

describe("ownMoveTimes", () => {
  it("uses the starting clock for the first move and adds the increment", () => {
    const own = [
      move({ gameId: "g1", ply: 1, clockSeconds: 180 }),
      move({ gameId: "g1", ply: 3, clockSeconds: 175 }),
      move({ gameId: "g1", ply: 7, clockSeconds: 160 }), // ply 5 is missing: no time for ply 7
    ];
    const times = ownMoveTimes([g], own);
    expect(times.get(own[0])).toBe(2);
    expect(times.get(own[1])).toBe(7);
    expect(times.has(own[2])).toBe(false);
  });

  it("has no times for daily games", () => {
    const daily = game({ chessComUuid: "d1", timeControl: "1/86400" });
    expect(ownMoveTimes([daily], [move({ gameId: "d1", ply: 1, clockSeconds: 80000 })]).size).toBe(0);
  });
});

describe("computeBlunderDnaProfile", () => {
  it("returns null without mistakes", () => {
    expect(computeBlunderDnaProfile([g], moves(30, 0, { san: "e4" }))).toBeNull();
  });

  it("finds the piece whose moves go wrong far more often than normal", () => {
    const own = [...moves(40, 16, { san: "Qd2" }), ...moves(60, 6, { san: "e4" }, 81)];
    const p = computeBlunderDnaProfile([g], own)!;
    expect(p.totalMoves).toBe(100);
    expect(p.totalMistakes).toBe(22);
    expect(p.overallRate).toBe(22);
    const piece = p.strands.find((s) => s.id === "piece")!;
    expect(piece.standout?.id).toBe("q");
    expect(piece.buckets.find((b) => b.id === "q")!.rate).toBe(40);
    expect(p.traits).toEqual(["a queen move"]);
    expect(typicalMistake(p)).toBe("a queen move");
    expect(p.drill).toEqual({ label: "Drill your own mistakes" }); // no phase stands out
  });

  it("names a phase that stands out and drills it", () => {
    const own = [...moves(30, 15, { san: "e4", gamePhase: "endgame" }), ...moves(70, 7, { san: "e4" }, 61)];
    const p = computeBlunderDnaProfile([g], own)!;
    expect(p.strands.find((s) => s.id === "phase")!.standout?.id).toBe("endgame");
    expect(p.drill).toEqual({ phase: "endgame", label: "Drill your endgame mistakes" });
    expect(typicalMistake(p)).toBe("a move in the endgame");
  });

  it("needs enough moves before a bucket can stand out", () => {
    const own = [...moves(10, 8, { san: "Qd2" }), ...moves(90, 9, { san: "e4" }, 21)];
    const p = computeBlunderDnaProfile([g], own)!;
    expect(p.strands.find((s) => s.id === "piece")!.standout).toBeUndefined();
    expect(p.traits).toEqual([]);
    expect(typicalMistake(p)).toBeUndefined();
  });

  it("sorts moves into clock buckets: panic first, then fast or steady", () => {
    const own = [
      move({ gameId: "g1", ply: 1, clockSeconds: 179, classification: "good" }), // 3s spent
      move({ gameId: "g1", ply: 3, clockSeconds: 180, classification: "mistake", centipawnLoss: 200 }), // 1s spent
      move({ gameId: "g1", ply: 5, clockSeconds: 8, classification: "blunder", centipawnLoss: 400 }), // panic
    ];
    const clock = computeBlunderDnaProfile([g], own)!.strands.find((s) => s.id === "clock")!;
    const byId = Object.fromEntries(clock.buckets.map((b) => [b.id, b]));
    expect(byId.steady.moves).toBe(1);
    expect(byId.rush.mistakes).toBe(1);
    expect(byId.panic.mistakes).toBe(1);
  });

  it("joins several standouts into one sentence, piece first", () => {
    const queenEndgameAhead = moves(30, 18, { san: "Qd2", gamePhase: "endgame", evalBeforeCp: 500 });
    const rest = moves(90, 9, { san: "e4", gamePhase: "middlegame", evalBeforeCp: 0 }, 61);
    const p = computeBlunderDnaProfile([g], [...queenEndgameAhead, ...rest])!;
    expect(typicalMistake(p)).toBe("a queen move in the endgame, when you are ahead");
  });
});
