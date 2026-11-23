// Chegga Web — review insights: the numbers around one reviewed game
//
// Everything the review screen shows about a game as a whole, or about the
// two players at one moment of it: each side's accuracy (overall and per
// game phase), each side's move-quality counts, the material each side has
// taken, and each side's clock. Pure: no DOM, no engine, no storage.

import { Chess } from "chess.js";
import { gameAccuracy, moveAccuracy, sliceAccuracy } from "./accuracy";
import { positionWinChances, type ReviewGame } from "./gameReview";

export type Side = "white" | "black";
export type Phase = "opening" | "middlegame" | "endgame";

/** Tiers in the order a summary lists them, best first. */
export const SUMMARY_TIERS = ["brilliant", "best", "excellent", "good", "inaccuracy", "mistake", "miss", "blunder"] as const;

export interface SideSummary {
  accuracy?: number; // 0-100, one decimal is meaningful
  phases: Partial<Record<Phase, number>>; // accuracy per phase the side actually played moves in
  tally: Partial<Record<string, number>>; // tier -> count, display tiers (brilliant/miss included)
  graded: number; // how many of this side's moves the analysis covered
}

export interface GameSummary {
  white: SideSummary;
  black: SideSummary;
}

/** Accuracy, phase accuracy and move-quality counts for both players. Only
 * graded moves count; a partly analyzed game summarizes what it has. */
export function summarizeGame(review: ReviewGame): GameSummary {
  const wins = positionWinChances(review);
  const graded = review.steps.map((s) => !!s.classification);

  // The whole-game accuracy runs over the graded stretch only, so an
  // unanalyzed tail doesn't read as a run of perfect moves.
  const lastGraded = graded.lastIndexOf(true);
  const movers = review.steps.slice(0, lastGraded + 1).map((s) => s.side);
  const overall = lastGraded >= 0 ? gameAccuracy(wins.slice(0, lastGraded + 2), movers, graded) : {};

  const make = (side: Side): SideSummary => {
    const tally: Partial<Record<string, number>> = {};
    const byPhase: Partial<Record<Phase, number[]>> = {};
    let count = 0;
    review.steps.forEach((step, i) => {
      if (step.side !== side || !step.classification) return;
      count += 1;
      const tier = step.tier ?? step.classification;
      tally[tier] = (tally[tier] ?? 0) + 1;
      const mine = (w: number) => (side === "white" ? w : 100 - w);
      const acc = moveAccuracy(mine(wins[i]), mine(wins[i + 1]));
      const phase = step.gamePhase ?? "middlegame";
      (byPhase[phase] ??= []).push(acc);
    });
    const phases: Partial<Record<Phase, number>> = {};
    for (const phase of ["opening", "middlegame", "endgame"] as Phase[]) {
      const v = sliceAccuracy(byPhase[phase] ?? []);
      if (v !== undefined) phases[phase] = v;
    }
    return { accuracy: overall[side], phases, tally, graded: count };
  };
  return { white: make("white"), black: make("black") };
}

/** A one-word read of an accuracy score, for the phase chips. */
export function accuracyWord(acc: number): string {
  if (acc >= 90) return "Excellent";
  if (acc >= 80) return "Good";
  if (acc >= 65) return "Shaky";
  return "Rough";
}

const PIECE_POINTS: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const START_COUNT: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const PIECE_ORDER = ["q", "r", "b", "n", "p"];

export interface MaterialState {
  /** Pieces each side has taken from the other, most valuable first ("q", "r", ...). */
  capturedBy: Record<Side, string[]>;
  /** Material lead in pawns for each side (0 for the side that isn't ahead). */
  lead: Record<Side, number>;
}

/** What each side has taken so far, read off the position alone. A pawn
 * that promoted reads as a pawn gone and a piece gained, the way the big
 * sites show it. */
export function materialState(fen: string): MaterialState {
  const counts: Record<Side, Record<string, number>> = {
    white: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    black: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };
  let board: ReturnType<Chess["board"]>;
  try {
    board = new Chess(fen).board();
  } catch {
    return { capturedBy: { white: [], black: [] }, lead: { white: 0, black: 0 } };
  }
  for (const row of board) {
    for (const cell of row) {
      if (!cell || cell.type === "k") continue;
      counts[cell.color === "w" ? "white" : "black"][cell.type] += 1;
    }
  }
  const missing = (side: Side) =>
    PIECE_ORDER.flatMap((t) => Array(Math.max(0, START_COUNT[t] - counts[side][t])).fill(t) as string[]);
  const points = (side: Side) => PIECE_ORDER.reduce((a, t) => a + counts[side][t] * PIECE_POINTS[t], 0);
  const diff = points("white") - points("black");
  return {
    capturedBy: { white: missing("black"), black: missing("white") },
    lead: { white: Math.max(0, diff), black: Math.max(0, -diff) },
  };
}

/** Seconds left on `side`'s clock with the board at step `index` (-1 =
 * the start). The last clock that side recorded at or before that point,
 * or the starting time before their first move. Undefined when the PGN
 * carries no clocks at all. */
export function clockAt(review: ReviewGame, index: number, side: Side): number | undefined {
  const hasClocks = review.steps.some((s) => s.clockRemainingSec !== undefined);
  if (!hasClocks) return undefined;
  for (let i = Math.min(index, review.steps.length - 1); i >= 0; i--) {
    const step = review.steps[i];
    if (step.side === side && step.clockRemainingSec !== undefined) return step.clockRemainingSec;
  }
  return review.baseClockSec;
}

/** "4:05", "0:09", "1:02:30", "9.4" (tenths under ten seconds, the way a
 * blitz clock reads). */
export function formatClock(sec: number): string {
  if (sec < 10) return sec.toFixed(1);
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

/** The engine's verdict with the board at step `index` (-1 = the start),
 * White-relative: centipawns or a mate count. */
export function evalAt(review: ReviewGame, index: number): { cp?: number; mate?: number } | null {
  if (index < 0) {
    const first = review.steps[0];
    if (!first || (first.evalBeforeCp === undefined && first.evalBeforeMate === undefined)) return null;
    return { cp: first.evalBeforeCp, mate: first.evalBeforeMate };
  }
  for (let i = Math.min(index, review.steps.length - 1); i >= 0; i--) {
    const s = review.steps[i];
    if (s.evalAfterCp !== undefined || s.evalAfterMate !== undefined) return { cp: s.evalAfterCp, mate: s.evalAfterMate };
  }
  return null;
}
