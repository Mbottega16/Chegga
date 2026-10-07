// Chegga Web — candidate moves for one position, and how to draw them
//
// The best-move heatmap. The engine already supports MultiPV (ranked lines
// per position); the review just never asked for more than the top line.
// This turns one position's ranked lines into candidates -- each with the
// same tier the whole app already uses (engineAnalysis.ts's `classify`, on
// how far the move falls short of the best one) -- and then into what a
// board can draw: a tint on the destination of every strong candidate, and
// a few arrows.
//
// Pure: no DOM, no engine call. candidateAnalysis.ts fetches the lines.

import { Chess, type Square } from "chess.js";
import type { AnalysisLine } from "./engine";
import { classify, cpEquivalent } from "./engineAnalysis";
import { getClassColor } from "./classificationColors";

export interface Candidate {
  rank: number; // 1 = the engine's top choice
  uci: string;
  san: string;
  from: Square;
  to: Square;
  scoreCp: number; // the mover's own view; a mate is a very large number
  mate?: number; // mover-relative moves to mate, when the line is a mate
  gapCp: number; // how far short of the best candidate this one falls
  tier: string; // brilliant / best / excellent / good / inaccuracy / mistake / blunder
}

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** A lightweight "is this a real sacrifice" check -- not a full static-
 * exchange evaluator (this project's blunder-tag heuristics aren't one
 * either, see engineAnalysis.ts). After the candidate move, is the piece
 * that just moved sitting on a square a cheaper enemy piece can capture it
 * on? A queen landing where only a pawn can take it, with the engine still
 * calling it the top line, is the shape of a brilliancy -- an ordinary
 * trade or a safe best move isn't. Applied to the engine's own top
 * candidate in buildCandidates (the heatmap), and, exported, to a move a
 * human actually played once it's already graded "best" (main.ts's live
 * juice and the review's played-move marker) -- never a new stored
 * classification, just a display-time refinement of "best" either way. */
export function isSacrifice(fen: string, uci: string): boolean {
  const board = new Chess(fen);
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const movingPiece = board.get(from);
  if (!movingPiece || movingPiece.type === "k") return false;
  const movingValue = PIECE_VALUES[movingPiece.type];
  const capturedValue = PIECE_VALUES[board.get(to)?.type ?? ""] ?? 0;

  try {
    if (!board.move({ from, to, promotion: uci.slice(4) || undefined })) return false;
  } catch {
    return false;
  }

  // Cheapest enemy piece that can now recapture on the destination square.
  let cheapestRecapture = Infinity;
  for (const reply of board.moves({ verbose: true })) {
    if (reply.to === to && reply.captured) {
      cheapestRecapture = Math.min(cheapestRecapture, PIECE_VALUES[reply.piece]);
    }
  }
  if (cheapestRecapture === Infinity) return false; // nothing can actually take it back

  const materialLostIfTaken = movingValue - capturedValue;
  return materialLostIfTaken >= 2 && cheapestRecapture < movingValue;
}

/** Lines are the engine's own, mover-relative. A line whose first move
 * doesn't parse against `fen` is dropped rather than guessed at. */
export function buildCandidates(fen: string, lines: AnalysisLine[]): Candidate[] {
  const scored: Omit<Candidate, "rank" | "gapCp" | "tier">[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const uci = line.pv[0];
    if (!uci || seen.has(uci)) continue;
    try {
      const board = new Chess(fen);
      const move = board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || undefined });
      seen.add(uci);
      scored.push({
        uci,
        san: move.san,
        from: move.from,
        to: move.to,
        scoreCp: cpEquivalent(line.scoreCp, line.scoreMate),
        mate: line.scoreMate,
      });
    } catch {
      continue;
    }
  }
  scored.sort((a, b) => b.scoreCp - a.scoreCp);
  const bestScore = scored[0]?.scoreCp ?? 0;
  return scored.map((c, i) => {
    const gapCp = Math.max(0, bestScore - c.scoreCp);
    const tier = classify(gapCp);
    // "Brilliant" only ever refines the engine's own top choice -- a
    // sacrifice that merely ties for best isn't the point.
    const brilliant = i === 0 && tier === "best" && isSacrifice(fen, c.uci);
    return { ...c, rank: i + 1, gapCp, tier: brilliant ? "brilliant" : tier };
  });
}

/** "+0.3", "-1.2", "M3" -- the candidate's evaluation from the mover's side. */
export function formatCandidateEval(c: Candidate): string {
  if (c.mate !== undefined) return c.mate > 0 ? `M${c.mate}` : `-M${Math.abs(c.mate)}`;
  const pawns = c.scoreCp / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(1)}`;
}

export interface OverlayTint {
  square: Square;
  color: string;
  opacity: number;
  tier: string;
}

export interface OverlayArrow {
  from: Square;
  to: Square;
  color: string;
  kind: "best" | "played" | "preview";
}

/** A pulsing from-square-to-square path for one shaded candidate --
 * "where the piece should go," not just the destination tint or the
 * three call-out arrows (best/played/preview). One per shaded candidate,
 * not deduped by destination the way tints are: two different pieces
 * that can both reach the same square are two different real options,
 * and both are worth showing. */
export interface OverlayTrail {
  from: Square;
  to: Square;
  color: string;
  tier: string;
}

export interface CandidateOverlay {
  tints: OverlayTint[];
  arrows: OverlayArrow[];
  trails: OverlayTrail[];
}

// Only moves that are still good get shaded: the point is "where can I
// go", not a map of every legal move. Brilliant gets the strongest wash --
// it's the rare, attention-worthy one.
const SHADED_TIERS: Record<string, number> = { brilliant: 0.7, best: 0.62, excellent: 0.5, good: 0.38 };

export function isShadedTier(tier: string): boolean {
  return tier in SHADED_TIERS;
}

/** What to draw for one position. `playedUci` is the move actually played
 * (drawn in its own tier's color so the gap to the best move is visible);
 * `previewUci` is a candidate the viewer tapped in the list. Colors come
 * from getClassColor, so the colour-blind toggle applies. */
export function buildOverlay(
  candidates: Candidate[],
  playedUci: string | undefined,
  playedTier: string | undefined,
  previewUci?: string | null,
): CandidateOverlay {
  const tints: OverlayTint[] = [];
  const tinted = new Set<string>();
  for (const c of candidates) {
    if (!isShadedTier(c.tier) || tinted.has(c.to)) continue; // best-ranked candidate wins a shared destination
    tinted.add(c.to);
    tints.push({ square: c.to, color: getClassColor(c.tier), opacity: SHADED_TIERS[c.tier], tier: c.tier });
  }

  const arrows: OverlayArrow[] = [];
  const best = candidates[0];
  if (best) arrows.push({ from: best.from, to: best.to, color: getClassColor(best.tier), kind: "best" });
  if (playedUci && playedUci !== best?.uci) {
    arrows.push({
      from: playedUci.slice(0, 2) as Square,
      to: playedUci.slice(2, 4) as Square,
      color: getClassColor(playedTier ?? "inaccuracy"),
      kind: "played",
    });
  }
  const preview = previewUci ? candidates.find((c) => c.uci === previewUci) : undefined;
  if (preview && preview.uci !== best?.uci && preview.uci !== playedUci) {
    arrows.push({ from: preview.from, to: preview.to, color: getClassColor(preview.tier), kind: "preview" });
  }

  const trails: OverlayTrail[] = candidates
    .filter((c) => isShadedTier(c.tier))
    .map((c) => ({ from: c.from, to: c.to, color: getClassColor(c.tier), tier: c.tier }));

  return { tints, arrows, trails };
}

/** Arrows available before the engine has answered: the stored best move
 * and the played move, straight from the grading record. */
export function quickArrows(
  bestUci: string | undefined,
  playedUci: string,
  playedTier: string | undefined,
): OverlayArrow[] {
  const arrows: OverlayArrow[] = [];
  if (bestUci) {
    arrows.push({
      from: bestUci.slice(0, 2) as Square,
      to: bestUci.slice(2, 4) as Square,
      color: getClassColor("best"),
      kind: "best",
    });
  }
  if (playedUci !== bestUci) {
    arrows.push({
      from: playedUci.slice(0, 2) as Square,
      to: playedUci.slice(2, 4) as Square,
      color: getClassColor(playedTier ?? "inaccuracy"),
      kind: "played",
    });
  }
  return arrows;
}
