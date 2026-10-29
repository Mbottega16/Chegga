import { describe, it, expect } from "vitest";
import {
  computeThinkingSweetSpot,
  computeTiltIndex,
  computeMirrorOfHabits,
} from "../../src/gamePatterns";
import { move } from "./_factories";

describe("gamePatterns insights", () => {
  describe("computeThinkingSweetSpot", () => {
    it("groups moves into time buckets and identifies the sweet spot", () => {
      const moves = [
        // 3 rushed moves with blunders
        move({ classification: "blunder", timeSpentSec: 1.1, centipawnLoss: 300 }),
        move({ classification: "blunder", timeSpentSec: 0.9, centipawnLoss: 400 }),
        move({ classification: "good", timeSpentSec: 1.5, centipawnLoss: 20 }),

        // 4 measured moves with high accuracy
        move({ classification: "best", timeSpentSec: 7.2, centipawnLoss: 0 }),
        move({ classification: "best", timeSpentSec: 8.0, centipawnLoss: 0 }),
        move({ classification: "excellent", timeSpentSec: 6.5, centipawnLoss: 10 }),
        move({ classification: "best", timeSpentSec: 9.1, centipawnLoss: 0 }),
      ];

      const res = computeThinkingSweetSpot(moves);
      expect(res.sweetSpotLabel).toBe("5-10s (Measured)");
      expect(res.sweetSpotAccuracy).toBe(100);
      expect(res.rushBlunderPenalty).toBeGreaterThan(0);
    });
  });

  describe("computeTiltIndex", () => {
    it("detects blunder streaks within a game", () => {
      const moves = [
        move({ gameId: "g1", ply: 10, classification: "blunder" }),
        move({ gameId: "g1", ply: 12, classification: "blunder" }), // immediately following own-move!
        move({ gameId: "g1", ply: 14, classification: "good" }),
      ];

      const tilt = computeTiltIndex(moves);
      expect(tilt.totalBlunders).toBe(2);
      expect(tilt.clusteredBlunders).toBe(1);
      expect(tilt.clusterRate).toBe(50);
    });

    it("tracks post-mistake rush rate", () => {
      const moves = [
        move({ gameId: "g1", ply: 10, classification: "mistake" }),
        move({ gameId: "g1", ply: 12, classification: "blunder", timeSpentSec: 1.2 }), // rushed after mistake!
      ];

      const tilt = computeTiltIndex(moves);
      expect(tilt.postMistakeRushRate).toBe(100);
    });
  });

  describe("computeMirrorOfHabits", () => {
    it("aggregates tactical leaks by motif and finds the most endangered piece", () => {
      const moves = [
        move({ classification: "blunder", blunderTag: "fork", san: "Nf6" }),
        move({ classification: "blunder", blunderTag: "fork", san: "Nd7" }),
        move({ classification: "mistake", blunderTag: "pin", san: "Be7" }),
        move({ classification: "blunder", blunderTag: "back_rank", san: "Kh1" }),
      ];

      const mirror = computeMirrorOfHabits(moves);
      expect(mirror.topLeaks.length).toBeGreaterThanOrEqual(3);
      expect(mirror.topLeaks[0].motif).toBe("fork");
      expect(mirror.topLeaks[0].count).toBe(2);
      expect(mirror.mostEndangeredPiece?.piece).toBe("Knight");
      expect(mirror.mostEndangeredPiece?.count).toBe(2);
    });
  });
});
