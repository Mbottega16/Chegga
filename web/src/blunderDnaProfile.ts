// Chegga Web — the Blunder DNA tool: where your mistakes cluster
//
// Compares your mistakes and blunders with all your other moves along four
// strands: the clock (little time left, a fast move, or a move you took your
// time over), the game phase, the score before the move (ahead, level or
// behind) and the piece you moved. A bucket whose mistake rate runs well
// above your overall rate is a habit; the strongest of them make up the
// one-line "typical mistake".
//
// The game review's per-move Blunder DNA capsule (blunderTagger.ts's
// extractBlunderDna) explains one mistake. This is the same idea across every
// analyzed game. Plain arithmetic over stored records: no engine calls.

import type { GameRecord, MoveAnalysisRecord } from "./db";
import { parseTimeControlBaseSeconds, parseTimeControlIncrementSeconds, timeSpentSeconds } from "./clockParser";

// The same lines the game review draws for one move (gameReview.ts's clock
// alerts): 10 seconds or less on the clock is panic, a move made in 2.5
// seconds or less is a rush.
export const PANIC_SECONDS = 10;
export const RUSH_SECONDS = 2.5;
// The score lines, in centipawns from the mover's side.
export const AHEAD_CP = 200;

// A bucket needs this much data before it can stand out.
const MIN_BUCKET_MOVES = 20;
const MIN_BUCKET_MISTAKES = 3;
// How far above your overall mistake rate a bucket must run to stand out.
export const STANDOUT_LIFT = 1.25;

export type StrandId = "clock" | "phase" | "score" | "piece";

export interface DnaBucket {
  id: string;
  label: string;
  /** Your own moves in this bucket. */
  moves: number;
  /** Your mistakes and blunders in this bucket. */
  mistakes: number;
  /** 0..1 of the strand's mistakes. */
  share: number;
  /** 0..1 of the strand's moves. */
  baseShare: number;
  /** Mistakes per 100 moves in this bucket. */
  rate: number;
  /** This bucket's rate over the strand's overall rate (1 = normal). */
  lift: number;
}

export interface DnaStrand {
  id: StrandId;
  title: string;
  buckets: DnaBucket[];
  moves: number;
  mistakes: number;
  /** The bucket that runs furthest above normal, if any runs far enough. */
  standout?: DnaBucket;
}

export interface DnaDrill {
  phase?: "opening" | "middlegame" | "endgame";
  label: string;
}

export interface BlunderDnaProfile {
  totalMoves: number;
  totalMistakes: number;
  /** Mistakes per 100 of your moves. */
  overallRate: number;
  strands: DnaStrand[];
  /** "a queen move, in the endgame, when you are ahead" — empty when no strand stands out. */
  traits: string[];
  drill?: DnaDrill;
}

const isMistake = (m: MoveAnalysisRecord) => m.classification === "mistake" || m.classification === "blunder";

interface BucketDef {
  id: string;
  label: string;
  /** How the bucket reads inside the "typical mistake" sentence. */
  trait: string;
}

const STRAND_DEFS: Record<StrandId, { title: string; buckets: BucketDef[] }> = {
  clock: {
    title: "Your clock",
    buckets: [
      { id: "panic", label: `${PANIC_SECONDS} seconds or less left`, trait: `with ${PANIC_SECONDS} seconds or less on your clock` },
      { id: "rush", label: `Moved in ${RUSH_SECONDS} seconds or less`, trait: `made in ${RUSH_SECONDS} seconds or less` },
      { id: "steady", label: "Took your time", trait: "after you took your time" },
    ],
  },
  phase: {
    title: "Game phase",
    buckets: [
      { id: "opening", label: "Opening", trait: "in the opening" },
      { id: "middlegame", label: "Middlegame", trait: "in the middlegame" },
      { id: "endgame", label: "Endgame", trait: "in the endgame" },
    ],
  },
  score: {
    title: "The score before your move",
    buckets: [
      { id: "ahead", label: "You were ahead", trait: "when you are ahead" },
      { id: "level", label: "About level", trait: "when the game is level" },
      { id: "behind", label: "You were behind", trait: "when you are behind" },
    ],
  },
  piece: {
    title: "The piece you moved",
    buckets: [
      { id: "k", label: "King", trait: "a king move" },
      { id: "q", label: "Queen", trait: "a queen move" },
      { id: "r", label: "Rook", trait: "a rook move" },
      { id: "b", label: "Bishop", trait: "a bishop move" },
      { id: "n", label: "Knight", trait: "a knight move" },
      { id: "p", label: "Pawn", trait: "a pawn move" },
    ],
  },
};

/** The piece a SAN move moves: "Nf3" -> n, "exd5" -> p, "O-O" -> k. */
export function pieceOf(san: string): string | undefined {
  if (!san) return undefined;
  if (san.startsWith("O-O") || san.startsWith("0-0")) return "k";
  const c = san[0];
  if ("KQRBN".includes(c)) return c.toLowerCase();
  if (c >= "a" && c <= "h") return "p";
  return undefined;
}

/** Ahead, level or behind, from the mover's side, before the move. */
export function scoreBucket(m: MoveAnalysisRecord): string | undefined {
  const sign = m.sideToMove === "white" ? 1 : -1;
  if (m.evalBeforeMate !== undefined && m.evalBeforeMate !== 0) return sign * m.evalBeforeMate > 0 ? "ahead" : "behind";
  if (m.evalBeforeCp === undefined) return undefined;
  const cp = sign * m.evalBeforeCp;
  if (cp >= AHEAD_CP) return "ahead";
  if (cp <= -AHEAD_CP) return "behind";
  return "level";
}

/** Seconds each own move took, from the clock after your previous move (or
 * the starting clock for your first move) plus the increment. */
export function ownMoveTimes(games: GameRecord[], ownMoves: MoveAnalysisRecord[]): Map<MoveAnalysisRecord, number> {
  const gameById = new Map(games.map((g) => [g.chessComUuid, g]));
  const byGame = new Map<string, MoveAnalysisRecord[]>();
  for (const m of ownMoves) {
    const list = byGame.get(m.gameId) ?? [];
    list.push(m);
    byGame.set(m.gameId, list);
  }
  const out = new Map<MoveAnalysisRecord, number>();
  for (const [gameId, list] of byGame) {
    const game = gameById.get(gameId);
    const base = game ? parseTimeControlBaseSeconds(game.timeControl) : undefined;
    if (!game || base === undefined) continue;
    const inc = parseTimeControlIncrementSeconds(game.timeControl);
    const sorted = [...list].sort((a, b) => a.ply - b.ply);
    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      if (m.clockSeconds === undefined) continue;
      const prev = sorted[i - 1];
      let prior: number | undefined;
      if (prev && prev.ply === m.ply - 2) prior = prev.clockSeconds;
      else if (m.ply <= 2) prior = base;
      if (prior === undefined) continue;
      const spent = timeSpentSeconds(prior, m.clockSeconds, inc);
      if (spent !== undefined) out.set(m, spent);
    }
  }
  return out;
}

function clockBucket(m: MoveAnalysisRecord, spent: number | undefined): string | undefined {
  if (m.clockSeconds !== undefined && m.clockSeconds <= PANIC_SECONDS) return "panic";
  if (spent === undefined) return undefined;
  return spent <= RUSH_SECONDS ? "rush" : "steady";
}

function buildStrand(id: StrandId, keyed: { key: string | undefined; mistake: boolean }[]): DnaStrand | undefined {
  const def = STRAND_DEFS[id];
  const counts = new Map(def.buckets.map((b) => [b.id, { moves: 0, mistakes: 0 }]));
  let moves = 0;
  let mistakes = 0;
  for (const { key, mistake } of keyed) {
    const c = key ? counts.get(key) : undefined;
    if (!c) continue;
    c.moves += 1;
    moves += 1;
    if (mistake) {
      c.mistakes += 1;
      mistakes += 1;
    }
  }
  if (moves === 0 || mistakes === 0) return undefined;
  const overall = mistakes / moves;
  const buckets: DnaBucket[] = def.buckets
    .map((b) => {
      const c = counts.get(b.id)!;
      const rate = c.moves ? c.mistakes / c.moves : 0;
      return {
        id: b.id,
        label: b.label,
        moves: c.moves,
        mistakes: c.mistakes,
        share: c.mistakes / mistakes,
        baseShare: c.moves / moves,
        rate: Math.round(rate * 1000) / 10,
        lift: overall > 0 ? rate / overall : 0,
      };
    })
    .filter((b) => b.moves > 0);
  const candidates = buckets.filter((b) => b.moves >= MIN_BUCKET_MOVES && b.mistakes >= MIN_BUCKET_MISTAKES && b.lift >= STANDOUT_LIFT);
  const standout = candidates.sort((a, b) => b.lift - a.lift)[0];
  return { id, title: def.title, buckets, moves, mistakes, standout };
}

const traitOf = (strand: DnaStrand, bucket: DnaBucket) =>
  STRAND_DEFS[strand.id].buckets.find((b) => b.id === bucket.id)!.trait;

/** `ownMoves` must be the player's own moves only (as computeProfile wants). */
export function computeBlunderDnaProfile(games: GameRecord[], ownMoves: MoveAnalysisRecord[]): BlunderDnaProfile | null {
  const totalMistakes = ownMoves.filter(isMistake).length;
  if (ownMoves.length === 0 || totalMistakes === 0) return null;
  const times = ownMoveTimes(games, ownMoves);

  const strands = [
    buildStrand("piece", ownMoves.map((m) => ({ key: pieceOf(m.san), mistake: isMistake(m) }))),
    buildStrand("phase", ownMoves.map((m) => ({ key: m.gamePhase, mistake: isMistake(m) }))),
    buildStrand("score", ownMoves.map((m) => ({ key: scoreBucket(m), mistake: isMistake(m) }))),
    buildStrand("clock", ownMoves.map((m) => ({ key: clockBucket(m, times.get(m)), mistake: isMistake(m) }))),
  ].filter((s): s is DnaStrand => !!s);

  // The sentence reads in strand order: piece, phase, score, clock.
  const traits = strands.filter((s) => s.standout).map((s) => traitOf(s, s.standout!));

  const phase = strands.find((s) => s.id === "phase")?.standout?.id as DnaDrill["phase"];
  const drill: DnaDrill | undefined = phase
    ? { phase, label: `Drill your ${phase} mistakes` }
    : { label: "Drill your own mistakes" };

  return {
    totalMoves: ownMoves.length,
    totalMistakes,
    overallRate: Math.round((totalMistakes / ownMoves.length) * 1000) / 10,
    strands,
    traits,
    drill,
  };
}
