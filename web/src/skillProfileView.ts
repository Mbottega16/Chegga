// Chegga Web — rendering for skillProfile.ts's growth-path assessment

import type { SkillAssessment, SkillCategoryId } from "./skillProfile";
import { SKILL_CATEGORY_LABELS } from "./skillProfile";
import type { SkillSnapshotRecord } from "./db";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function scoreColor(score: number): string {
  if (score >= 80) return "#4ade80";
  if (score >= 60) return "#e3a857";
  if (score >= 40) return "#f2a13f";
  return "#f2555a";
}

const CHART_W = 520;
const CHART_H = 120;
const CHART_PAD = 24;

function renderTrendChart(snapshots: SkillSnapshotRecord[], category: SkillCategoryId): string {
  const points = snapshots.filter((s) => s.scores[category] !== undefined).map((s) => ({ x: s.timestamp, y: s.scores[category], date: s.dateStamp }));
  if (points.length < 2) {
    return `<p class="status-line">Check back after a few more sync/analyze sessions to see a real trend line here — need at least 2 data points, have ${points.length}.</p>`;
  }

  const minT = points[0].x;
  const maxT = points[points.length - 1].x;
  const tRange = Math.max(1, maxT - minT);

  const x = (t: number) => CHART_PAD + ((t - minT) / tRange) * (CHART_W - CHART_PAD * 2);
  const y = (score: number) => CHART_H - CHART_PAD - (score / 100) * (CHART_H - CHART_PAD * 2);

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.x).toFixed(1)} ${y(p.y).toFixed(1)}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const delta = Math.round((last.y - first.y) * 10) / 10;
  const deltaColor = delta > 0 ? "#4ade80" : delta < 0 ? "#f2555a" : "#8a93a6";

  return `
    <div class="rating-chart-block">
      <h4>${esc(SKILL_CATEGORY_LABELS[category])} over time <span class="status-line">(${first.date} &rarr; ${last.date}, <span style="color:${deltaColor}">${delta >= 0 ? "+" : ""}${delta}</span>)</span></h4>
      <svg viewBox="0 0 ${CHART_W} ${CHART_H}" width="100%" style="max-width:${CHART_W}px" role="img" aria-label="${esc(SKILL_CATEGORY_LABELS[category])} score over time">
        <line x1="${CHART_PAD}" y1="${CHART_H - CHART_PAD}" x2="${CHART_W - CHART_PAD}" y2="${CHART_H - CHART_PAD}" stroke="#232833" stroke-width="1"/>
        <path d="${pathD}" fill="none" stroke="#e3a857" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${x(last.x).toFixed(1)}" cy="${y(last.y).toFixed(1)}" r="4" fill="#e3a857"/>
        <text x="${CHART_PAD}" y="14" font-size="11" fill="#8a93a6" font-family="monospace">0-100</text>
        <text x="${x(first.x).toFixed(1)}" y="${CHART_H - 8}" font-size="10" fill="#5c6478" font-family="monospace" text-anchor="start">${Math.round(first.y)}</text>
        <text x="${x(last.x).toFixed(1)}" y="${CHART_H - 8}" font-size="10" fill="#5c6478" font-family="monospace" text-anchor="end">${Math.round(last.y)}</text>
      </svg>
    </div>
  `;
}

/** A one-line "here's what moved since you were last here" banner
 * (critique #1): diff the two most recent daily snapshots per category.
 * Higher score = better play, so a positive delta is green. Silent if
 * there's only one snapshot or nothing changed by at least a point. */
function renderSinceLastVisit(snapshots: SkillSnapshotRecord[]): string {
  if (snapshots.length < 2) return "";
  const curr = snapshots[snapshots.length - 1];
  const prev = snapshots[snapshots.length - 2];
  const days = Math.max(1, Math.round((curr.timestamp - prev.timestamp) / 86_400_000));

  const parts: string[] = [];
  (Object.keys(SKILL_CATEGORY_LABELS) as SkillCategoryId[]).forEach((cat) => {
    const a = prev.scores[cat];
    const b = curr.scores[cat];
    if (a === undefined || b === undefined) return;
    const d = Math.round((b - a) * 10) / 10;
    if (Math.abs(d) < 1) return;
    const color = d > 0 ? "#4ade80" : "#f2555a";
    parts.push(`${esc(SKILL_CATEGORY_LABELS[cat])} <span style="color:${color}">${d > 0 ? "+" : ""}${d}</span>`);
  });

  if (parts.length === 0) {
    return `<p class="status-line" style="margin-bottom:12px">No measurable change since your last session (${days}d ago) — analyze more games to move the needle.</p>`;
  }
  return `<p class="since-last-visit" style="margin-bottom:12px"><strong>Since ${days}d ago:</strong> ${parts.join(" · ")}</p>`;
}

const BAND_WORDS: [number, string][] = [
  [80, "strong"],
  [60, "solid"],
  [40, "shaky"],
  [0, "weak"],
];

function bandWord(score: number): string {
  return BAND_WORDS.find(([min]) => score >= min)![1];
}

/** `coverage` says how much of the synced history the scores are based on. */
export function renderSkillProfile(
  assessment: SkillAssessment,
  snapshots: SkillSnapshotRecord[],
  coverage: { analyzed: number; synced: number },
): string {
  const sinceLastVisit = renderSinceLastVisit(snapshots);
  const coverageLine = `<p class="skill-coverage">Based on <strong>${coverage.analyzed}</strong> analyzed of <strong>${coverage.synced}</strong> synced games.</p>`;
  const rows = assessment.scores
    .map((s) => {
      const label = esc(SKILL_CATEGORY_LABELS[s.category]);
      if (s.score === undefined) {
        return `<li class="skill-row"><span class="skill-row-name">${label}</span><span class="skill-row-read">Not enough yet: ${s.moveCount} of 20 moves</span></li>`;
      }
      const isWeakest = assessment.weakest?.category === s.category;
      return `<li class="skill-row${isWeakest ? " skill-row-weakest" : ""}">
          <span class="skill-row-name">${label}${isWeakest ? " (focus)" : ""}</span>
          <span class="skill-row-score" style="color:${scoreColor(s.score)}">${Math.round(s.score)}/100</span>
          <span class="skill-row-read">${bandWord(s.score)} · ${s.moveCount} moves</span>
        </li>`;
    })
    .join("");
  const bars = `${coverageLine}<ul class="skill-rows">${rows}</ul>`;

  if (!assessment.weakest) {
    return `
      ${sinceLastVisit}
      <div class="skill-bars">${bars}</div>
      <p class="status-line" style="margin-top:12px">${esc(assessment.rootCause)}</p>
    `;
  }

  const prescriptionButton = assessment.prescription
    ? `<button type="button" id="skill-prescription-btn" data-action="${esc(JSON.stringify(assessment.prescription.action))}">Go practice this &darr;</button>`
    : "";

  return `
    ${sinceLastVisit}
    <div class="skill-bars">${bars}</div>
    <div class="skill-focus-card">
      <h3 style="margin-top:0">Current focus: ${esc(SKILL_CATEGORY_LABELS[assessment.weakest.category])}</h3>
      <p>${esc(assessment.rootCause)}</p>
      ${assessment.prescription ? `<p><strong>Prescribed:</strong> ${esc(assessment.prescription.text)}</p>` : ""}
      ${prescriptionButton}
    </div>
    ${renderTrendChart(snapshots, assessment.weakest.category)}
  `;
}
