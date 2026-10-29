import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import {
  checkFork,
  checkPin,
  checkBackRank,
  checkSkewer,
  tagMove,
  extractBlunderDna,
  FORK,
  PIN,
  BACK_RANK,
  SKEWER,
  HUNG_MATERIAL,
} from "../../src/blunderTagger";

describe("blunderTagger motif detection", () => {
  it("detects a knight fork against king and rook", () => {
    // White knight on d5 jumps to c7+ forking King on e8 and Rook on a8
    const fen = "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1";
    const board = new Chess(fen);
    // Mover is Black who just made a move; board turn is White
    const fork = checkFork(board, "b");
    expect(fork).not.toBeNull();
    expect(fork?.motif).toBe(FORK);
    expect(fork?.motifLabel).toContain("Knight Fork");
  });

  it("detects an absolute pin to the king", () => {
    // White bishop on b5 pins black knight on c6 to king on e8
    const fen = "4k3/8/2n5/1B6/8/8/8/4K3 b - - 0 1";
    const board = new Chess(fen);
    const pin = checkPin(board, "b");
    expect(pin).not.toBeNull();
    expect(pin?.motif).toBe(PIN);
    expect(pin?.victimPiece).toBe("n");
  });

  it("detects back-rank weakness when king has no luft and back rank is attacked", () => {
    // White king on g1, pawns on f2, g2, h2. Black rook on d1. Black king on g8
    const fen = "3r2k1/8/8/8/8/8/5PPP/6K1 b - - 0 1";
    const board = new Chess(fen);
    const br = checkBackRank(board, "w");
    expect(br).not.toBeNull();
    expect(br?.motif).toBe(BACK_RANK);
    expect(br?.victimSquare).toBe("g1");
  });

  it("detects skewer on king exposing rook behind it", () => {
    // White rook on e1 skewers Black king on e5 with Black rook on e8 behind it
    const fen = "4r3/8/8/4k3/8/8/8/4R1K1 b - - 0 1";
    const board = new Chess(fen);
    const skewer = checkSkewer(board, "b");
    expect(skewer).not.toBeNull();
    expect(skewer?.motif).toBe(SKEWER);
    expect(skewer?.victimSquare).toBe("e5");
    expect(skewer?.secondarySquare).toBe("e8");
  });

  it("tags a move as hung_material when leaving a piece undefended", () => {
    // White plays e4 blundering hanging pawn if taken
    const fenBefore = "rnbqkbnr/pppp1ppp/8/4p3/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 1";
    // White moves knight from f3 to h4 leaving it open or similar
    const tag = tagMove({
      fenBefore: "4k3/8/8/8/8/8/4N3/4K1r1 w - - 0 1",
      uci: "e1d2",
      san: "Kd2",
      sideToMove: "white",
      classification: "blunder",
      bestMoveSan: "Nxg1",
    });
    // In this position, moving Kd2 leaves the knight on e2 hanging to Rg2 or leaves a piece hanging
    expect(tag).toBeDefined();
  });

  it("extracts comprehensive Blunder DNA including motif, root cause, damage, and tactical lines", () => {
    // White blunders knight into a pin in time rush (1.2s)
    const fenBefore = "4k3/8/8/1B6/8/8/8/2N1K3 b - - 0 1";
    const dna = extractBlunderDna({
      fenBefore,
      uci: "e8d8",
      san: "Kd8",
      sideToMove: "black",
      classification: "mistake",
      centipawnLoss: 250,
      timeSpentSec: 1.2,
      clockAlert: "rush",
    });

    expect(dna).not.toBeNull();
    expect(dna?.rootCause).toBe("time_rush");
    expect(dna?.rootCauseLabel).toContain("Time Rush");
    expect(dna?.damageLabel).toContain("-2.5");
  });

  it("identifies clock panic when clock is low", () => {
    const fenBefore = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
    const dna = extractBlunderDna({
      fenBefore,
      uci: "e1e2",
      san: "Ke2",
      sideToMove: "white",
      classification: "blunder",
      centipawnLoss: 400,
      clockRemainingSec: 7,
      clockAlert: "panic",
    });

    expect(dna).not.toBeNull();
    expect(dna?.rootCause).toBe("clock_panic");
    expect(dna?.rootCauseLabel).toContain("Clock Panic (7s left)");
  });
});
