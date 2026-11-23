// Chegga Web — accuracy: one score per player, per game
//
// Centipawn loss punishes a move by how many pawns it gave away, so a
// 3-pawn slip in a position that was already +12 counts as much as a
// 3-pawn slip in a level game. Players don't feel it that way: the first
// changes nothing, the second loses the game. This module grades moves on
// winning chances instead, the way Lichess's open-source accuracy does:
//
//   1. Turn each position's engine score into the side's chance to win
//      (a logistic curve, 0-100).
//   2. A move's accuracy falls off with how much winning chance it threw
//      away (100 = kept it all).
//   3. A player's game accuracy blends a volatility-weighted mean (calm
//      positions count less than sharp ones) with a harmonic mean (one
//      disaster drags the score down, as it should).
//
// The constants are Lichess's published fit. Pure math: no DOM, no engine.

/** Engine scores beyond this are "winning" either way; the curve is flat there. */
const CP_CEILING = 1000;

/** White's chance to win, 0-100, from a White-relative engine score.
 * A mate score counts as the ceiling for whoever is mating. */
export function winChance(cpWhite: number | undefined, mateWhite?: number): number {
  let cp: number;
  if (mateWhite !== undefined && mateWhite !== 0) cp = mateWhite > 0 ? CP_CEILING : -CP_CEILING;
  else cp = Math.max(-CP_CEILING, Math.min(CP_CEILING, cpWhite ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** One move's accuracy, 0-100, from the mover's winning chance before
 * and after it. Keeping (or improving) the chance scores 100. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  if (winAfter >= winBefore) return 100;
  const drop = winBefore - winAfter;
  const raw = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669 + 1; // +1: engine uncertainty
  return Math.max(0, Math.min(100, raw));
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function harmonicMean(xs: number[]): number {
  // A 0 would make the harmonic mean 0 outright; floor it the way a
  // real-number harmonic mean of "almost nothing" behaves.
  const safe = xs.map((x) => Math.max(x, 0.01));
  return safe.length / safe.reduce((a, x) => a + 1 / x, 0);
}

/**
 * Game accuracy for each side.
 *
 * `whiteWin` has one entry per position: index 0 is the position before
 * the first move, index i+1 the position after move i (White's chance,
 * 0-100). `movers[i]` says who played move i. A side with no (counted)
 * moves gets `undefined`.
 */
export function gameAccuracy(
  whiteWin: number[],
  movers: ("white" | "black")[],
  counted?: boolean[], // false = this move wasn't graded: it shapes the windows but isn't scored
): { white?: number; black?: number } {
  const moves = Math.min(movers.length, whiteWin.length - 1);
  if (moves <= 0) return {};

  // Sliding windows over the positions, one window per move, so each
  // move is weighted by how sharp the game was around it.
  const windowSize = Math.max(2, Math.min(8, Math.floor(whiteWin.length / 10)));
  const windows: number[][] = [];
  const head = whiteWin.slice(0, windowSize);
  for (let i = 0; i < Math.min(windowSize - 2, moves); i++) windows.push(head);
  for (let i = 0; windows.length < moves; i++) {
    const w = whiteWin.slice(i, i + windowSize);
    windows.push(w.length >= 2 ? w : whiteWin.slice(-2));
  }
  const weights = windows.map((w) => Math.max(0.5, Math.min(12, stdDev(w))));

  const per: Record<"white" | "black", { acc: number[]; w: number[] }> = {
    white: { acc: [], w: [] },
    black: { acc: [], w: [] },
  };
  for (let i = 0; i < moves; i++) {
    if (counted && !counted[i]) continue;
    const side = movers[i];
    const before = side === "white" ? whiteWin[i] : 100 - whiteWin[i];
    const after = side === "white" ? whiteWin[i + 1] : 100 - whiteWin[i + 1];
    per[side].acc.push(moveAccuracy(before, after));
    per[side].w.push(weights[i]);
  }

  const score = (side: "white" | "black"): number | undefined => {
    const { acc, w } = per[side];
    if (!acc.length) return undefined;
    const totalW = w.reduce((a, b) => a + b, 0);
    const weighted = acc.reduce((a, x, i) => a + x * w[i], 0) / totalW;
    return Math.max(0, Math.min(100, (weighted + harmonicMean(acc)) / 2));
  };
  return { white: score("white"), black: score("black") };
}

/** A plain blend for a small slice of one side's moves (a game phase):
 * too few positions for the volatility weights to mean anything. */
export function sliceAccuracy(moveAccuracies: number[]): number | undefined {
  if (!moveAccuracies.length) return undefined;
  return (mean(moveAccuracies) + harmonicMean(moveAccuracies)) / 2;
}
