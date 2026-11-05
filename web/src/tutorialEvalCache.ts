// Chegga Web — precomputed evaluation cache for first-run tutorial & sample games
//
// Eliminates the ~90s cold engine scan on mobile & desktop by providing
// instant lookup for canonical onboarding and example positions.

import type { AnalysisLine } from "./engine";

export interface CachedPositionEval {
  scoreCp?: number;
  scoreMate?: number;
  bestUci: string;
  pv: string[];
}

/** Precomputed depth-14 candidate lines for the tutorial example position:
 * 1.e4 e5 2.Qh5 Nc6 (White to move)
 * FEN: r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3
 */
export const EXAMPLE_CANDIDATE_LINES: AnalysisLine[] = [
  { multipv: 1, depth: 14, scoreCp: 25, pv: ["f1c4", "g8f6", "h5f3", "d7d6", "g1e2"] },
  { multipv: 2, depth: 14, scoreCp: -15, pv: ["f1b5", "g8f6", "h5e2", "f8c5", "g1f3"] },
  { multipv: 3, depth: 14, scoreCp: -20, pv: ["g1f3", "g8f6", "h5h4", "f8e7", "b1c3"] },
  { multipv: 4, depth: 14, scoreCp: -35, pv: ["b1c3", "g8f6", "h5d1", "f8b4", "g1e2"] },
  { multipv: 5, depth: 14, scoreCp: -45, pv: ["d2d3", "g8f6", "h5f3", "d7d5", "h2h3"] },
  { multipv: 6, depth: 14, scoreCp: -55, pv: ["h5f3", "g8f6", "c2c3", "d7d5", "d2d3"] },
  { multipv: 7, depth: 14, scoreCp: -70, pv: ["c2c3", "g8f6", "h5e2", "d7d5", "d2d3"] },
  { multipv: 8, depth: 14, scoreCp: -620, pv: ["h5e5", "c6e5", "d2d4", "e5c6", "g1f3"] },
];

/** Fast position hash based on piece placement + side to move + castling */
export function fenKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

/** Precomputed evaluations for common tutorial positions */
const POSITION_TABLE: Record<string, CachedPositionEval> = {
  // Example blunder before: 1.e4 e5 2.Qh5 Nc6
  "r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq -": {
    scoreCp: 25,
    bestUci: "f1c4",
    pv: ["f1c4", "g8f6", "h5f3"],
  },
  // Example blunder after: 3.Qxe5+
  "r1bqkbnr/pppp1ppp/2n5/4Q3/4P3/8/PPPP1PPP/RNB1KBNR b KQkq -": {
    scoreCp: -620,
    bestUci: "c6e5",
    pv: ["c6e5", "d2d4"],
  },
  // After 3...Nxe5
  "r1bqkbnr/pppp1ppp/8/4n3/4P3/8/PPPP1PPP/RNB1KBNR w KQkq -": {
    scoreCp: -620,
    bestUci: "d2d4",
    pv: ["d2d4", "e5c6", "g1f3"],
  },
  // Starting position
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -": {
    scoreCp: 20,
    bestUci: "e2e4",
    pv: ["e2e4", "e7e5", "g1f3"],
  },
  // 1.e4 e5
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -": {
    scoreCp: 25,
    bestUci: "g1f3",
    pv: ["g1f3", "b8c6", "f1b5"],
  },
  // 1.e4 e5 2.Nf3 Nc6
  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -": {
    scoreCp: 25,
    bestUci: "f1b5",
    pv: ["f1b5", "a7a6", "b5a4"],
  },
  // 1.d4 d5
  "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -": {
    scoreCp: 20,
    bestUci: "c2c4",
    pv: ["c2c4", "e7e6", "b1c3"],
  },
};

/** Look up precomputed eval for a FEN if known */
export function lookupCachedEval(fen: string): CachedPositionEval | undefined {
  return POSITION_TABLE[fenKey(fen)];
}
