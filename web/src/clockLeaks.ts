// Chegga Web — the Time trouble tool: how your clock changes your moves
//
// Three questions, all from data already stored with your games:
//   1. How often do you go wrong at each stage of your clock (plenty of time
//      left, comfortable, low, critical)? The bands are timePressure.ts's,
//      stored on each analyzed move.
//   2. How does the time you spend on a move change it? From the clock after
//      your previous move, plus the increment (blunderDnaProfile.ts's
//      ownMoveTimes).
//   3. How many games do you lose, or win, on time? From every synced game's
//      result, analyzed or not.
// Then a few plain rules turn the numbers into advice. No engine calls.

import type { GameRecord, MoveAnalysisRecord } from "./db";
import { bandFor } from "./timePressure";
import { ownMoveTimes } from "./blunderDnaProfile";

export type BandId = "plenty" | "comfortable" | "low" | "critical";

export interface ClockBand {
  id: BandId;
  label: string;
  moves: number;
  mistakes: number;
  /** Mistakes per 100 moves. */
  rate: number;
}

export interface ThinkBucket {
  id: string;
  label: string;
  moves: number;
  mistakes: number;
  rate: number;
  /** 0..1 of these moves that were best, excellent or brilliant. */
  topShare: number;
}

export interface TimeoutStats {
  /** Synced games with a live clock (daily games left out). */
  games: number;
  losses: number;
  lossesOnTime: number;
  winsOnTime: number;
}

export interface ClockLeaks {
  movesWithClock: number;
  bands: ClockBand[];
  think: ThinkBucket[];
  timeouts: TimeoutStats;
  /** The comparison band: plenty of time left, or else a comfortable clock
   * (whichever has enough moves). */
  calmBand?: ClockBand;
  /** The band with the highest mistake rate among the others with enough moves. */
  worstBand?: ClockBand;
  /** How many times the calm band's rate the worst band's rate is. */
  bandLift?: number;
  advice: string[];
}

// The stored band labels (timePressure.ts), mapped to short ids.
const BAND_IDS: Record<string, BandId> = {
  "plenty (>70%)": "plenty",
  "comfortable (30-70%)": "comfortable",
  "low (10-30%)": "low",
  "critical (<10% time left)": "critical",
};

const BAND_LABELS: Record<BandId, string> = {
  plenty: "More than 70% of your time left",
  comfortable: "30–70% left",
  low: "10–30% left",
  critical: "Less than 10% left",
};

const BAND_PHRASES: Record<BandId, string> = {
  plenty: "plenty of time",
  comfortable: "30–70% of your clock left",
  low: "10–30% of your clock left",
  critical: "less than 10% of your clock left",
};

const THINK_DEFS: { id: string; label: string; min: number; max: number }[] = [
  { id: "instant", label: "Under 3 seconds", min: 0, max: 3 },
  { id: "quick", label: "3–10 seconds", min: 3, max: 10 },
  { id: "think", label: "10–30 seconds", min: 10, max: 30 },
  { id: "long", label: "30 seconds or more", min: 30, max: Infinity },
];

// A band or bucket needs this many moves before its rate means much.
export const MIN_MOVES = 20;
// How many times the calm rate a bad band must reach before advice names it.
export const ADVICE_LIFT = 1.5;
// And by how many mistakes per 100 moves at least, so two small rates
// (2 against 1) do not read as a leak.
export const MIN_RATE_GAP = 5;

const isMistake = (m: MoveAnalysisRecord) => m.classification === "mistake" || m.classification === "blunder";
const isTop = (m: MoveAnalysisRecord) =>
  m.classification === "best" || m.classification === "excellent" || m.classification === "brilliant";
const per100 = (mistakes: number, moves: number) => (moves ? Math.round((mistakes / moves) * 1000) / 10 : 0);

function bandOf(m: MoveAnalysisRecord, game: GameRecord | undefined): BandId | undefined {
  const stored = m.timePressureBand ? BAND_IDS[m.timePressureBand] : undefined;
  if (stored) return stored;
  if (!game) return undefined;
  const label = bandFor(m.clockSeconds, game.timeControl);
  return label ? BAND_IDS[label] : undefined;
}

const isLive = (g: GameRecord) => !!g.timeControl && !g.timeControl.includes("/");
const ownResult = (g: GameRecord) => (g.userColor === "white" ? g.whiteResult : g.blackResult);
const theirResult = (g: GameRecord) => (g.userColor === "white" ? g.blackResult : g.whiteResult);

export function computeTimeouts(allGames: GameRecord[]): TimeoutStats {
  const live = allGames.filter(isLive);
  return {
    games: live.length,
    losses: live.filter((g) => g.userResult === "loss").length,
    lossesOnTime: live.filter((g) => g.userResult === "loss" && ownResult(g) === "timeout").length,
    winsOnTime: live.filter((g) => g.userResult === "win" && theirResult(g) === "timeout").length,
  };
}

/** `analyzedGames` and `ownMoves` as computeProfile wants them; `allGames`
 * is every synced game, for the on-time results. */
export function computeClockLeaks(
  analyzedGames: GameRecord[],
  ownMoves: MoveAnalysisRecord[],
  allGames: GameRecord[],
): ClockLeaks | null {
  const gameById = new Map(analyzedGames.map((g) => [g.chessComUuid, g]));

  const bandCounts = new Map<BandId, { moves: number; mistakes: number }>();
  let movesWithClock = 0;
  for (const m of ownMoves) {
    const band = bandOf(m, gameById.get(m.gameId));
    if (!band) continue;
    movesWithClock += 1;
    const c = bandCounts.get(band) ?? { moves: 0, mistakes: 0 };
    c.moves += 1;
    if (isMistake(m)) c.mistakes += 1;
    bandCounts.set(band, c);
  }
  if (movesWithClock === 0) return null;

  const bands: ClockBand[] = (["plenty", "comfortable", "low", "critical"] as BandId[]).map((id) => {
    const c = bandCounts.get(id) ?? { moves: 0, mistakes: 0 };
    return { id, label: BAND_LABELS[id], moves: c.moves, mistakes: c.mistakes, rate: per100(c.mistakes, c.moves) };
  });

  const times = ownMoveTimes(analyzedGames, ownMoves);
  const think: ThinkBucket[] = THINK_DEFS.map((d) => {
    const inBucket = ownMoves.filter((m) => {
      const t = times.get(m);
      return t !== undefined && t >= d.min && t < d.max;
    });
    const mistakes = inBucket.filter(isMistake).length;
    return {
      id: d.id,
      label: d.label,
      moves: inBucket.length,
      mistakes,
      rate: per100(mistakes, inBucket.length),
      topShare: inBucket.length ? inBucket.filter(isTop).length / inBucket.length : 0,
    };
  });

  const timeouts = computeTimeouts(allGames);

  // The calm band is the comparison: plenty of time, or else a comfortable
  // clock. The worst band is the highest rate among the others (on a tie,
  // the band with less time left).
  const solid = bands.filter((b) => b.moves >= MIN_MOVES);
  const calm = solid.find((b) => b.id === "plenty") ?? solid.find((b) => b.id === "comfortable");
  const worstBand = solid.filter((b) => b !== calm).reduce<ClockBand | undefined>((w, b) => (!w || b.rate >= w.rate ? b : w), undefined);
  const bandLift = worstBand && calm && calm.rate > 0 ? Math.round((worstBand.rate / calm.rate) * 10) / 10 : undefined;

  const advice: string[] = [];
  if (
    worstBand &&
    calm &&
    bandLift !== undefined &&
    bandLift >= ADVICE_LIFT &&
    worstBand.rate - calm.rate >= MIN_RATE_GAP &&
    (worstBand.id === "low" || worstBand.id === "critical")
  ) {
    advice.push(
      `With ${BAND_PHRASES[worstBand.id]} you make ${bandLift}× as many mistakes per move as with ${BAND_PHRASES[calm.id]}. Save time for the end: aim to have a fifth of your clock left when the middlegame ends.`,
    );
  }
  const byId = new Map(think.map((t) => [t.id, t]));
  const instant = byId.get("instant")!;
  const steady = byId.get("think")!;
  const long = byId.get("long")!;
  if (
    instant.moves >= MIN_MOVES &&
    steady.moves >= MIN_MOVES &&
    instant.rate >= steady.rate * ADVICE_LIFT &&
    instant.rate - steady.rate >= MIN_RATE_GAP
  ) {
    advice.push(
      "Your fastest moves are your worst ones. Before a quick move, take one look at what your opponent threatens.",
    );
  }
  const overall = per100(
    think.reduce((n, t) => n + t.mistakes, 0),
    think.reduce((n, t) => n + t.moves, 0),
  );
  if (long.moves >= MIN_MOVES && overall > 0 && long.rate >= overall * ADVICE_LIFT && long.rate - overall >= MIN_RATE_GAP) {
    advice.push("Your long thinks do not pay off. After about 30 seconds, choose a move and keep the time.");
  }
  if (timeouts.lossesOnTime >= 3 && timeouts.losses > 0 && timeouts.lossesOnTime / timeouts.losses >= 0.15) {
    advice.push(
      `${timeouts.lossesOnTime} of your ${timeouts.losses} losses were on time. A slower time control, or one with an increment, would save some of them.`,
    );
  }

  return { movesWithClock, bands, think, timeouts, calmBand: calm, worstBand, bandLift, advice };
}

export function bandPhrase(id: BandId): string {
  return BAND_PHRASES[id];
}
