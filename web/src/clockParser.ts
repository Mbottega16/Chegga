// Chegga Web — %clk PGN annotation parsing (Phase 2)
//
// Ported from Chegga's own `app/services/clock_parser.py`. Correspondence/
// daily time controls ("1/259200" — one move per N seconds) have no
// meaningful "seconds remaining" concept the way a live clock does, so
// both functions return undefined for them rather than a nonsense number.

const CLK_RE = /\[%clk\s+(\d+):(\d{2}):(\d{2}(?:\.\d+)?)\]/;

/** "600" -> 600. "180+2" -> 180 (increment ignored). "1/259200" -> undefined. */
export function parseTimeControlBaseSeconds(timeControl: string): number | undefined {
  if (!timeControl || timeControl.includes("/")) return undefined;
  const base = timeControl.split("+", 1)[0];
  const n = parseInt(base, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** "180+2" -> 2. "600" -> 0. "1/259200" or nothing usable -> 0. */
export function parseTimeControlIncrementSeconds(timeControl: string): number {
  if (!timeControl || timeControl.includes("/")) return 0;
  const increment = parseInt(timeControl.split("+")[1] ?? "", 10);
  return Number.isFinite(increment) && increment > 0 ? increment : 0;
}

/** Seconds a move took: the mover's clock before it, minus the clock after
 * it, plus the increment the move earned. Undefined when the clocks cannot
 * be right (the clock after is higher than before plus the increment). */
export function timeSpentSeconds(priorClock: number, clockAfter: number, incrementSec = 0): number | undefined {
  const spent = priorClock - clockAfter + incrementSec;
  if (spent < 0) return undefined;
  return Math.round(spent * 10) / 10;
}

export function clockSecondsFromComment(comment: string): number | undefined {
  const match = CLK_RE.exec(comment);
  if (!match) return undefined;
  const [, hours, minutes, seconds] = match;
  return parseInt(hours, 10) * 3600 + parseInt(minutes, 10) * 60 + parseFloat(seconds);
}

/**
 * Returns { fenAfter -> clockSecondsRemaining } from chess.js's own
 * getComments() (each entry already pairs a comment with the FEN of the
 * position right after that move). The caller matches this back to a ply
 * by the FEN it independently reaches while walking the game — see
 * engineAnalysis.ts — rather than by array index, since a game missing a
 * %clk annotation for some move must not shift every later one.
 */
export function clocksByFen(comments: { fen: string; comment: string }[]): Map<string, number> {
  const byFen = new Map<string, number>();
  for (const { fen, comment } of comments) {
    const seconds = clockSecondsFromComment(comment);
    if (seconds !== undefined) byFen.set(fen, seconds);
  }
  return byFen;
}
