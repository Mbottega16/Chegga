// Chegga Web — game review: the HTML around the board
//
// Two pieces of markup, both driven entirely by gameReview.ts's model and
// the shared move-quality palette (classificationColors.ts), so a color
// means the same thing here, on the board, and on the profile bar:
//   - the timeline strip: one clickable chip per half-move, the
//     reviewer's own moves colored by tier, the opponent's kept small and
//     neutral so the reviewer's own shape is what reads at a glance.
//   - the tally: how many of their moves landed in each tier.

import { getClassColor, getClassGlyph } from "./classificationColors";
import {
  moveLabel,
  tallyHumanQuality,
  REVIEW_QUALITY_LABELS,
  computeStorylineMoments,
  positionWinChances,
  type ReviewGame,
} from "./gameReview";
import { formatCandidateEval, isShadedTier, type Candidate } from "./candidateMoves";
import type { BlunderDna } from "./blunderTagger";
import { iconZap } from "./icons";

function escapeAttr(text: string): string {
  return text.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
}

/** Tiers worth a marker on the chart: the moves that changed the game. */
const CHART_MARKED_TIERS = new Set(["brilliant", "inaccuracy", "mistake", "miss", "blunder"]);

/** Chart x (0-100) past which a phase name reads leftward from its line. */
const PHASE_LABEL_FLIP_AT = 70;
/** The least chart width (0-100) one phase name needs: "Middlegame" fills
 * about this much of the narrowest (phone-width) chart. Two names closer than
 * this, the second is left out. */
const PHASE_LABEL_MIN_GAP = 24;
/** A rightward name followed by a leftward one closer than this would meet
 * in the middle, so the first turns leftward too. */
const PHASE_LABEL_FACING_GAP = 45;
/** Chart x (0-100) past which the "White 87%" tag sits left of the cursor. */
const CURSOR_TAG_FLIP_AT = 72;

/** The game as one picture: White's winning chances over time.
 *
 * The light area is White's share, the dark area Black's, the same split
 * as the evaluation bar beside the board, so the bar is the chart at one
 * moment. It is drawn on winning chances, not raw pawns: a +3 to +6 swing
 * in a won game barely moves it, a 0 to +3 swing in a level game moves it
 * a lot, which is how the game actually felt. Markers (round HTML dots, so
 * they stay round however wide the chart is) sit on the moves that
 * changed things, the reviewer's own bigger than the opponent's. Dashed
 * lines mark where the middlegame and the endgame began. */
export function renderEvalGraph(review: ReviewGame, currentIndex: number): string {
  if (!review.steps.length) return "";
  const n = review.steps.length;
  const wins = positionWinChances(review); // n + 1 positions: the start, then after each move
  const x = (pos: number) => (pos / n) * 100;
  const y = (win: number) => 2 + (1 - win / 100) * 36; // viewBox height 40, 2 units of headroom
  const pts = wins.map((w, k) => `${x(k).toFixed(2)} ${y(w).toFixed(2)}`);
  const line = `M ${pts.join(" L ")}`;
  const whiteArea = `M 0 40 L ${pts.join(" L ")} L 100 40 Z`;

  // Clock trouble: a band behind the move.
  const band = Math.max(0.8, 100 / n);
  const heatBands = review.steps
    .map((step, i) => {
      if (!step.clockAlert) return "";
      const cx = x(i + 1);
      return `<rect x="${(cx - band / 2).toFixed(2)}" y="0" width="${band.toFixed(2)}" height="40" class="eval-heat-band eval-heat-${step.clockAlert}"/>`;
    })
    .join("");

  // Where the middlegame and the endgame begin.
  const phaseStarts: { pos: number; label: string }[] = [];
  let lastPhase = review.steps[0].gamePhase;
  review.steps.forEach((step, i) => {
    if (step.gamePhase && lastPhase && step.gamePhase !== lastPhase && !phaseStarts.some((p) => p.label === step.gamePhase)) {
      phaseStarts.push({ pos: i, label: step.gamePhase });
    }
    if (step.gamePhase) lastPhase = step.gamePhase;
  });
  const phaseLines = phaseStarts
    .map((p) => `<line x1="${x(p.pos).toFixed(2)}" y1="0" x2="${x(p.pos).toFixed(2)}" y2="40" class="eval-phase-line" vector-effect="non-scaling-stroke"/>`)
    .join("");
  // The names sit in their own strip under the chart, clear of the curve and
  // its dots. Each reads rightward from its dashed line, except near the right
  // edge, where it reads leftward so it never runs off the chart. Two names
  // that would touch: the first turns leftward too, or, with no room for
  // that, the second is left out (its dashed line still shows).
  const labels: { px: number; text: string; leftward: boolean }[] = [];
  for (const p of phaseStarts) {
    const label = { px: x(p.pos), text: p.label === "middlegame" ? "Middlegame" : "Endgame", leftward: x(p.pos) > PHASE_LABEL_FLIP_AT };
    const prev = labels.at(-1);
    if (prev) {
      const gap = label.px - prev.px;
      if (gap < PHASE_LABEL_MIN_GAP) continue;
      if (label.leftward && !prev.leftward && gap < PHASE_LABEL_FACING_GAP) {
        if (prev.px < PHASE_LABEL_MIN_GAP) continue;
        prev.leftward = true;
      }
    }
    labels.push(label);
  }
  const phaseLabels = labels
    .map((l) => `<span class="eval-phase-label${l.leftward ? " eval-phase-label-right" : ""}" style="left:${l.px.toFixed(2)}%">${l.text}</span>`)
    .join("");
  const phaseStrip = phaseLabels ? `<div class="eval-phase-strip">${phaseLabels}</div>` : "";

  const dots = review.steps
    .map((step, i) => {
      const tier = step.tier ?? step.classification;
      if (!tier || !CHART_MARKED_TIERS.has(tier)) return "";
      const color = getClassColor(tier);
      const label = `${moveLabel(step)}: ${step.isHuman ? "your" : "opponent's"} ${REVIEW_QUALITY_LABELS[tier] ?? tier}`;
      return `<button type="button" class="eval-graph-node ${step.isHuman ? "eval-node-mine" : "eval-node-theirs"}" data-review-index="${i}" data-tier="${tier}" style="left:${x(i + 1).toFixed(2)}%;top:${((y(wins[i + 1]) / 40) * 100).toFixed(2)}%;--node-color:${color}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}"></button>`;
    })
    .join("");

  let cursorSvg = "";
  let cursorTag = "";
  const curPos = Math.max(0, Math.min(n, currentIndex + 1));
  if (currentIndex >= -1) {
    const cx = x(curPos);
    cursorSvg = `<line x1="${cx.toFixed(2)}" y1="0" x2="${cx.toFixed(2)}" y2="40" class="eval-graph-cursor" vector-effect="non-scaling-stroke"/>`;
    const w = wins[curPos];
    const pct = Math.round(w >= 50 ? w : 100 - w);
    const who = Math.abs(w - 50) < 2 ? "Level" : `${w >= 50 ? "White" : "Black"} ${pct}%`;
    cursorTag = `<span class="eval-graph-cursor-dot" style="left:${cx.toFixed(2)}%;top:${((y(w) / 40) * 100).toFixed(2)}%"></span><span class="eval-graph-tag${cx > CURSOR_TAG_FLIP_AT ? " eval-graph-tag-left" : ""}" style="left:${cx.toFixed(2)}%">${who}</span>`;
  }

  return `
    <div class="eval-graph-container" role="region" aria-label="Winning chances over the game. Drag across it to move through the game.">
      <div class="eval-graph-header">
        <span class="eval-graph-label">Evaluation Flow</span>
        <span class="eval-graph-legend"><span class="legend-white">White</span> / <span class="legend-black">Black</span> winning chances</span>
      </div>
      <div class="eval-graph-plot">
        <svg class="eval-graph-svg" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <rect x="0" y="0" width="100" height="40" class="eval-black-area"/>
          <path d="${whiteArea}" class="eval-white-area"/>
          ${heatBands}
          <line x1="0" y1="20" x2="100" y2="20" class="eval-midline" vector-effect="non-scaling-stroke"/>
          ${phaseLines}
          <path d="${line}" class="eval-line" vector-effect="non-scaling-stroke"/>
          ${cursorSvg}
        </svg>
        ${dots}
        ${cursorTag}
      </div>
      ${phaseStrip}
    </div>`;
}

/** `currentIndex` is -1 for the starting position (no chip current). */
export function renderReviewStrip(review: ReviewGame, currentIndex: number): string {
  const chips = review.steps
    .map((step, i) => {
      const tier = step.classification;
      const label = tier ? (REVIEW_QUALITY_LABELS[tier] ?? tier) : "not graded";
      let aria = `${moveLabel(step)} — ${step.isHuman ? label : "opponent"}`;
      if (step.clockAlert === "panic") aria += ` (panic: ${Math.round(step.clockRemainingSec ?? 0)}s left)`;
      else if (step.clockAlert === "rush") aria += ` (rushed: ${step.timeSpentSec}s)`;

      const classes = [
        "review-chip",
        step.isHuman ? "review-chip-mine" : "review-chip-theirs",
        i === currentIndex ? "review-chip-current" : "",
        step.clockAlert ? `review-chip-${step.clockAlert}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const color = step.isHuman && tier ? getClassColor(tier) : "var(--muted-dim)";
      const glyph = step.isHuman && tier ? getClassGlyph(tier) : "";
      const clockTag = step.clockAlert
        ? `<span class="chip-clock-dot clock-${step.clockAlert}"></span>`
        : "";
      return `<button type="button" class="${classes}" data-review-index="${i}" data-tier="${tier ?? ""}" style="--chip-color:${color}" title="${escapeAttr(aria)}" aria-label="${escapeAttr(aria)}">${glyph ? `<span class="chip-pixel-glyph">${glyph}</span>` : ""}${clockTag}</button>`;
    })
    .join("");
  return `<div class="review-strip" id="review-strip">${chips}</div>`;
}

const TALLY_NOUN: Record<string, [singular: string, plural: string]> = {
  best: ["best", "best"],
  excellent: ["excellent", "excellent"],
  good: ["good", "good"],
  inaccuracy: ["inaccuracy", "inaccuracies"],
  mistake: ["mistake", "mistakes"],
  blunder: ["blunder", "blunders"],
};

export function renderQualityTally(review: ReviewGame): string {
  const tally = tallyHumanQuality(review);
  if (!tally.length) return "";
  const items = tally
    .map(({ classification, count }) => {
      const noun = TALLY_NOUN[classification] ?? [classification, classification];
      const color = getClassColor(classification);
      const glyph = getClassGlyph(classification);
      return `<span class="quality-tally-item" data-tier="${classification}"><span class="quality-pixel-badge" style="--badge-color:${color}"><span class="pixel-glyph">${glyph}</span><span class="pixel-count">${count}</span></span><span class="tally-label">${count === 1 ? noun[0] : noun[1]}</span></span>`;
    })
    .join("");
  return `<div class="quality-tally">${items}</div>`;
}

/** The ranked candidate moves for the position on the board. Each is a
 * button: tapping one draws it as an arrow. `playedUci` marks the move that
 * was actually played. */
export function renderCandidateList(
  candidates: Candidate[],
  opts: { playedUci?: string; playedSan?: string; previewUci?: string | null },
): string {
  if (!candidates.length) return "";
  const chips = candidates
    .map((c) => {
      const color = getClassColor(c.tier);
      const played = c.uci === opts.playedUci;
      const classes = ["candidate-chip", played ? "candidate-chip-played" : "", c.uci === opts.previewUci ? "candidate-chip-preview" : ""]
        .filter(Boolean)
        .join(" ");
      const label = REVIEW_QUALITY_LABELS[c.tier] ?? c.tier;
      const title = `${c.san}: ${label}${c.gapCp > 0 ? `, ${c.gapCp}cp behind the best move` : ""}${played ? " — the move you played" : ""}`;
      const glyph = getClassGlyph(c.tier);
      return `<button type="button" class="${classes}" data-candidate="${escapeAttr(c.uci)}" data-tier="${c.tier}" style="--chip-color:${color}" title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}" aria-pressed="${c.uci === opts.previewUci ? "true" : "false"}"><span class="cand-pixel-glyph" style="background:${color}">${glyph}</span><span class="cand-san">${escapeAttr(c.san)}</span><span class="cand-eval">${escapeAttr(formatCandidateEval(c))}</span>${played ? `<span class="cand-tag cand-tag-played">played</span>` : ""}</button>`;
    })
    .join("");
  const playedListed = opts.playedUci ? candidates.some((c) => c.uci === opts.playedUci) : true;
  const outside =
    !playedListed && opts.playedSan
      ? `<p class="candidate-note">Played <strong>${escapeAttr(opts.playedSan)}</strong> (outside top ${candidates.length})</p>`
      : "";
  const shaded = candidates.filter((c) => isShadedTier(c.tier)).length;
  return `<div class="candidate-list" role="group" aria-label="The engine's best moves in this position">${chips}</div>${outside}<p class="candidate-legend">${shaded} top move${shaded === 1 ? "" : "s"} shaded — tap to preview</p>`;
}

export function renderBlunderDna(dna: BlunderDna): string {
  return `
    <div class="blunder-dna-capsule" role="region" aria-label="Blunder DNA breakdown">
      <span class="dna-pill dna-motif" title="Tactical pattern"><span class="dna-icon">${dna.motifIcon}</span> ${escapeAttr(dna.motifLabel)}</span>
      <span class="dna-pill dna-cause" title="Root cause"><span class="dna-icon">${dna.rootCauseIcon}</span> ${escapeAttr(dna.rootCauseLabel)}</span>
      <span class="dna-pill dna-damage" title="Material or evaluation loss"><span class="dna-icon">💥</span> ${escapeAttr(dna.damageLabel)}</span>
    </div>`;
}

export function renderPunishmentAction(opts: {
  hasPunishment: boolean;
  isViewingPunishment: boolean;
  punishmentSan?: string;
}): string {
  if (!opts.hasPunishment) return "";
  const btnClass = opts.isViewingPunishment ? "punishment-toggle-btn active" : "punishment-toggle-btn";
  const btnText = opts.isViewingPunishment
    ? `↩ Back to Played Move`
    : `Show Refutation (${opts.punishmentSan || "Punishment"})`;
  return `<button type="button" class="${btnClass}" id="review-punishment-btn" title="Watch opponent's refutation move on the board">${btnText}</button>`;
}

export function renderThreatRadarAction(opts: { hasThreats: boolean; isActive: boolean }): string {
  if (!opts.hasThreats) return "";
  const btnClass = opts.isActive ? "threat-radar-toggle-btn active" : "threat-radar-toggle-btn";
  const label = opts.isActive ? "Hide Tension Web" : "Threat Radar";
  return `<button type="button" class="${btnClass}" id="review-threat-radar-btn" title="Highlight attacking lasers and victim pieces">${label}</button>`;
}



/** What a blunder tag did, as the end of a sentence about the move. */
const TAG_PHRASE: Record<string, string> = {
  missed_mate: "missed a forced mate",
  allowed_mate: "allowed a forced mate",
  fork: "walked into a fork",
  pin: "allowed a pin",
  skewer: "allowed a skewer",
  back_rank: "left the back rank weak",
  trapped_piece: "left a piece trapped",
  hung_material: "left material hanging",
  missed_capture: "missed a capture",
};

const TIER_NOUN: Record<string, string> = {
  brilliant: "a brilliant move",
  best: "the best move",
  excellent: "an excellent move",
  good: "a good move",
  inaccuracy: "an inaccuracy",
  mistake: "a mistake",
  blunder: "a blunder",
  miss: "a missed chance",
};

/** Two or three short sentences on why the game's turning point decided it:
 * what the move did, how the reviewer's winning chances moved, and what the
 * engine preferred. Plain words, no engine numbers in brackets. */
export function turningPointSentences(review: ReviewGame, index: number): string[] {
  const step = review.steps[index];
  if (!step) return [];
  const name = review.players[step.side]?.name;
  const mover = step.isHuman ? "Your" : name ? `${name}'s` : "Your opponent's";
  const tier = step.tier ?? step.classification;
  const tag = step.blunderTag ? TAG_PHRASE[step.blunderTag] : undefined;
  const what = tag ?? (tier && TIER_NOUN[tier] ? `was ${TIER_NOUN[tier]}` : "changed the game");
  const out = [`${mover} ${step.san} ${what}.`];

  const wins = positionWinChances(review);
  const mine = (w: number) => Math.round(review.humanColor === "white" ? w : 100 - w);
  const before = mine(wins[index]);
  const after = mine(wins[index + 1]);
  if (before !== after) {
    out.push(`Your winning chances ${after > before ? "rose" : "fell"} from ${before}% to ${after}%.`);
  }
  if (step.bestMoveSan && step.bestMoveSan !== step.san && shouldNameBetterMove(tier)) {
    out.push(`${step.bestMoveSan} was the better move.`);
  }
  return out;
}

const shouldNameBetterMove = (tier?: string) => tier === "inaccuracy" || tier === "mistake" || tier === "blunder" || tier === "miss";

/** The game's one decisive moment, as a card that jumps to it on a click:
 * the move and a short plain-English reason it turned the game. Empty when
 * no single move decided it. */
export function renderTurningPoint(review: ReviewGame, currentIndex: number): string {
  const moment = computeStorylineMoments(review).find((m) => m.kind === "turning_point");
  if (!moment) return "";
  const moveStr = `${moment.moveNumber}${moment.side === "white" ? "." : "…"} ${moment.san}`;
  const tier = review.steps[moment.index]?.tier ?? moment.classification;
  const color = tier ? getClassColor(tier) : "var(--accent)";
  const glyph = tier ? getClassGlyph(tier) : "";
  const why = turningPointSentences(review, moment.index).join(" ");
  const current = currentIndex === moment.index ? " turning-point-current" : "";
  return `
    <button type="button" class="turning-point-card${current}" data-review-index="${moment.index}" style="--tp-color:${color}" aria-label="${escapeAttr(`Turning point, ${moveStr}. ${why} Jump to this move.`)}">
      <span class="tp-head"><span class="tp-bolt">${iconZap}</span> Turning Point <span class="tp-dot" aria-hidden="true">·</span> <span class="tp-move">${escapeAttr(moveStr)}</span>${glyph ? ` <span class="tp-glyph" aria-hidden="true">${glyph}</span>` : ""}</span>
      <span class="tp-why">${escapeAttr(why)}</span>
    </button>`;
}
