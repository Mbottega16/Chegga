// Chegga Web — the one Leitner ladder
//
// Saved positions (savedPuzzles.ts) and trainer puzzles (puzzleProgress.ts)
// both come back on this ladder. A right answer moves a puzzle up one box,
// to a longer wait. A wrong answer sends it back to box 1.

export const LEITNER_MAX_BOX = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days to wait before a puzzle in each box comes due again. */
export const LEITNER_DAYS: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };

/** Milliseconds to wait for a box. A box outside 1-5 uses the nearest one. */
export function leitnerDelayMs(box: number): number {
  const clamped = Math.max(1, Math.min(Math.floor(box), LEITNER_MAX_BOX));
  return LEITNER_DAYS[clamped] * DAY_MS;
}

/** The box after an answer: up one (to the top box at most) when right, box 1 when wrong. */
export function nextLeitnerBox(box: number, correct: boolean): number {
  return correct ? Math.min(box + 1, LEITNER_MAX_BOX) : 1;
}
