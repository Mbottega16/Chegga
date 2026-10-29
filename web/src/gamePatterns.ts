// Chegga Web — game-pattern insights from data already synced
//
// Everything here runs over the raw GameRecord list — every synced game,
// not just the analyzed subset — since none of these need engine
// analysis: how a game ended, rating over time, opponent-strength
// performance, game length, and time-of-day patterns are all already
// sitting in the PGN/game record. Broader sample size than the
// engine-dependent stats for free. Only the "first mistake" one needs
// analyzed move data, since "mistake" is an engine judgment.

import { Chess } from "chess.js";
import type { GameRecord, MoveAnalysisRecord } from "./db";

// --- 1. How games actually end ---

export type EndingCategory = "checkmate" | "resignation" | "timeout" | "abandonment" | "draw" | "other";

const ENDING_CATEGORY: Record<string, EndingCategory> = {
  checkmated: "checkmate",
  resigned: "resignation",
  timeout: "timeout",
  abandoned: "abandonment",
  agreed: "draw",
  repetition: "draw",
  stalemate: "draw",
  insufficient: "draw",
  "50move": "draw",
  timevsinsufficient: "draw",
};

/** The informative code is whichever side's result ISN'T "win" — for a
 * decisive game that's the loser's code (how they actually lost); for a
 * draw both sides usually carry the same draw code anyway. */
function endingCategoryFor(game: GameRecord): EndingCategory {
  const code = game.whiteResult !== "win" ? game.whiteResult : game.blackResult;
  return ENDING_CATEGORY[code] ?? "other";
}

export interface EndingBreakdown {
  category: EndingCategory;
  count: number;
  share: number;
}

export function computeEndingBreakdown(games: GameRecord[]): EndingBreakdown[] {
  const counts = new Map<EndingCategory, number>();
  for (const game of games) {
    const cat = endingCategoryFor(game);
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  const total = games.length;
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count);
}

// --- 2. Rating trajectory over time, per time class ---

export interface RatingPoint {
  endTime: number;
  rating: number;
}

export interface RatingTrajectory {
  timeClass: string;
  points: RatingPoint[]; // sorted by endTime ascending
}

/** Ratings aren't comparable across time classes (a 1800 bullet player
 * and a 1800 rapid player are different strengths — same note the
 * backend's strength model already makes), so this returns one series
 * per time class rather than one blended line. */
export function computeRatingTrajectory(games: GameRecord[]): RatingTrajectory[] {
  const byTimeClass = new Map<string, RatingPoint[]>();
  for (const game of games) {
    if (!game.rated) continue; // casual games don't move a rating, would just add noise
    const rating = game.userColor === "white" ? game.whiteRating : game.blackRating;
    const list = byTimeClass.get(game.timeClass) ?? [];
    list.push({ endTime: game.endTime, rating });
    byTimeClass.set(game.timeClass, list);
  }
  return Array.from(byTimeClass.entries())
    .map(([timeClass, points]) => ({ timeClass, points: points.sort((a, b) => a.endTime - b.endTime) }))
    .filter((t) => t.points.length >= 2) // one point isn't a trajectory
    .sort((a, b) => b.points.length - a.points.length);
}

// --- 3. Performance vs. opponent strength ---

export interface OpponentStrengthBucket {
  label: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

const STRENGTH_BANDS: [number, number, string][] = [
  [-Infinity, -200, "vs. much lower rated (200+ below you)"],
  [-200, -50, "vs. lower rated (50-200 below)"],
  [-50, 50, "vs. similar rated (±50)"],
  [50, 200, "vs. higher rated (50-200 above)"],
  [200, Infinity, "vs. much higher rated (200+ above)"],
];

export function computeOpponentStrengthPerformance(games: GameRecord[]): OpponentStrengthBucket[] {
  const buckets = new Map<string, { games: number; wins: number; losses: number; draws: number }>();

  for (const game of games) {
    const ownRating = game.userColor === "white" ? game.whiteRating : game.blackRating;
    const oppRating = game.userColor === "white" ? game.blackRating : game.whiteRating;
    if (!ownRating || !oppRating) continue;
    const diff = oppRating - ownRating;

    const band = STRENGTH_BANDS.find(([lo, hi]) => diff >= lo && diff < hi);
    if (!band) continue;
    const label = band[2];

    const entry = buckets.get(label) ?? { games: 0, wins: 0, losses: 0, draws: 0 };
    entry.games += 1;
    if (game.userResult === "win") entry.wins += 1;
    else if (game.userResult === "loss") entry.losses += 1;
    else entry.draws += 1;
    buckets.set(label, entry);
  }

  return STRENGTH_BANDS.map(([, , label]) => {
    const e = buckets.get(label) ?? { games: 0, wins: 0, losses: 0, draws: 0 };
    return { label, ...e, winRate: e.games ? Math.round((e.wins / e.games) * 1000) / 1000 : 0 };
  }).filter((b) => b.games > 0);
}

// --- 4. Game-length patterns ---

export interface GameLengthPatterns {
  avgLengthWin?: number;
  avgLengthLoss?: number;
  avgLengthDraw?: number;
}

/** "Length" is full moves (not plies) — the number most players actually
 * think in. Parsed from the PGN directly, so this works for every synced
 * game, analyzed or not. */
export function computeGameLengthPatterns(games: GameRecord[]): GameLengthPatterns {
  const byResult: Record<"win" | "loss" | "draw", number[]> = { win: [], loss: [], draw: [] };

  for (const game of games) {
    if (game.rules !== "chess" || !game.pgn) continue;
    let fullMoves: number;
    try {
      const chess = new Chess();
      chess.loadPgn(game.pgn);
      fullMoves = Math.ceil(chess.history().length / 2);
    } catch {
      continue; // a handful of PGNs (aborted games, export quirks) won't parse -- skip rather than crash the whole stat
    }
    byResult[game.userResult].push(fullMoves);
  }

  const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : undefined);
  return {
    avgLengthWin: avg(byResult.win),
    avgLengthLoss: avg(byResult.loss),
    avgLengthDraw: avg(byResult.draw),
  };
}

// --- 5. Time-of-day patterns ---

export interface TimeOfDayBucket {
  label: string;
  games: number;
  winRate: number;
}

const DAYPARTS: [number, number, string][] = [
  [5, 12, "morning (5am-12pm)"],
  [12, 17, "afternoon (12-5pm)"],
  [17, 21, "evening (5-9pm)"],
  [21, 29, "late night (9pm-5am)"], // 29 = 24+5, wraps past midnight
];

/** Local time of the viewer's own browser (chess.com's end_time is UTC,
 * converted here) — a personal pattern is more useful read against your
 * own clock than UTC. */
export function computeTimeOfDayPatterns(games: GameRecord[]): TimeOfDayBucket[] {
  const buckets = new Map<string, { games: number; wins: number }>();

  for (const game of games) {
    let hour = new Date(game.endTime * 1000).getHours();
    if (hour < 5) hour += 24; // fold 0-4am into the "late night" wraparound band
    const part = DAYPARTS.find(([lo, hi]) => hour >= lo && hour < hi);
    if (!part) continue;
    const label = part[2];
    const entry = buckets.get(label) ?? { games: 0, wins: 0 };
    entry.games += 1;
    if (game.userResult === "win") entry.wins += 1;
    buckets.set(label, entry);
  }

  return DAYPARTS.map(([, , label]) => {
    const e = buckets.get(label) ?? { games: 0, wins: 0 };
    return { label, games: e.games, winRate: e.games ? Math.round((e.wins / e.games) * 1000) / 1000 : 0 };
  }).filter((b) => b.games > 0);
}

// --- 6. Castling side chosen ---

export interface CastlingBreakdown {
  kingside: number;
  queenside: number;
  never: number;
}

export function computeCastlingBreakdown(games: GameRecord[]): CastlingBreakdown {
  const result: CastlingBreakdown = { kingside: 0, queenside: 0, never: 0 };

  for (const game of games) {
    if (game.rules !== "chess" || !game.pgn) continue;
    try {
      const chess = new Chess();
      chess.loadPgn(game.pgn);
      const ownColor = game.userColor === "white" ? "w" : "b";
      const castled = chess.history().find((san, i) => {
        const isOwnMove = (i % 2 === 0) === (ownColor === "w");
        return isOwnMove && (san === "O-O" || san === "O-O-O");
      });
      if (!castled) result.never += 1;
      else if (castled === "O-O") result.kingside += 1;
      else result.queenside += 1;
    } catch {
      continue;
    }
  }

  return result;
}

// --- 7. First-mistake ply (needs analyzed move data) ---

export function computeFirstMistakePly(games: GameRecord[], ownMoves: MoveAnalysisRecord[]): number | undefined {
  const gamesByUuid = new Map(games.map((g) => [g.chessComUuid, g]));
  const movesByGame = new Map<string, MoveAnalysisRecord[]>();
  for (const move of ownMoves) {
    if (!gamesByUuid.has(move.gameId)) continue;
    const list = movesByGame.get(move.gameId) ?? [];
    list.push(move);
    movesByGame.set(move.gameId, list);
  }

  const firstMistakePlies: number[] = [];
  for (const moves of movesByGame.values()) {
    const sorted = [...moves].sort((a, b) => a.ply - b.ply);
    const firstMistake = sorted.find((m) => m.classification === "mistake" || m.classification === "blunder");
    if (firstMistake) firstMistakePlies.push(firstMistake.ply);
  }

  if (firstMistakePlies.length === 0) return undefined;
  return Math.round((firstMistakePlies.reduce((a, b) => a + b, 0) / firstMistakePlies.length) * 10) / 10;
}

// --- 8. The Thinking Sweet Spot (Time vs. Accuracy Curve) ---

export interface TimeAccuracyBucket {
  label: string;
  range: [number, number];
  moves: number;
  accuracyRate: number; // 0 - 100 (% Best/Excellent/Brilliant)
  blunderRate: number;  // 0 - 100 (% Mistake/Blunder)
  avgCpLoss: number;
}

export interface ThinkingSweetSpotSummary {
  buckets: TimeAccuracyBucket[];
  sweetSpotLabel?: string;
  sweetSpotAccuracy?: number;
  rushBlunderPenalty?: number; // Blunder % in <2s vs sweet spot
}

const TIME_BUCKET_DEFS: { label: string; range: [number, number] }[] = [
  { label: "<2s (Rush)", range: [0, 2] },
  { label: "2-5s (Quick)", range: [2, 5] },
  { label: "5-10s (Measured)", range: [5, 10] },
  { label: "10-20s (Deep)", range: [10, 20] },
  { label: "20-40s (Calculation)", range: [20, 40] },
  { label: "40s+ (Hesitant)", range: [40, Infinity] },
];

export function computeThinkingSweetSpot(
  moves: (MoveAnalysisRecord & { timeSpentSec?: number })[],
): ThinkingSweetSpotSummary {
  const bucketCounts = TIME_BUCKET_DEFS.map((def) => ({
    ...def,
    moves: 0,
    accurateMoves: 0,
    blunderMoves: 0,
    totalCpLoss: 0,
  }));

  // Infer or use timeSpentSec
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    let timeSpent = m.timeSpentSec;
    if (timeSpent === undefined && i > 0 && moves[i - 1].gameId === m.gameId) {
      const prevClock = moves[i - 1].clockSeconds;
      const currClock = m.clockSeconds;
      if (prevClock !== undefined && currClock !== undefined && prevClock >= currClock) {
        timeSpent = prevClock - currClock;
      }
    }

    if (timeSpent === undefined || timeSpent < 0) continue;

    const b = bucketCounts.find((def) => timeSpent >= def.range[0] && timeSpent < def.range[1]);
    if (!b) continue;

    b.moves += 1;
    b.totalCpLoss += m.centipawnLoss ?? 0;
    const isAccurate = m.classification === "best" || m.classification === "excellent" || m.classification === "brilliant";
    const isBlunder = m.classification === "blunder" || m.classification === "mistake";
    if (isAccurate) b.accurateMoves += 1;
    if (isBlunder) b.blunderMoves += 1;
  }

  const buckets: TimeAccuracyBucket[] = bucketCounts.map((b) => ({
    label: b.label,
    range: b.range,
    moves: b.moves,
    accuracyRate: b.moves > 0 ? Math.round((b.accurateMoves / b.moves) * 100) : 0,
    blunderRate: b.moves > 0 ? Math.round((b.blunderMoves / b.moves) * 100) : 0,
    avgCpLoss: b.moves > 0 ? Math.round(b.totalCpLoss / b.moves) : 0,
  }));

  // Find sweet spot: highest accuracy among buckets with at least 3 moves
  const qualified = buckets.filter((b) => b.moves >= 3);
  const best = qualified.sort((a, b) => b.accuracyRate - a.accuracyRate)[0];

  const rushBucket = buckets[0];
  const rushBlunderPenalty =
    best && rushBucket && rushBucket.moves >= 2
      ? Math.max(0, rushBucket.blunderRate - best.blunderRate)
      : undefined;

  return {
    buckets,
    sweetSpotLabel: best?.label,
    sweetSpotAccuracy: best?.accuracyRate,
    rushBlunderPenalty,
  };
}

// --- 9. Tilt & Error Clustering Index ---

export interface TiltSummary {
  totalBlunders: number;
  clusteredBlunders: number;
  clusterRate: number; // 0 - 100 (%)
  postMistakeRushRate: number; // 0 - 100 (%)
}

export function computeTiltIndex(
  moves: (MoveAnalysisRecord & { timeSpentSec?: number })[],
): TiltSummary {
  const movesByGame = new Map<string, typeof moves>();
  for (const m of moves) {
    const list = movesByGame.get(m.gameId) ?? [];
    list.push(m);
    movesByGame.set(m.gameId, list);
  }

  let totalBlunders = 0;
  let clusteredBlunders = 0;
  let postMistakeMoves = 0;
  let postMistakeRushes = 0;

  for (const list of movesByGame.values()) {
    const sorted = [...list].sort((a, b) => a.ply - b.ply);
    for (let i = 0; i < sorted.length; i++) {
      const curr = sorted[i];
      const isBad = curr.classification === "blunder" || curr.classification === "mistake";
      if (curr.classification === "blunder") {
        totalBlunders += 1;
        // Did a mistake or blunder happen on the immediately preceding own-move?
        if (i > 0) {
          const prev = sorted[i - 1];
          if (prev.classification === "blunder" || prev.classification === "mistake") {
            clusteredBlunders += 1;
          }
        }
      }

      if (isBad && i < sorted.length - 1) {
        const next = sorted[i + 1];
        postMistakeMoves += 1;
        if (next.timeSpentSec !== undefined && next.timeSpentSec <= 2.5) {
          postMistakeRushes += 1;
        }
      }
    }
  }

  return {
    totalBlunders,
    clusteredBlunders,
    clusterRate: totalBlunders > 0 ? Math.round((clusteredBlunders / totalBlunders) * 100) : 0,
    postMistakeRushRate: postMistakeMoves > 0 ? Math.round((postMistakeRushes / postMistakeMoves) * 100) : 0,
  };
}

// --- 10. The Mirror of Habits (Tactical Leak Aggregation) ---

export interface MotifLeak {
  motif: string;
  label: string;
  icon: string;
  count: number;
  share: number; // 0 - 100 (%)
}

export interface MirrorOfHabits {
  topLeaks: MotifLeak[];
  mostEndangeredPiece?: { piece: string; count: number; share: number };
}

const MOTIF_INFO: Record<string, { label: string; icon: string }> = {
  fork: { label: "Knight/Pawn Forks", icon: "⚔️" },
  pin: { label: "Absolute Pins", icon: "📌" },
  back_rank: { label: "Back-Rank Weaknesses", icon: "🏰" },
  skewer: { label: "Skewers & X-Rays", icon: "🎯" },
  trapped_piece: { label: "Trapped Pieces", icon: "🪤" },
  hung_material: { label: "Hanging Pieces", icon: "💥" },
  missed_capture: { label: "Missed Free Captures", icon: "🏹" },
  missed_mate: { label: "Missed Checkmates", icon: "👑" },
  allowed_mate: { label: "Walked into Mate", icon: "💀" },
  positional: { label: "Positional Errors", icon: "📐" },
};

export function computeMirrorOfHabits(moves: MoveAnalysisRecord[]): MirrorOfHabits {
  const motifCounts = new Map<string, number>();
  const pieceCounts = new Map<string, number>();
  let totalTaggable = 0;

  for (const m of moves) {
    if (m.classification !== "blunder" && m.classification !== "mistake") continue;
    totalTaggable += 1;
    const tag = m.blunderTag ?? "positional";
    motifCounts.set(tag, (motifCounts.get(tag) ?? 0) + 1);

    // If san has piece identifier (N, B, R, Q)
    const firstChar = m.san[0];
    if (firstChar === "N") pieceCounts.set("Knight", (pieceCounts.get("Knight") ?? 0) + 1);
    else if (firstChar === "B") pieceCounts.set("Bishop", (pieceCounts.get("Bishop") ?? 0) + 1);
    else if (firstChar === "R") pieceCounts.set("Rook", (pieceCounts.get("Rook") ?? 0) + 1);
    else if (firstChar === "Q") pieceCounts.set("Queen", (pieceCounts.get("Queen") ?? 0) + 1);
    else if (firstChar >= "a" && firstChar <= "h") pieceCounts.set("Pawn", (pieceCounts.get("Pawn") ?? 0) + 1);
  }

  const topLeaks: MotifLeak[] = Array.from(motifCounts.entries())
    .map(([motif, count]) => {
      const info = MOTIF_INFO[motif] ?? { label: motif.replace(/_/g, " "), icon: "⚠️" };
      return {
        motif,
        label: info.label,
        icon: info.icon,
        count,
        share: totalTaggable > 0 ? Math.round((count / totalTaggable) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  let mostEndangeredPiece: MirrorOfHabits["mostEndangeredPiece"];
  if (pieceCounts.size > 0) {
    const sortedPieces = Array.from(pieceCounts.entries()).sort((a, b) => b[1] - a[1]);
    const [piece, count] = sortedPieces[0];
    mostEndangeredPiece = {
      piece,
      count,
      share: totalTaggable > 0 ? Math.round((count / totalTaggable) * 100) : 0,
    };
  }

  return {
    topLeaks,
    mostEndangeredPiece,
  };
}

