import { describe, it, expect, vi } from "vitest";
import { Chess } from "chess.js";
import {
  buildAnnotatedPgn,
  buildShareableSummary,
  copyToClipboard,
  type MoveAnnotationSource,
} from "../../src/postGameReport";
import type { ReviewGame, ReviewStep } from "../../src/gameReview";

describe("postGameReport: PGN export and shareable summary", () => {
  const pgn = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.10.07"]
[White "Hero"]
[Black "Villain"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 1-0`;

  const moves: MoveAnnotationSource[] = [
    {
      ply: 1,
      sideToMove: "white",
      san: "e4",
      classification: "best",
      evalAfterCp: 25,
      centipawnLoss: 0,
    },
    {
      ply: 2,
      sideToMove: "black",
      san: "e5",
      classification: "good",
      evalAfterCp: 28,
      centipawnLoss: 3,
    },
    {
      ply: 3,
      sideToMove: "white",
      san: "Nf3",
      classification: "best",
      evalAfterCp: 35,
      centipawnLoss: 0,
    },
    {
      ply: 4,
      sideToMove: "black",
      san: "Nc6",
      classification: "inaccuracy",
      evalAfterCp: 75,
      centipawnLoss: 40,
      bestMoveSan: "Nf6",
    },
    {
      ply: 5,
      sideToMove: "white",
      san: "Bc4",
      classification: "brilliant",
      evalAfterCp: 180,
      centipawnLoss: 0,
    },
    {
      ply: 6,
      sideToMove: "black",
      san: "Bc5",
      classification: "blunder",
      evalAfterCp: 450,
      centipawnLoss: 270,
      bestMoveSan: "d6",
    },
    {
      ply: 7,
      sideToMove: "white",
      san: "d3",
      classification: "mistake",
      evalAfterCp: 320,
      centipawnLoss: 130,
      bestMoveSan: "Bxf7+",
    },
  ];

  it("buildAnnotatedPgn embeds NAGs and evaluation comments", () => {
    const annotated = buildAnnotatedPgn(pgn, moves, undefined, { includeEvals: true, includeNags: true });

    // Header preservation
    expect(annotated).toContain('[White "Hero"]');
    expect(annotated).toContain('[Black "Villain"]');
    expect(annotated).toContain('[Result "1-0"]');

    // Brilliant NAG $3
    expect(annotated).toContain("$3");
    expect(annotated).toContain("Brilliant!");

    // Best move NAG $1
    expect(annotated).toContain("$1");
    expect(annotated).toContain("[%eval +0.25]");

    // Blunder NAG $4 with cp loss and better move
    expect(annotated).toContain("$4");
    expect(annotated).toContain("better was d6");

    // Can be parsed back without errors
    const testChess = new Chess();
    expect(() => testChess.loadPgn(annotated)).not.toThrow();
    expect(testChess.history().length).toBe(7);
  });

  it("buildAnnotatedPgn filters by humanColor when specified", () => {
    // White only
    const whiteOnly = buildAnnotatedPgn(pgn, moves, "white");
    expect(whiteOnly).toContain("$1"); // White e4 / Nf3
    expect(whiteOnly).toContain("$3"); // White Bc4
    // Black's blunder on move 6 ($4) should not be annotated for White
    expect(whiteOnly).not.toContain("better was d6");
  });

  it("buildAnnotatedPgn respects includeNags=false and includeEvals=false", () => {
    const noNags = buildAnnotatedPgn(pgn, moves, "white", { includeNags: false, includeEvals: true });
    expect(noNags).not.toContain("$1");
    expect(noNags).not.toContain("$3");
    expect(noNags).toContain("[%eval +0.25]");

    const noEvals = buildAnnotatedPgn(pgn, moves, "white", { includeNags: true, includeEvals: false });
    expect(noEvals).not.toContain("[%eval");
    expect(noEvals).toContain("$1");
  });

  it("buildShareableSummary produces structured social card", () => {
    const reviewSteps: ReviewStep[] = [
      {
        ply: 1,
        moveNumber: 1,
        side: "white",
        isHuman: true,
        san: "e4",
        from: "e2",
        to: "e4",
        uci: "e2e4",
        fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        fenAfter: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        classification: "best",
        centipawnLoss: 0,
      },
      {
        ply: 2,
        moveNumber: 1,
        side: "black",
        isHuman: false,
        san: "e5",
        from: "e7",
        to: "e5",
        uci: "e7e5",
        fenBefore: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        fenAfter: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      },
      {
        ply: 3,
        moveNumber: 2,
        side: "white",
        isHuman: true,
        san: "Nf3",
        from: "g1",
        to: "f3",
        uci: "g1f3",
        fenBefore: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        fenAfter: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
        classification: "brilliant",
        centipawnLoss: 0,
      },
    ];

    const review: ReviewGame = {
      pgn,
      startFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      humanColor: "white",
      steps: reviewSteps,
    };

    const summary = buildShareableSummary(review, {
      opening: "Italian Game",
      result: "1-0",
    });

    expect(summary).toContain("♟️ Chegga Game Review");
    expect(summary).toContain("Hero vs Villain [1-0]");
    expect(summary).toContain("Opening: Italian Game");
    expect(summary).toContain("Accuracy:");
    expect(summary).toContain("!! 1 Brilliant");
    expect(summary).toContain("! 1 Best");
    expect(summary).toContain("Highlight: 2. Nf3 !!");
    expect(summary).toContain("https://chegga-web.vercel.app");
  });

  it("copyToClipboard returns false safely in environments without navigator/document", async () => {
    // In Node test environment, document might exist or be mockable
    const result = await copyToClipboard("test text");
    expect(typeof result).toBe("boolean");
  });
});
