// Chegga Web — profile dashboard rendering (Phase 5)
//
// Visual reference only, not shared code, per the phase plan's Phase 5
// decision: same design language/palette as Chegga's real frontend
// (`Chegga/frontend/src/pages/ProfilePage.tsx` for layout,
// `lib/classification.ts` for the move-quality color palette — reused
// exactly so a color means the same thing in both products), rebuilt here
// in plain TS/DOM since this app has no React dependency.

import type { ProfileSummary } from "./profileService";
import type { StrengthEstimate } from "./strengthEstimate";
import { CLASSIFICATION_ORDER, getClassColor } from "./classificationColors";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function statCard(value: string, label: string): string {
  return `<div class="stat-card"><div class="stat-value">${escapeHtml(value)}</div><div class="stat-label">${escapeHtml(label)}</div></div>`;
}

// Below this many analyzed games the rating estimate is too thin a sample
// to show even as a band -- a wild point guess off 4 games reads as
// authoritative when it's essentially noise (critique #5).
const STRENGTH_MIN_GAMES = 15;

export function renderProfile(
  profile: ProfileSummary,
  strength?: { avgEstimate: number; sampleSize: number; cvR2?: number; cvMae?: number },
): string {
  const classificationBar = CLASSIFICATION_ORDER.filter((label) => profile.classificationCounts[label] > 0)
    .map((label) => {
      const pct = (profile.classificationRate[label] ?? 0) * 100;
      return `<div class="classification-segment" style="width:${pct}%;background:${getClassColor(label)}" title="${label}: ${profile.classificationCounts[label]} moves (${pct.toFixed(1)}%)">${pct >= 6 ? label : ""}</div>`;
    })
    .join("");

  const phaseRows = ["opening", "middlegame", "endgame"]
    .filter((p) => p in profile.phaseAvgCpLoss)
    .map((p) => `<tr><td>${p}</td><td>${profile.phaseAvgCpLoss[p]} cp</td></tr>`)
    .join("");

  const colorRows = ["white", "black"]
    .filter((c) => c in profile.colorAvgCpLoss)
    .map((c) => `<tr><td>${c}</td><td>${profile.colorAvgCpLoss[c]} cp</td></tr>`)
    .join("");

  const openingRows = profile.topOpenings
    .map((o) => {
      const winPct = Math.round(o.winRate * 100);
      const winTone = winPct >= 55 ? "var(--good)" : winPct < 40 ? "var(--blunder)" : "var(--muted)";
      const leakBadge = o.isLeak
        ? `<span class="opening-leak-badge" title="Win rate under 40% or high blunder frequency">⚠️ Leak</span>`
        : "";
      const cpLossStr = o.avgCentipawnLoss !== undefined ? `${o.avgCentipawnLoss} cp` : "-";
      return `
        <tr>
          <td>
            <strong>${escapeHtml(o.openingName)}</strong>
            ${leakBadge}
          </td>
          <td>${o.games}</td>
          <td><span class="result-win">${o.wins}W</span> <span class="result-loss">${o.losses}L</span> <span class="result-draw">${o.draws}D</span></td>
          <td style="color:${winTone};font-weight:600">${winPct}%</td>
          <td>${cpLossStr}</td>
          <td>
            <div class="opening-actions-group">
              <button type="button" class="btn-quiet opening-practice-btn" data-practice-opening="${escapeHtml(o.openingName)}" title="Practice this opening against the bot">Practice ⚔️</button>
              <button type="button" class="btn-quiet opening-review-jump" data-open-games-opening="${escapeHtml(o.openingName)}" title="Filter synced games to this opening">Review →</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  const blunderTagRows = Object.entries(profile.blunderTagCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => `<tr><td>${escapeHtml(tag.replace(/_/g, " "))}</td><td>${count}</td></tr>`)
    .join("");

  const monthlyRows = profile.monthlyTrend
    .map((m) => `<tr><td>${m.yearMonth}</td><td>${m.games}</td><td>${m.avgCentipawnLoss} cp</td><td>${m.blunderRate}/game</td></tr>`)
    .join("");

  const timePressureRows = profile.timePressureBreakdown
    .filter((b) => b.moves > 0)
    .map((b) => `<tr><td>${escapeHtml(b.label)}</td><td>${b.moves}</td><td>${b.avgCentipawnLoss} cp</td><td>${(b.blunderRate * 100).toFixed(1)}%</td></tr>`)
    .join("");

  // A cvR2 this low means the model explains only a small slice of rating
  // variance -- shown honestly rather than left implicit, since a bare
  // number here reads as far more confident than the underlying model
  // actually is (see strengthEstimate.ts).
  // Show a RANGE, not a point value: the model's cross-validated mean
  // absolute error (cvMae) is roughly how far off any single estimate
  // tends to be, so estimate ± cvMae (rounded to 25) is an honest band.
  // Below STRENGTH_MIN_GAMES analyzed games, don't show a number at all.
  let strengthCard = "";
  let strengthCaveat = "";
  if (strength && strength.sampleSize >= STRENGTH_MIN_GAMES) {
    const mid = Math.round(strength.avgEstimate);
    const halfWidth = strength.cvMae ? Math.round(strength.cvMae / 25) * 25 : 150;
    const lo = Math.max(100, mid - halfWidth);
    const hi = mid + halfWidth;
    strengthCard = statCard(`${lo}–${hi}`, `rough rating range (n=${strength.sampleSize})`);
    if (strength.cvR2 !== undefined) {
      strengthCaveat = `<p class="profile-note">A range, not a rating. Loose direction only.</p>`;
    }
  } else if (strength) {
    strengthCaveat = `<p class="profile-note">Need ${STRENGTH_MIN_GAMES} analyzed games for a rating range (you have ${strength.sampleSize}).</p>`;
  }

  return `
    <div class="stat-grid">
      ${statCard(`${((profile.classificationRate.blunder ?? 0) * 100).toFixed(1)}%`, "blunder rate")}
      ${statCard(`${profile.avgCentipawnLoss} cp`, "avg centipawn loss")}
      ${statCard(String(profile.gamesAnalyzed), "games analyzed")}
      ${statCard(String(profile.totalMoves), "own moves analyzed")}
      ${strengthCard}
    </div>
    ${strengthCaveat}

    <div class="profile-grid">
      <div class="profile-block">
        <h3>Move quality</h3>
        <div class="classification-bar">${classificationBar}</div>
      </div>

      <div class="profile-block">
        <h3>By game phase</h3>
        <table><tbody>${phaseRows || '<tr><td colspan="2" class="status-line">no data yet</td></tr>'}</tbody></table>
        <h3>By color</h3>
        <table><tbody>${colorRows || '<tr><td colspan="2" class="status-line">no data yet</td></tr>'}</tbody></table>
      </div>

      <div class="profile-block profile-wide">
        <h3>Opening repertoire & leaks</h3>
        <table>
          <thead><tr><th>Opening</th><th>Games</th><th>Record</th><th>Win rate</th><th>Avg loss</th><th>Action</th></tr></thead>
          <tbody>${openingRows || '<tr><td colspan="6" class="status-line">no data yet</td></tr>'}</tbody>
        </table>
      </div>

      <div class="profile-block">
        <h3>Blunder patterns</h3>
        <table>
          <thead><tr><th>Tag</th><th>Count</th></tr></thead>
          <tbody>${blunderTagRows || '<tr><td colspan="2" class="status-line">no data yet</td></tr>'}</tbody>
        </table>
      </div>

      <div class="profile-block">
        <h3>Time pressure</h3>
        <table>
          <thead><tr><th>Band</th><th>Moves</th><th>Avg CP loss</th><th>Blunder rate</th></tr></thead>
          <tbody>${timePressureRows || '<tr><td colspan="4" class="status-line">no data yet</td></tr>'}</tbody>
        </table>
      </div>

      <div class="profile-block profile-wide">
        <h3>Monthly trend</h3>
        <table>
          <thead><tr><th>Month</th><th>Games</th><th>Avg CP loss</th><th>Blunder rate</th></tr></thead>
          <tbody>${monthlyRows || '<tr><td colspan="4" class="status-line">no data yet</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
}

export type { StrengthEstimate };
