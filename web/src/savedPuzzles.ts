// Chegga Web — turning a reviewed position into a puzzle to keep
//
// The auto-extracted puzzles (puzzleTrainer.ts's extractPuzzles) are every
// mistake in every analyzed game. These are the ones a viewer chose while
// reviewing a game -- or the few worst moments of that game, saved in one
// tap. A saved puzzle carries everything practice needs (position, the
// move played, the engine's move), so it stays usable after the game
// itself is gone, and it works for a bot game, whose analysis isn't stored.
//
// Pure: no DOM, no storage. db.ts holds the store.

import type { ReviewGame, ReviewStep } from "./gameReview";
import { canPracticeStep } from "./gameReview";
import { difficultyFor, type Puzzle } from "./puzzleTrainer";
import type { SavedPuzzleRecord } from "./db";

export const SPACED_INTERVAL_MS: Record<number, number> = {
  1: 1 * 24 * 60 * 60 * 1000, // 1 day
  2: 3 * 24 * 60 * 60 * 1000, // 3 days
  3: 7 * 24 * 60 * 60 * 1000, // 7 days
  4: 14 * 24 * 60 * 60 * 1000, // 14 days
  5: 30 * 24 * 60 * 60 * 1000, // 30 days (mastered)
};

export function isDueForReview(record: SavedPuzzleRecord, now = Date.now()): boolean {
  if (!record.nextDueAt) return true;
  return record.nextDueAt <= now;
}

export function advanceSpacedRepetition(
  record: SavedPuzzleRecord,
  correct: boolean,
  now = Date.now(),
): SavedPuzzleRecord {
  const currentBox = record.box ?? 1;
  const reviewCount = (record.reviewCount ?? 0) + 1;
  if (correct) {
    const nextBox = Math.min(5, currentBox + 1);
    const interval = SPACED_INTERVAL_MS[nextBox] ?? SPACED_INTERVAL_MS[1];
    return {
      ...record,
      box: nextBox,
      nextDueAt: now + interval,
      reviewCount,
      lastReviewedAt: now,
    };
  } else {
    return {
      ...record,
      box: 1,
      nextDueAt: now + SPACED_INTERVAL_MS[1],
      reviewCount,
      lastReviewedAt: now,
    };
  }
}

export function describeSpacedBox(box = 1): string {
  switch (box) {
    case 1:
      return "Box 1 (Daily)";
    case 2:
      return "Box 2 (3d)";
    case 3:
      return "Box 3 (1w)";
    case 4:
      return "Box 4 (2w)";
    case 5:
      return "Mastered 🏆";
    default:
      return `Box ${box}`;
  }
}

/** Same id extractPuzzles gives the same move (`${gameId}:${ply}`), so a
 * saved position and the auto-extracted one share spaced-repetition
 * progress. A bot game has no stored id, so its positions are keyed by the
 * position and the move. */
export function puzzleIdFor(review: ReviewGame, step: ReviewStep): string {
  if (review.gameId) return `${review.gameId}:${step.ply}`;
  const position = step.fenBefore.split(" ").slice(0, 4).join(" ");
  return `bot:${position}:${step.uci}`;
}

export function puzzleFromStep(review: ReviewGame, step: ReviewStep, openingName?: string): Puzzle | null {
  if (!canPracticeStep(step) || !step.bestMoveUci || !step.bestMoveSan) return null;
  const loss = step.centipawnLoss ?? 0;
  return {
    id: puzzleIdFor(review, step),
    gameId: review.gameId ?? "bot",
    ply: step.ply,
    fenBefore: step.fenBefore,
    sideToMove: step.side,
    playedSan: step.san,
    playedUci: step.uci,
    bestMoveUci: step.bestMoveUci,
    bestMoveSan: step.bestMoveSan,
    centipawnLoss: loss,
    classification: step.classification ?? "mistake",
    difficulty: difficultyFor(loss),
    openingName,
    gamePhase: step.gamePhase ?? "middlegame",
    blunderTag: step.blunderTag,
  };
}

/** A short line for a saved-position card: "Middlegame · lost 2.3 pawns". */
export function describeSavedPuzzle(p: Puzzle): string {
  const phase = p.gamePhase.charAt(0).toUpperCase() + p.gamePhase.slice(1);
  return `${phase} · lost ${(p.centipawnLoss / 100).toFixed(1)} pawns with ${p.playedSan}`;
}
