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
import { moveLabel, tallyHumanQuality, REVIEW_QUALITY_LABELS, type ReviewGame } from "./gameReview";
import { formatCandidateEval, isShadedTier, type Candidate } from "./candidateMoves";
import type { BlunderDna } from "./blunderTagger";

function escapeAttr(text: string): string {
  return text.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
}

/** An interactive evaluation advantage curve for the whole game.
 * Plots White advantage (+) vs Black advantage (-) with clickable points
 * colored by the move quality system and time-trouble heat zones. */
export function renderEvalGraph(review: ReviewGame, currentIndex: number): string {
  if (!review.steps.length) return "";
  const n = review.steps.length;
  // White-relative evaluation in pawns clamped to [-8, +8]
  let prevScore = 0;
  const scores: number[] = review.steps.map((step) => {
    if (step.evalAfterMate !== undefined) {
      prevScore = step.evalAfterMate > 0 ? 8 : -8;
    } else if (step.evalAfterCp !== undefined) {
      prevScore = Math.max(-8, Math.min(8, step.evalAfterCp / 100));
    }
    return prevScore;
  });

  const getX = (i: number) => {
    if (n === 1) return 50;
    return 3 + (i / (n - 1)) * 94;
  };
  const getY = (score: number) => {
    // 0 is at y=20, +8 at y=4, -8 at y=36
    return 20 - (score / 8) * 16;
  };

  const points = scores.map((s, i) => ({ x: getX(i), y: getY(s), score: s }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  // Fill polygon above midline (White advantage) and below midline (Black advantage)
  const whitePoly = [
    `M ${getX(0).toFixed(1)} 20`,
    ...points.map((p) => `L ${p.x.toFixed(1)} ${Math.min(20, p.y).toFixed(1)}`),
    `L ${getX(n - 1).toFixed(1)} 20`,
    "Z",
  ].join(" ");

  const blackPoly = [
    `M ${getX(0).toFixed(1)} 20`,
    ...points.map((p) => `L ${p.x.toFixed(1)} ${Math.max(20, p.y).toFixed(1)}`),
    `L ${getX(n - 1).toFixed(1)} 20`,
    "Z",
  ].join(" ");

  // Time-trouble / clock-panic heat bands behind the curve
  const stepWidth = n > 1 ? Math.max(1.8, 94 / (n - 1)) : 6;
  const heatBands = review.steps
    .map((step, i) => {
      if (!step.clockAlert) return "";
      const p = points[i];
      if (!p) return "";
      const bandColor = step.clockAlert === "panic" ? "#e53935" : "#ffb300";
      const opacity = step.clockAlert === "panic" ? "0.22" : "0.14";
      return `<rect x="${(p.x - stepWidth / 2).toFixed(1)}" y="2" width="${stepWidth.toFixed(1)}" height="36" fill="${bandColor}" fill-opacity="${opacity}" class="eval-heat-band eval-heat-${step.clockAlert}"/>`;
    })
    .join("");

  // Interactive dots for moves with move quality or annotations
  const dots = review.steps
    .map((step, i) => {
      const p = points[i];
      if (!p) return "";
      const isHuman = step.isHuman;
      const tier = step.classification;
      if (!isHuman || !tier) return "";
      const color = getClassColor(tier);
      const glyph = getClassGlyph(tier);
      const isMajor = tier === "brilliant" || tier === "blunder";
      const radius = isMajor ? 2.5 : 1.55;
      const glyphTag = isMajor
        ? `<text x="${p.x.toFixed(1)}" y="${p.y < 20 ? (p.y - 3.3).toFixed(1) : (p.y + 5.8).toFixed(1)}" font-family="JetBrains Mono, monospace" font-size="3.4" font-weight="900" fill="${color}" text-anchor="middle" class="eval-graph-glyph">${glyph}</text>`
        : "";
      return `
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${radius}" fill="${color}" stroke="#0b0f17" stroke-width="0.7"
                class="eval-graph-node" data-review-index="${i}" data-tier="${tier}">
          <title>${escapeAttr(moveLabel(step))}: ${tier} (${p.score > 0 ? "+" : ""}${p.score.toFixed(1)})</title>
        </circle>
        ${glyphTag}`;
    })
    .join("");

  // Current move cursor line and value tag
  let cursorSvg = "";
  if (currentIndex >= 0 && currentIndex < n) {
    const curP = points[currentIndex];
    if (curP) {
      const curScore = curP.score;
      const curLabel = curScore > 0 ? `+${curScore.toFixed(1)}` : curScore.toFixed(1);
      cursorSvg = `
        <line x1="${curP.x.toFixed(1)}" y1="2" x2="${curP.x.toFixed(1)}" y2="38" stroke="var(--accent)" stroke-width="1.2" stroke-dasharray="1.5,1.5" class="eval-graph-cursor"/>
        <circle cx="${curP.x.toFixed(1)}" cy="${curP.y.toFixed(1)}" r="2.9" fill="var(--accent)" stroke="#fff" stroke-width="1" class="eval-graph-current-dot"/>
        <text x="${curP.x < 84 ? (curP.x + 3.2).toFixed(1) : (curP.x - 3.2).toFixed(1)}" y="7.5" font-family="JetBrains Mono, monospace" font-size="3.6" font-weight="800" fill="var(--accent-strong)" text-anchor="${curP.x < 84 ? "start" : "end"}">${curLabel}</text>`;
    }
  }

  return `
    <div class="eval-graph-container" role="region" aria-label="Game evaluation advantage curve">
      <div class="eval-graph-header">
        <span class="eval-graph-label">Evaluation Flow</span>
        <span class="eval-graph-legend"><span class="legend-white">▲ White</span> <span class="legend-black">▼ Black</span></span>
      </div>
      <svg class="eval-graph-svg" viewBox="0 0 100 40" preserveAspectRatio="none">
        <defs>
          <linearGradient id="white-eval-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.34"/>
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04"/>
          </linearGradient>
          <linearGradient id="black-eval-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0b0f17" stop-opacity="0.12"/>
            <stop offset="100%" stop-color="#e53935" stop-opacity="0.28"/>
          </linearGradient>
          <filter id="eval-line-glow" x="-10%" y="-20%" width="120%" height="140%">
            <feGaussianBlur stdDeviation="0.9" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <!-- Time-trouble heat bands -->
        ${heatBands}
        <!-- Advantage fills -->
        <path d="${whitePoly}" fill="url(#white-eval-grad)"/>
        <path d="${blackPoly}" fill="url(#black-eval-grad)"/>
        <!-- Midline -->
        <line x1="2" y1="20" x2="98" y2="20" stroke="var(--border-strong)" stroke-width="0.6" stroke-dasharray="1.5,1.5"/>
        <!-- Eval curve with broadcast glow -->
        <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#eval-line-glow)"/>
        <!-- Interactive node dots -->
        ${dots}
        <!-- Current cursor -->
        ${cursorSvg}
      </svg>
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
      return `<button type="button" class="${classes}" data-candidate="${escapeAttr(c.uci)}" data-tier="${c.tier}" style="--chip-color:${color}" title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}"><span class="cand-pixel-glyph" style="background:${color}">${glyph}</span><span class="cand-san">${escapeAttr(c.san)}</span><span class="cand-eval">${escapeAttr(formatCandidateEval(c))}</span>${played ? `<span class="cand-tag cand-tag-played">played</span>` : ""}</button>`;
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
    : `⚡ Show Refutation (${opts.punishmentSan || "Punishment"})`;
  return `<button type="button" class="${btnClass}" id="review-punishment-btn" title="Watch opponent's refutation move on the board">${btnText}</button>`;
}

export function renderThreatRadarAction(opts: { hasThreats: boolean; isActive: boolean }): string {
  if (!opts.hasThreats) return "";
  const btnClass = opts.isActive ? "threat-radar-toggle-btn active" : "threat-radar-toggle-btn";
  const label = opts.isActive ? "👁️ Hide Tension Web" : "🎯 Threat Radar";
  return `<button type="button" class="${btnClass}" id="review-threat-radar-btn" title="Highlight attacking lasers and victim pieces">${label}</button>`;
}

