// Chegga Web — game review: the step-through model behind the review screen
//
// The front page narrowed to one thing (2026-09-14): the single-game
// review moment. The grading already existed -- engineAnalysis.ts grades
// every move of every game -- but nothing let you look back at one game
// move by move, so the move-quality colors only ever appeared live, for
// one move, during a bot game. This module is the missing middle: it
// joins a PGN to the MoveAnalysisRecord[] that grading produced and
// hands back one step per half-move, ready to put on a board.
//
// Pure: no DOM, no engine, no storage. The view (gameReviewView.ts) and
// the wiring (main.ts) sit on top. Deliberately takes the records rather
// than the engine, so the same review works for a finished bot game, a
// pasted PGN, or a synced Chess.com game already analyzed in IndexedDB.

import { Chess, type Square } from "chess.js";
import type { MoveAnalysisRecord } from "./db";
import { CLASSIFICATION_ORDER } from "./classificationColors";
import { clocksByFen, parseTimeControlBaseSeconds, parseTimeControlIncrementSeconds, timeSpentSeconds } from "./clockParser";
import { extractBlunderDna, type BlunderDna } from "./blunderTagger";
import { isSacrifice } from "./candidateMoves";
import { winChance } from "./accuracy";

export interface ReviewStep {
  ply: number; // 1-based half-move, same convention as MoveAnalysisRecord.ply
  moveNumber: number; // 1-based full move ("12." / "12...")
  side: "white" | "black";
  isHuman: boolean; // the reviewer's own move, as opposed to the opponent's
  san: string;
  from: Square;
  to: Square;
  uci: string; // the move as UCI ("e2e4", "e7e8q")
  fenBefore: string; // the position the move was chosen in -- what "the best move here" is about
  fenAfter: string; // the position this step puts on the board
  // Grading, present only when analysis covered this ply -- a partly
  // analyzed game still reviews, it just has ungraded steps.
  classification?: string;
  // The tier the review shows. Usually the stored classification, but a
  // "best" move that is also a real sacrifice reads as brilliant, and a
  // slip right after the opponent's own mistake reads as a miss (the gift
  // was not taken). Both are decided here, at review time, never stored,
  // so profile stats keep counting the stored tiers.
  tier?: string;
  centipawnLoss?: number;
  bestMoveSan?: string;
  bestMoveUci?: string;
  // Extra facts from the same record, carried so the explanation and the
  // candidate view can say more than a tier. Evals are White-relative.
  blunderTag?: string;
  blunderDna?: BlunderDna;
  moveRank?: number;
  gamePhase?: "opening" | "middlegame" | "endgame";
  evalBeforeCp?: number;
  evalBeforeMate?: number;
  evalAfterCp?: number;
  evalAfterMate?: number;
  // Clock data from PGN %clk annotations, when present.
  clockRemainingSec?: number;
  timeSpentSec?: number;
  clockAlert?: "panic" | "rush";
}

export interface ReviewPlayer {
  name?: string;
  rating?: number;
}

export interface ReviewGame {
  gameId?: string; // the synced game's id, when there is one -- a bot game or a pasted PGN has none
  pgn: string; // kept so a caller can rebuild the real game (e.g. Undo after a review)
  startFen: string; // the position before ply 1 -- not always the standard start (handicap games)
  humanColor: "white" | "black";
  steps: ReviewStep[];
  // From the PGN headers, when the PGN has them.
  players: { white: ReviewPlayer; black: ReviewPlayer };
  result?: string; // "1-0" | "0-1" | "1/2-1/2"
  baseClockSec?: number; // the time control's starting clock
}

/** Board labels for a review, one per tier. Live play deliberately labels
 * only the top two tiers (encouragement while you're still playing --
 * see main.ts's MOVE_QUALITY_LABELS); a review is for finding out what
 * happened, so every tier says what it was. */
export const REVIEW_QUALITY_LABELS: Record<string, string> = {
  brilliant: "Brilliant!", // never stored -- buildReview upgrades a sacrificial "best" (ReviewStep.tier)
  best: "Best!",
  excellent: "Excellent",
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
  miss: "Miss", // never stored -- see missedChance()
};

/** Tiers where the engine's own preference is worth showing -- naming a
 * better move after a move that was already best/excellent/good is noise. */
const SHOW_BETTER_MOVE_FOR = new Set(["inaccuracy", "mistake", "blunder"]);

export function shouldShowBetterMove(step: ReviewStep): boolean {
  if (!step.classification || !step.bestMoveSan) return false;
  if (step.bestMoveSan === step.san) return false;
  return SHOW_BETTER_MOVE_FOR.has(step.classification);
}

/** The engine's move belongs to the position BEFORE the step, but the board
 * shows the position AFTER it. If the better move starts on a square the
 * played move just left or landed on, an arrow drawn on the "after" board
 * would start from an empty square (or from the wrong piece), so it is
 * skipped there. The "before" view draws it correctly in every case. */
export function betterMoveArrowFitsAfterBoard(step: ReviewStep): boolean {
  if (!step.bestMoveUci) return false;
  const from = step.bestMoveUci.slice(0, 2);
  return from !== step.from && from !== step.to;
}

/** A step worth turning into a puzzle: the reviewer's own move that lost
 * something, where the engine had a different move in mind. */
export function canPracticeStep(step: ReviewStep): boolean {
  return step.isHuman && !!step.bestMoveUci && step.bestMoveUci !== step.uci && shouldShowBetterMove(step);
}

/** One step per half-move of `pgn`, graded from whichever `moves` records
 * match by ply. Records for other games (or other plies) are ignored, so
 * passing a whole account's analysis rows is harmless. */
export function buildReview(
  pgn: string,
  moves: MoveAnalysisRecord[],
  humanColor: "white" | "black",
  gameId?: string,
): ReviewGame {
  const chess = new Chess();
  chess.loadPgn(pgn);
  // A handicap/"from position" game carries its own start in the PGN
  // headers; chess.js writes FEN + SetUp there when a game didn't begin
  // from the standard position.
  const startFen = chess.getHeaders().FEN ?? new Chess().fen();
  const byPly = new Map(moves.map((m) => [m.ply, m]));

  const timeControl = chess.getHeaders().TimeControl;
  const baseSeconds = timeControl ? parseTimeControlBaseSeconds(timeControl) : undefined;
  const incrementSeconds = timeControl ? parseTimeControlIncrementSeconds(timeControl) : 0;
  const clocks = clocksByFen(chess.getComments());

  let lastWhiteClock = baseSeconds;
  let lastBlackClock = baseSeconds;

  const steps: ReviewStep[] = chess.history({ verbose: true }).map((move, i) => {
    const ply = i + 1;
    const side: "white" | "black" = move.color === "w" ? "white" : "black";
    const record = byPly.get(ply);
    // Guard against records from a different game sharing the ply number.
    const graded = record && record.san === move.san ? record : undefined;

    const clockRemainingSec = clocks.get(move.after);
    let timeSpentSec: number | undefined;
    if (clockRemainingSec !== undefined) {
      const prior = side === "white" ? lastWhiteClock : lastBlackClock;
      if (prior !== undefined) timeSpentSec = timeSpentSeconds(prior, clockRemainingSec, incrementSeconds);
      if (side === "white") lastWhiteClock = clockRemainingSec;
      else lastBlackClock = clockRemainingSec;
    }

    let clockAlert: "panic" | "rush" | undefined;
    if (clockRemainingSec !== undefined && clockRemainingSec <= 10) {
      clockAlert = "panic";
    } else if (
      timeSpentSec !== undefined &&
      timeSpentSec <= 2.5 &&
      side === humanColor &&
      (graded?.classification === "blunder" || graded?.classification === "mistake")
    ) {
      clockAlert = "rush";
    }

      const blunderDna =
        graded && (graded.classification === "mistake" || graded.classification === "blunder")
          ? extractBlunderDna({
              fenBefore: move.before,
              uci: move.from + move.to + (move.promotion ?? ""),
              san: move.san,
              classification: graded.classification,
              sideToMove: side,
              centipawnLoss: graded.centipawnLoss,
              evalBeforeMate: graded.evalBeforeMate,
              evalAfterMate: graded.evalAfterMate,
              bestMoveSan: graded.bestMoveSan,
              clockRemainingSec,
              timeSpentSec,
              clockAlert,
            }) ?? undefined
          : undefined;

      return {
        ply,
        moveNumber: Math.floor(i / 2) + 1,
        side,
        isHuman: side === humanColor,
        san: move.san,
        from: move.from,
        to: move.to,
        uci: move.from + move.to + (move.promotion ?? ""),
        fenBefore: move.before,
        fenAfter: move.after,
        classification: graded?.classification,
        centipawnLoss: graded?.centipawnLoss,
        bestMoveSan: graded?.bestMoveSan,
        bestMoveUci: graded?.bestMoveUci,
        blunderTag: graded?.blunderTag,
        blunderDna,
        moveRank: graded?.moveRank,
        gamePhase: graded?.gamePhase,
        evalBeforeCp: graded?.evalBeforeCp,
        evalBeforeMate: graded?.evalBeforeMate,
        evalAfterCp: graded?.evalAfterCp,
        evalAfterMate: graded?.evalAfterMate,
        clockRemainingSec,
        timeSpentSec,
        clockAlert,
      };
    });

  const headers = chess.getHeaders();
  const rating = (v: string | undefined) => {
    const n = v ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const players = {
    white: { name: headers.White && headers.White !== "?" ? headers.White : undefined, rating: rating(headers.WhiteElo) },
    black: { name: headers.Black && headers.Black !== "?" ? headers.Black : undefined, rating: rating(headers.BlackElo) },
  };
  const result = headers.Result && headers.Result !== "*" ? headers.Result : undefined;

  const review: ReviewGame = { gameId, pgn, startFen, humanColor, steps, players, result, baseClockSec: baseSeconds };
  const wins = positionWinChances(review);
  steps.forEach((step, i) => {
    if (!step.classification) return;
    if (step.classification === "best" && isSacrifice(step.fenBefore, step.uci)) step.tier = "brilliant";
    else if (missedChance(review, i, wins)) step.tier = "miss";
    else step.tier = step.classification;
  });
  return review;
}

/** White's winning chance (0-100) at every position of the game: index 0
 * is the start, index i+1 the position after step i. A stretch the
 * analysis didn't cover holds the last known value. */
export function positionWinChances(review: ReviewGame): number[] {
  const out: number[] = [];
  let last = 50;
  const first = review.steps[0];
  if (first && (first.evalBeforeCp !== undefined || first.evalBeforeMate !== undefined)) {
    last = winChance(first.evalBeforeCp, first.evalBeforeMate);
  }
  out.push(last);
  for (const step of review.steps) {
    if (step.evalAfterCp !== undefined || step.evalAfterMate !== undefined) {
      last = winChance(step.evalAfterCp, step.evalAfterMate);
    }
    out.push(last);
  }
  return out;
}

const MISSABLE_GIFT = new Set(["mistake", "blunder"]);
const SLIP = new Set(["inaccuracy", "mistake", "blunder"]);

/** A "miss": the opponent's last move was a mistake that handed this side
 * real winning chances, and this move gave most of that gift back without
 * throwing the game outright (a move that swings the game to losing stays
 * a blunder). Thresholds are in winning-chance points, 0-100. */
export function missedChance(review: ReviewGame, index: number, wins = positionWinChances(review)): boolean {
  const step = review.steps[index];
  const prev = review.steps[index - 1];
  if (!step || !prev || !step.classification || !prev.classification) return false;
  if (!MISSABLE_GIFT.has(prev.classification) || !SLIP.has(step.classification)) return false;
  const mine = (w: number) => (step.side === "white" ? w : 100 - w);
  const beforeGift = mine(wins[index - 1]);
  const before = mine(wins[index]);
  const after = mine(wins[index + 1]);
  const gift = before - beforeGift;
  return gift >= 10 && before >= 60 && before - after >= 10 && after >= 35;
}

export interface PunishmentPreview {
  punishmentSan: string;
  punishmentUci: string;
  source: "engine" | "played";
  fenAfterPunishment: string;
  from: Square;
  to: Square;
}

export function getPunishmentForStep(review: ReviewGame, stepIndex: number): PunishmentPreview | null {
  const step = review.steps[stepIndex];
  if (!step || !step.isHuman || (step.classification !== "blunder" && step.classification !== "mistake")) {
    return null;
  }

  const nextStep = review.steps[stepIndex + 1];
  let uci = nextStep?.bestMoveUci || nextStep?.uci;
  let san = nextStep?.bestMoveSan || nextStep?.san;
  let source: "engine" | "played" = nextStep?.bestMoveUci ? "engine" : "played";

  if (!uci && step.blunderDna?.attackerSquare && step.blunderDna?.victimSquare) {
    uci = step.blunderDna.attackerSquare + step.blunderDna.victimSquare;
    san = `${step.blunderDna.attackerPiece?.toUpperCase() || ""}x${step.blunderDna.victimSquare}`;
    source = "engine";
  }

  if (!uci || uci.length < 4) return null;

  try {
    const board = new Chess(step.fenAfter);
    const m = board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || undefined });
    if (!m) return null;
    return {
      punishmentSan: san || m.san,
      punishmentUci: uci,
      source,
      fenAfterPunishment: board.fen(),
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
    };
  } catch {
    return null;
  }
}

/** The reviewer's costliest mistakes and blunders, worst first -- the
 * "critical positions" of one game, the ones worth practicing. Only moves
 * with a concrete better move qualify. */
export function keyMoments(review: ReviewGame, count = 3): ReviewStep[] {
  return review.steps
    .filter((s) => canPracticeStep(s) && (s.classification === "mistake" || s.classification === "blunder"))
    .sort((a, b) => (b.centipawnLoss ?? 0) - (a.centipawnLoss ?? 0))
    .slice(0, count);
}

/** How many of the reviewer's own moves landed in each tier, in the
 * shared CLASSIFICATION_ORDER. Tiers with no moves are left out. */
export function tallyHumanQuality(review: ReviewGame): { classification: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const step of review.steps) {
    if (!step.isHuman || !step.classification) continue;
    counts.set(step.classification, (counts.get(step.classification) ?? 0) + 1);
  }
  return CLASSIFICATION_ORDER.filter((c) => counts.has(c)).map((c) => ({
    classification: c,
    count: counts.get(c)!,
  }));
}

/** Index of the reviewer's costliest graded move, or -1 if the game has
 * none (nothing analyzed, or every own move was already best). This is
 * the "take me to the moment it went wrong" jump. */
export function worstHumanStepIndex(review: ReviewGame): number {
  let worst = -1;
  let worstLoss = 0;
  review.steps.forEach((step, i) => {
    if (!step.isHuman || step.centipawnLoss === undefined) return;
    if (step.centipawnLoss > worstLoss) {
      worstLoss = step.centipawnLoss;
      worst = i;
    }
  });
  return worst;
}

/** "12. Nf3" / "12... Nf6" — the way a move reads in a move list. */
export function moveLabel(step: ReviewStep): string {
  return `${step.moveNumber}.${step.side === "white" ? "" : ".."} ${step.san}`;
}

/** The caption under the board. `index` is -1 for the starting position. */
export function describeStep(review: ReviewGame, index: number): string {
  if (index < 0) {
    return review.steps.length
      ? "Starting position. Step forward to replay the game one move at a time."
      : "No moves to review yet.";
  }
  const step = review.steps[index];
  if (!step) return "";

  const parts = [moveLabel(step)];
  const tier = step.tier ?? step.classification;
  if (!step.isHuman) {
    // The opponent's grade, without the cost or the engine's line: the
    // review is about the reviewer's own play, but knowing the other side
    // blundered is half of understanding what happened next.
    const label = tier ? REVIEW_QUALITY_LABELS[tier] ?? tier : undefined;
    parts.push(label ? `— your opponent's move: ${label.replace(/!$/, "")}.` : "— your opponent's move.");
  } else if (!step.classification || !tier) {
    parts.push("— your move (not graded).");
  } else if (tier === "miss") {
    const loss = step.centipawnLoss ?? 0;
    parts.push(`— Miss, ${loss}cp lost. Your opponent's last move handed you a chance, and this let it go.`);
    if (step.bestMoveSan && step.bestMoveSan !== step.san) parts.push(`${step.bestMoveSan} would have kept it.`);
  } else {
    const label = REVIEW_QUALITY_LABELS[tier] ?? tier;
    const loss = step.centipawnLoss ?? 0;
    // The top tier never quotes its centipawns: "Best!, 7cp lost" reads as
    // a contradiction, and a few centipawns off the engine's own line is
    // exactly what the tier already means. Every other tier shows the cost.
    // "Best!" also already ends in punctuation, so it gets no second mark.
    const showLoss = loss > 0 && step.classification !== "best";
    const tail = showLoss ? `, ${loss}cp lost.` : label.endsWith("!") ? "" : ".";
    parts.push(`— ${label}${tail}`);
    if (shouldShowBetterMove(step)) parts.push(`Engine preferred ${step.bestMoveSan}.`);
  }
  if (step.clockAlert === "panic" && step.clockRemainingSec !== undefined) {
    parts.push(`⏱️ Panic: only ${Math.round(step.clockRemainingSec)}s left!`);
  } else if (step.clockAlert === "rush" && step.timeSpentSec !== undefined) {
    parts.push(`Rushed: played in ${step.timeSpentSec}s.`);
  } else if (step.timeSpentSec !== undefined) {
    parts.push(`(${step.timeSpentSec}s)`);
  }
  return parts.join(" ");
}

/** The caption for the "position before the move" view. */
export function describeBefore(review: ReviewGame, index: number): string {
  const step = review.steps[index];
  if (!step) return "";
  const who = step.isHuman ? "you played" : "your opponent played";
  const parts = [`Position before ${moveLabel(step)} — ${who} ${step.san}`];
  if (step.classification && step.isHuman) {
    parts[0] += ` (${REVIEW_QUALITY_LABELS[step.classification] ?? step.classification})`;
  }
  parts[0] += ".";
  if (step.bestMoveSan && step.bestMoveSan !== step.san) {
    parts.push(`The engine's top choice was ${step.bestMoveSan}.`);
  } else if (step.bestMoveSan) {
    parts.push("That was also the engine's top choice.");
  }
  return parts.join(" ");
}


export interface StorylineMoment {
  index: number;
  ply: number;
  moveNumber: number;
  side: "white" | "black";
  isHuman: boolean;
  san: string;
  classification?: string;
  kind: "turning_point" | "blunder" | "brilliant" | "great" | "mistake" | "missed_mate";
  badge: string;
  headline: string;
  scoreSwingCp: number;
}

/** Extracts the 3-6 critical turning points and narrative moments across the game. */
export function computeStorylineMoments(review: ReviewGame): StorylineMoment[] {
  if (!review.steps.length) return [];
  const moments: StorylineMoment[] = [];
  let maxSwing = 0;
  let maxSwingIndex = -1;

  for (let i = 0; i < review.steps.length; i++) {
    const step = review.steps[i];
    // Brilliant is a review-time tier (ReviewStep.tier); the rest read the stored grade.
    const tier = step.tier === "brilliant" ? "brilliant" : step.classification;
    const loss = step.centipawnLoss ?? 0;

    const prevCp = i > 0 ? (review.steps[i - 1].evalAfterCp ?? 0) : 0;
    const curCp = step.evalAfterCp ?? 0;
    const swing = Math.abs(curCp - prevCp);

    if (swing > maxSwing && (loss >= 150 || Math.abs(curCp) >= 200)) {
      maxSwing = swing;
      maxSwingIndex = i;
    }

    if (tier === "brilliant") {
      moments.push({
        index: i,
        ply: step.ply,
        moveNumber: step.moveNumber,
        side: step.side,
        isHuman: step.isHuman,
        san: step.san,
        classification: tier,
        kind: "brilliant",
        badge: "!!",
        headline: "Brilliant Move",
        scoreSwingCp: swing,
      });
    } else if (tier === "blunder") {
      const motif = step.blunderDna?.motif ? step.blunderDna.motif.replace(/_/g, " ") : step.blunderTag?.replace(/_/g, " ");
      const tag = motif ? ` (${motif})` : "";
      moments.push({
        index: i,
        ply: step.ply,
        moveNumber: step.moveNumber,
        side: step.side,
        isHuman: step.isHuman,
        san: step.san,
        classification: tier,
        kind: step.blunderTag === "missed_mate" ? "missed_mate" : "blunder",
        badge: step.blunderTag === "missed_mate" ? "♚" : "??",
        headline: step.blunderTag === "missed_mate" ? "Missed Mate" : `Blunder${tag}`,
        scoreSwingCp: loss,
      });
    } else if (tier === "mistake" && loss >= 200) {
      moments.push({
        index: i,
        ply: step.ply,
        moveNumber: step.moveNumber,
        side: step.side,
        isHuman: step.isHuman,
        san: step.san,
        classification: tier,
        kind: "mistake",
        badge: "?",
        headline: `Mistake (-${(loss / 100).toFixed(1)})`,
        scoreSwingCp: loss,
      });
    } else if (tier === "great" && step.isHuman) {
      moments.push({
        index: i,
        ply: step.ply,
        moveNumber: step.moveNumber,
        side: step.side,
        isHuman: step.isHuman,
        san: step.san,
        classification: tier,
        kind: "great",
        badge: "!",
        headline: "Great Move",
        scoreSwingCp: swing,
      });
    }
  }

  if (maxSwingIndex >= 0) {
    const existing = moments.find((m) => m.index === maxSwingIndex);
    if (existing) {
      existing.kind = "turning_point";
      existing.badge = "⚡";
      existing.headline = `Turning Point (${existing.headline})`;
    } else {
      const step = review.steps[maxSwingIndex];
      moments.push({
        index: maxSwingIndex,
        ply: step.ply,
        moveNumber: step.moveNumber,
        side: step.side,
        isHuman: step.isHuman,
        san: step.san,
        classification: step.classification,
        kind: "turning_point",
        badge: "⚡",
        headline: `Turning Point (${(maxSwing / 100).toFixed(1)} pawns)`,
        scoreSwingCp: maxSwing,
      });
    }
  }

  moments.sort((a, b) => a.ply - b.ply);
  return moments.length > 6 ? moments.slice(0, 6) : moments;
}
