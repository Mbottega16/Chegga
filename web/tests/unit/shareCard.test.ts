import { describe, it, expect } from "vitest";
import { buildShareCardData, drawShareCard, type ShareCardData } from "../../src/shareCard";
import { buildReview } from "../../src/gameReview";
import { move } from "./_factories";

const PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[White "MagnusCarlsen"]
[Black "Hikaru"]
[Result "1-0"]
[WhiteElo "2882"]
[BlackElo "2875"]
[Opening "Ruy Lopez: Berlin Defense"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6`;

const GRADES = [
  move({ ply: 1, san: "e4", sideToMove: "white", classification: "best", centipawnLoss: 0, evalAfterCp: 25 }),
  move({ ply: 2, san: "e5", sideToMove: "black", classification: "best", centipawnLoss: 0, evalAfterCp: 20 }),
  move({ ply: 3, san: "Nf3", sideToMove: "white", classification: "excellent", centipawnLoss: 15, evalAfterCp: 35 }),
  move({ ply: 4, san: "Nc6", sideToMove: "black", classification: "good", centipawnLoss: 30, evalAfterCp: 40 }),
  move({ ply: 5, san: "Bb5", sideToMove: "white", classification: "best", centipawnLoss: 5, evalAfterCp: 45 }),
  move({ ply: 6, san: "Nf6", sideToMove: "black", classification: "blunder", centipawnLoss: 320, evalAfterCp: 365 }),
];

describe("buildShareCardData", () => {
  it("extracts header information and ratings correctly", () => {
    const review = buildReview(PGN, GRADES, "white");
    const data = buildShareCardData(review);

    expect(data.white).toBe("MagnusCarlsen");
    expect(data.black).toBe("Hikaru");
    expect(data.whiteRating).toBe("2882");
    expect(data.blackRating).toBe("2875");
    expect(data.result).toBe("1-0");
    expect(data.opening).toBe("Ruy Lopez: Berlin Defense");
  });

  it("calculates accuracy and move tallies for human moves", () => {
    const review = buildReview(PGN, GRADES, "white");
    const data = buildShareCardData(review);

    // White human moves: 3 (best, excellent, best) -> avg cp loss ~6.6cp
    expect(data.totalMoves).toBe(3);
    expect(data.accuracy).toBeGreaterThanOrEqual(90);
    expect(data.avgCentipawnLoss).toBeLessThan(15);

    const bestTally = data.tallies.find((t) => t.tier === "best");
    expect(bestTally?.count).toBe(2);

    const excTally = data.tallies.find((t) => t.tier === "excellent");
    expect(excTally?.count).toBe(1);
  });

  it("extracts eval flow scores clamped to +/- 8 pawns", () => {
    const review = buildReview(PGN, GRADES, "white");
    const data = buildShareCardData(review);

    expect(data.evalScores.length).toBe(6);
    expect(data.evalScores[0]).toBeCloseTo(0.25, 2);
    expect(data.evalScores[5]).toBeCloseTo(3.65, 2);
  });

  it("handles empty games gracefully without crashing", () => {
    const review = buildReview("", [], "white");
    const data = buildShareCardData(review);

    expect(data.white).toBe("You");
    expect(data.black).toBe("Opponent");
    expect(data.accuracy).toBe(85);
    expect(data.tallies).toEqual([]);
    expect(data.evalScores).toEqual([]);
  });

  it("renders through drawShareCard on a mocked canvas context", () => {
    const review = buildReview(PGN, GRADES, "white");
    const data = buildShareCardData(review);

    const calls: string[] = [];
    const mockCtx = {
      createLinearGradient: () => ({ addColorStop: () => {} }),
      fillRect: () => calls.push("fillRect"),
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      beginPath: () => calls.push("beginPath"),
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      closePath: () => {},
      stroke: () => calls.push("stroke"),
      fill: () => calls.push("fill"),
      fillText: () => calls.push("fillText"),
      measureText: () => ({ width: 100 }),
      setLineDash: () => {},
    } as unknown as CanvasRenderingContext2D;

    drawShareCard(mockCtx, data, 1200, 675);
    expect(calls).toContain("fillRect");
    expect(calls).toContain("fillText");
    expect(calls).toContain("stroke");
  });
});
