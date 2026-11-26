// Chegga Web — review: the board furniture and the game summary
//
// The HTML the review screen puts around and beside the board:
//   - the evaluation bar beside the board (who is winning, right now),
//   - a player bar above and below the board (name, rating, what they
//     have taken, their clock at this move),
//   - the game summary (both players' accuracy, per-phase accuracy and
//     move-quality counts),
//   - the move list (the whole game in notation, every move graded).
// Pure string builders over gameReview.ts / reviewInsights.ts data; the
// wiring lives in main.ts.

import { getClassColor, getClassGlyph, MOVE_QUALITY_TITLES } from "./classificationColors";
import { winChance } from "./accuracy";
import { pieceImgUrl } from "./pieceSet";
import type { ReviewGame } from "./gameReview";
import {
  SUMMARY_TIERS,
  accuracyWord,
  clockAt,
  evalAt,
  formatClock,
  materialState,
  type GameSummary,
  type Phase,
  type Side,
} from "./reviewInsights";

function esc(text: string): string {
  return text.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
}

const MATE_CP = 100_000;

/** "+1.4", "-0.3", "M3", "-M2", "1-0" (the game is over: checkmate on the board). */
export function formatEval(cp: number | undefined, mate: number | undefined): string {
  if (mate !== undefined && mate !== 0) return `${mate < 0 ? "-" : ""}M${Math.abs(mate)}`;
  const v = cp ?? 0;
  if (Math.abs(v) >= MATE_CP) return v > 0 ? "1-0" : "0-1";
  const pawns = v / 100;
  // Four characters at most, so it fits the bar: "+9.9", "+12".
  const text = Math.abs(pawns) >= 9.95 ? String(Math.round(pawns)) : pawns.toFixed(1);
  return `${pawns > 0 ? "+" : ""}${text}`;
}

function evalBarHtml(white: number, label: string, spoken: string, orientation: Side): string {
  const whiteAhead = white >= 50;
  // The label sits at the leading side's end of the bar.
  const labelEnd = (orientation === "white") === whiteAhead ? "bottom" : "top";
  return `<div class="review-eval-bar" data-orientation="${orientation}" role="img" aria-label="${esc(spoken)}">
    <div class="review-eval-fill" style="height:${white.toFixed(1)}%"></div>
    <span class="review-eval-label review-eval-label-${labelEnd} ${whiteAhead ? "on-white" : "on-black"}" aria-hidden="true">${esc(label)}</span>
  </div>`;
}

/** The vertical bar beside the board. White's share is White's winning
 * chance; it grows from whichever edge White sits on. */
export function renderEvalBar(review: ReviewGame, index: number, orientation: Side): string {
  const ev = evalAt(review, index);
  const white = ev ? winChance(ev.cp, ev.mate) : 50;
  const label = ev ? formatEval(ev.cp, ev.mate) : "0.0";
  const leader = white >= 50 ? "White" : "Black";
  const spoken = !ev
    ? "Evaluation not available"
    : Math.abs(white - 50) < 2
      ? `Evaluation ${label}: about level`
      : `Evaluation ${label}: ${leader} is better`;
  return evalBarHtml(white, label, spoken, orientation);
}

/** The same bar outside a review: level at rest, or following the engine
 * during a bot game. */
export function renderLiveEvalBar(
  orientation: Side,
  live?: { cp: number | undefined; mate: number | undefined },
): string {
  const white = live ? winChance(live.cp, live.mate) : 50;
  const label = live ? formatEval(live.cp, live.mate) : "0.0";
  return evalBarHtml(white, label, `Evaluation ${label}`, orientation);
}

const CAPTURE_GLYPH: Record<Side, Record<string, string>> = {
  // Pieces taken BY this side are the other side's pieces.
  white: { q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
  black: { q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
};
const PIECE_NAME: Record<string, [string, string]> = {
  q: ["queen", "queens"],
  r: ["rook", "rooks"],
  b: ["bishop", "bishops"],
  n: ["knight", "knights"],
  p: ["pawn", "pawns"],
};

/** A taken piece drawn with the same art as the board, so it follows the
 * viewer's piece set. The text set falls back to its symbols. */
function capturedPiece(takenBy: Side, type: string): string {
  const url = pieceImgUrl(takenBy === "white" ? "b" : "w", type);
  return url
    ? `<img class="rpb-piece" src="${url}" alt="" width="22" height="22" draggable="false">`
    : CAPTURE_GLYPH[takenBy][type] + "︎";
}

function capturedText(pieces: string[]): string {
  const counts = new Map<string, number>();
  for (const p of pieces) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts]
    .map(([p, n]) => `${n} ${PIECE_NAME[p][n === 1 ? 0 : 1]}`)
    .join(", ");
}

/** Who sits at the top and the bottom of the board. */
export function playerSides(orientation: Side): { top: Side; bottom: Side } {
  return orientation === "white" ? { top: "black", bottom: "white" } : { top: "white", bottom: "black" };
}

/** One player's strip above or below the board, at step `index`. */
export function renderPlayerBar(review: ReviewGame, index: number, side: Side): string {
  const fen = index >= 0 ? review.steps[index]?.fenAfter : review.startFen;
  const material = materialState(fen ?? review.startFen);
  const player = review.players[side];
  const isYou = side === review.humanColor;
  const name = player.name ?? (isYou ? "You" : "Opponent");
  const rating = player.rating ? `<span class="rpb-rating">(${player.rating})</span>` : "";
  const you = isYou && player.name ? `<span class="rpb-you">You</span>` : "";

  const taken = material.capturedBy[side];
  const lead = material.lead[side];
  const captured = taken.length
    ? `<span class="rpb-captured" aria-label="${esc(`Has taken ${capturedText(taken)}`)}"><span aria-hidden="true">${taken
        .map((p) => capturedPiece(side, p))
        .join("")}</span></span>`
    : "";
  const leadTag = lead > 0 ? `<span class="rpb-lead" aria-label="ahead by ${lead} in material">+${lead}</span>` : "";

  // Whose turn it is with this position on the board.
  const sideToMove: Side = (fen ?? "").split(" ")[1] === "b" ? "black" : "white";
  const gameOver = index >= review.steps.length - 1 && index >= 0;
  const toMove = !gameOver && sideToMove === side;

  const sec = clockAt(review, index, side);
  const clock =
    sec !== undefined
      ? `<span class="rpb-clock${sec < 20 ? " rpb-clock-low" : ""}${toMove ? " rpb-clock-running" : ""}" aria-label="${esc(`${formatClock(sec)} on the clock`)}">${formatClock(sec)}</span>`
      : "";

  return `<div class="rpb rpb-${side}${isYou ? " rpb-is-you" : ""}">
    <span class="rpb-swatch" aria-hidden="true"></span>
    <span class="rpb-name">${esc(name)}</span>${rating}${you}
    <span class="rpb-material">${captured}${leadTag}</span>
    ${clock}
  </div>`;
}

const PHASE_LABEL: Record<Phase, string> = { opening: "Opening", middlegame: "Middlegame", endgame: "Endgame" };

function resultFor(review: ReviewGame, side: Side): "win" | "loss" | "draw" | undefined {
  if (review.result === "1/2-1/2") return "draw";
  if (review.result === "1-0") return side === "white" ? "win" : "loss";
  if (review.result === "0-1") return side === "black" ? "win" : "loss";
  return undefined;
}

function renderSide(review: ReviewGame, summary: GameSummary, side: Side): string {
  const s = summary[side];
  const player = review.players[side];
  const isYou = side === review.humanColor;
  const name = player.name ?? (isYou ? "You" : "Opponent");
  const result = resultFor(review, side);
  const resultTag = result ? `<span class="rs-result rs-result-${result}">${result === "win" ? "Won" : result === "loss" ? "Lost" : "Draw"}</span>` : "";
  const acc =
    s.accuracy !== undefined
      ? `<span class="rs-acc-num">${s.accuracy.toFixed(1)}</span><span class="rs-acc-label">accuracy</span>`
      : `<span class="rs-acc-num rs-acc-none">—</span><span class="rs-acc-label">not graded</span>`;
  const phases = (["opening", "middlegame", "endgame"] as Phase[])
    .map((p) => {
      const v = s.phases[p];
      if (v === undefined) return "";
      return `<span class="rs-phase" title="${esc(`${PHASE_LABEL[p]}: ${v.toFixed(1)} accuracy`)}"><span class="rs-phase-name">${PHASE_LABEL[p]}</span> <strong>${Math.round(v)}</strong> <span class="rs-phase-word rs-word-${accuracyWord(v).toLowerCase()}">${accuracyWord(v)}</span></span>`;
    })
    .join("");
  return `<div class="rs-side rs-${side}${isYou ? " rs-is-you" : ""}">
    <div class="rs-who"><span class="rpb-swatch" aria-hidden="true"></span><span class="rs-name">${esc(name)}</span>${player.rating ? `<span class="rs-rating">${player.rating}</span>` : ""}${isYou ? `<span class="rpb-you">You</span>` : ""}${resultTag}</div>
    <div class="rs-acc">${acc}</div>
    <div class="rs-phases">${phases}</div>
  </div>`;
}

/** Both players side by side, the reviewer first, then a tier-by-tier
 * count. Each count is a button that jumps to that player's next move of
 * that tier. */
export function renderGameSummary(review: ReviewGame, summary: GameSummary): string {
  if (!summary.white.graded && !summary.black.graded) return "";
  const first: Side = review.humanColor;
  const second: Side = first === "white" ? "black" : "white";
  const rows = SUMMARY_TIERS.filter((t) => summary.white.tally[t] || summary.black.tally[t])
    .map((tier) => {
      const color = getClassColor(tier);
      const cell = (side: Side) => {
        if (!summary[side].graded) return `<span class="rs-count rs-count-zero" aria-hidden="true">–</span>`;
        const n = summary[side].tally[tier] ?? 0;
        return n
          ? `<button type="button" class="rs-count" data-review-jump="${side}:${tier}" aria-label="${esc(`${n} ${MOVE_QUALITY_TITLES[tier] ?? tier} by ${side === review.humanColor ? "you" : "your opponent"}: show the next one`)}">${n}</button>`
          : `<span class="rs-count rs-count-zero" aria-hidden="true">0</span>`;
      };
      return `<div class="rs-row" data-tier="${tier}">
        ${cell(first)}
        <span class="rs-tier"><span class="quality-pixel-badge" style="--badge-color:${color}"><span class="pixel-glyph">${getClassGlyph(tier)}</span></span>${esc(MOVE_QUALITY_TITLES[tier] ?? tier)}</span>
        ${cell(second)}
      </div>`;
    })
    .join("");
  return `<section class="review-summary" aria-label="Game summary">
    <div class="rs-players">${renderSide(review, summary, first)}<span class="rs-vs" aria-hidden="true">vs</span>${renderSide(review, summary, second)}</div>
    <div class="rs-tally" role="group" aria-label="Move quality, you and your opponent">${rows}</div>
  </section>`;
}

/** The index of `side`'s next `tier` move after `from`, wrapping around. -1 if none. */
export function nextTierIndex(review: ReviewGame, side: Side, tier: string, from: number): number {
  const n = review.steps.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k + n) % n;
    const s = review.steps[i];
    if (s.side === side && (s.tier ?? s.classification) === tier) return i;
  }
  return -1;
}

/** The whole game as a scoresheet, one row per full move, every graded
 * move wearing its tier's glyph. The opponent's glyphs are quieter. */
export function renderMoveList(review: ReviewGame, currentIndex: number): string {
  if (!review.steps.length) return "";
  const cell = (i: number) => {
    const step = review.steps[i];
    const tier = step.tier ?? step.classification;
    const color = tier ? getClassColor(tier) : "";
    const glyph = tier ? getClassGlyph(tier) : "";
    const title = tier ? MOVE_QUALITY_TITLES[tier] ?? tier : "not graded";
    const classes = ["rml-move", step.isHuman ? "rml-mine" : "rml-theirs", i === currentIndex ? "rml-current" : "", tier ? `rml-tier-${tier}` : ""]
      .filter(Boolean)
      .join(" ");
    return `<button type="button" class="${classes}" data-review-index="${i}"${color ? ` style="--tier-color:${color}"` : ""} aria-label="${esc(`${step.moveNumber}${step.side === "white" ? "." : "..."} ${step.san}, ${title}`)}"${i === currentIndex ? ' aria-current="step"' : ""}><span class="rml-san">${esc(step.san)}</span>${glyph ? `<span class="rml-glyph" aria-hidden="true">${glyph}</span>` : ""}</button>`;
  };
  const rows: string[] = [];
  let i = 0;
  if (review.steps[0].side === "black") {
    rows.push(`<li class="rml-row"><span class="rml-num">${review.steps[0].moveNumber}.</span><span class="rml-move rml-empty" aria-hidden="true">…</span>${cell(0)}</li>`);
    i = 1;
  }
  for (; i < review.steps.length; i += 2) {
    const w = cell(i);
    const b = i + 1 < review.steps.length ? cell(i + 1) : `<span class="rml-move rml-empty" aria-hidden="true"></span>`;
    rows.push(`<li class="rml-row"><span class="rml-num">${review.steps[i].moveNumber}.</span>${w}${b}</li>`);
  }
  return `<div class="review-move-list-wrap"><h4 class="review-subheading">Moves</h4><ol class="review-move-list" id="review-move-list" aria-label="Moves of this game">${rows.join("")}</ol></div>`;
}
