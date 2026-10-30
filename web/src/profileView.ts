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
      const count = profile.classificationCounts[label] ?? 0;
      const text = pct >= 8 ? `${label} ${pct.toFixed(0)}%` : pct >= 4 ? `${pct.toFixed(0)}%` : "";
      return `<div class="classification-segment" style="width:${pct}%;background:${getClassColor(label)}" title="${label}: ${count} moves (${pct.toFixed(1)}%)">${text}</div>`;
    })
    .join("");

  const classificationBreakdown = CLASSIFICATION_ORDER.filter((label) => (profile.classificationCounts[label] ?? 0) > 0)
    .map((label) => {
      const pct = ((profile.classificationRate[label] ?? 0) * 100).toFixed(1);
      const count = profile.classificationCounts[label] ?? 0;
      const color = getClassColor(label);
      return `
        <div class="quality-tier-card" style="--tier-color: ${color}">
          <div class="quality-tier-top">
            <span class="quality-tier-dot" style="background: ${color}"></span>
            <span class="quality-tier-name">${label}</span>
            <span class="quality-tier-pct">${pct}%</span>
          </div>
          <div class="quality-tier-meta">
            <span class="quality-tier-count">${count} moves</span>
          </div>
          <div class="quality-tier-bar">
            <div class="quality-tier-bar-fill" style="width: ${pct}%; background: ${color}"></div>
          </div>
        </div>`;
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
    strengthCard = statCard(`${lo}–${hi}`, `est. rating band (n=${strength.sampleSize})`);
  } else if (strength) {
    strengthCaveat = `<p class="status-line" style="margin-bottom:12px">Analyze ${STRENGTH_MIN_GAMES}+ games (${strength.sampleSize} so far) to unlock rating band estimate.</p>`;
  }

  // Build SVG radial donut for move quality distribution
  const radius = 30;
  const circum = 2 * Math.PI * radius;
  let accumPct = 0;
  const donutSegments = CLASSIFICATION_ORDER.filter((label) => profile.classificationCounts[label] > 0)
    .map((label) => {
      const rate = profile.classificationRate[label] ?? 0;
      const len = rate * circum;
      const offset = -accumPct * circum;
      accumPct += rate;
      return `<circle cx="40" cy="40" r="${radius}" fill="none" stroke="${getClassColor(label)}" stroke-width="10" stroke-dasharray="${len.toFixed(2)} ${circum.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" transform="rotate(-90 40 40)"/>`;
    })
    .join("");
  const goodRate = Math.round(
    ((profile.classificationRate.best ?? 0) +
      (profile.classificationRate.excellent ?? 0) +
      (profile.classificationRate.good ?? 0)) *
      100,
  );

  return `
    <div class="stat-grid">
      ${statCard(String(profile.gamesAnalyzed), "games analyzed")}
      ${statCard(String(profile.totalMoves), "moves graded")}
      ${statCard(`${profile.avgCentipawnLoss} cp`, "avg cp loss")}
      ${statCard(`${((profile.classificationRate.blunder ?? 0) * 100).toFixed(1)}%`, "blunder rate")}
      ${strengthCard}
    </div>
    ${strengthCaveat}

    <div class="profile-quality-showcase">
      <div class="profile-donut-wrap" aria-hidden="true">
        <svg viewBox="0 0 80 80" width="84" height="84" class="profile-donut-svg">
          <circle cx="40" cy="40" r="${radius}" fill="none" stroke="#1b2230" stroke-width="10"/>
          ${donutSegments}
          <text x="40" y="39" text-anchor="middle" fill="#edeff3" font-family="JetBrains Mono, monospace" font-size="13" font-weight="800">${goodRate}%</text>
          <text x="40" y="50" text-anchor="middle" fill="#9aa4b6" font-family="Inter, sans-serif" font-size="7.5" font-weight="600">SOLID+</text>
        </svg>
      </div>
      <div class="profile-quality-bar-col">
        <div class="profile-quality-title-row">
          <h3>Move quality distribution</h3>
          <span class="profile-quality-total">${profile.totalMoves} total moves evaluated</span>
        </div>
        <div class="classification-bar">${classificationBar}</div>
        <div class="quality-breakdown-grid">${classificationBreakdown}</div>
      </div>
    </div>

    <div class="profile-bento-grid">
      <div class="profile-bento-tile">
        <h3>By game phase</h3>
        <table><tbody>${phaseRows || '<tr><td colspan="2" class="status-line">no data yet</td></tr>'}</tbody></table>
      </div>
      <div class="profile-bento-tile">
        <h3>By color</h3>
        <table><tbody>${colorRows || '<tr><td colspan="2" class="status-line">no data yet</td></tr>'}</tbody></table>
      </div>
      <div class="profile-bento-tile">
        <h3>Blunder motifs</h3>
        <table>
          <thead><tr><th>Motif</th><th>Count</th></tr></thead>
          <tbody>${blunderTagRows || '<tr><td colspan="2" class="status-line">no data yet</td></tr>'}</tbody>
        </table>
      </div>
      <div class="profile-bento-tile">
        <h3>Time pressure</h3>
        <table>
          <thead><tr><th>Band</th><th>Moves</th><th>Avg loss</th><th>Blunders</th></tr></thead>
          <tbody>${timePressureRows || '<tr><td colspan="4" class="status-line">no data yet</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    ${renderSweetSpot(profile)}
    ${renderMirrorOfHabits(profile)}

    <h3>Opening repertoire &amp; leak diagnostic</h3>
    <table>
      <thead><tr><th>Opening</th><th>Games</th><th>Record</th><th>Win rate</th><th>Avg loss</th><th>Action</th></tr></thead>
      <tbody>${openingRows || '<tr><td colspan="6" class="status-line">no data yet</td></tr>'}</tbody>
    </table>

    ${monthlyRows ? `<h3>Monthly trend</h3><table><thead><tr><th>Month</th><th>Games</th><th>Avg CP loss</th><th>Blunder rate</th></tr></thead><tbody>${monthlyRows}</tbody></table>` : ""}
  `;
}

function renderSweetSpot(profile: ProfileSummary): string {
  if (!profile.sweetSpot || !profile.sweetSpot.buckets.some((b) => b.moves > 0)) {
    return "";
  }
  const buckets = profile.sweetSpot.buckets;

  // Personalized SVG pace icons for each thinking speed band
  const paceIcons: Record<string, string> = {
    "< 2s": `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    "2–5s": `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    "5–15s": `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>`,
    "15–30s": `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.7 3.6 5.8.5.3.8.8.8 1.4V18h5.2v-1.8c0-.6.3-1.1.8-1.4A7 7 0 0 0 12 2z"></path><path d="M9 21h6"></path></svg>`,
    "> 30s": `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"></path><path d="M5 2h14"></path><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"></path><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"></path></svg>`,
  };

  const bars = buckets
    .map((b) => {
      const isSweet = b.label === profile.sweetSpot?.sweetSpotLabel;
      const barHeight = Math.max(8, Math.round((b.accuracyRate / 100) * 58));
      const strokeColor = isSweet ? "var(--accent)" : "var(--border-strong)";
      const fillColor = isSweet
        ? "linear-gradient(180deg, var(--accent) 0%, rgba(229, 160, 48, 0.45) 100%)"
        : "linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.04) 100%)";
      const icon = paceIcons[b.label] || paceIcons["5–15s"];

      return `
        <div class="sweet-spot-bar-col ${isSweet ? "is-sweet-spot" : ""}">
          <div class="sweet-spot-col-icon" title="${b.label} pace">${icon}</div>
          <div class="sweet-spot-metric-val">${b.accuracyRate}%</div>
          <div class="sweet-spot-bar-wrap" title="${b.label}: ${b.moves} moves, ${b.accuracyRate}% accurate, ${b.blunderRate}% blunders">
            <div class="sweet-spot-bar" style="height:${barHeight}px;background:${fillColor};border:1px solid ${strokeColor}"></div>
          </div>
          <div class="sweet-spot-label">${b.label.split(" ")[0]}</div>
          <div class="sweet-spot-sub">${b.moves} moves</div>
        </div>`;
    })
    .join("");

  const bannerText = profile.sweetSpot.sweetSpotLabel
    ? `<div class="sweet-spot-banner-inner">
        <span class="sweet-spot-banner-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="4"></circle>
            <line x1="22" y1="12" x2="18" y2="12"></line>
            <line x1="6" y1="12" x2="2" y2="12"></line>
            <line x1="12" y1="6" x2="12" y2="2"></line>
            <line x1="12" y1="22" x2="12" y2="18"></line>
          </svg>
        </span>
        <div class="sweet-spot-banner-text">
          <strong>Optimal Decision Pace:</strong> ${escapeHtml(profile.sweetSpot.sweetSpotLabel)} (${profile.sweetSpot.sweetSpotAccuracy}% accuracy peak). ${profile.sweetSpot.rushBlunderPenalty ? `Rushing in &lt;2s increases blunder frequency by <strong>+${profile.sweetSpot.rushBlunderPenalty}%</strong>.` : ""}
        </div>
      </div>`
    : "Track more games to discover your optimal thinking pace.";

  return `
    <div class="profile-sweet-spot-card">
      <div class="sweet-spot-header">
        <div>
          <h3>The Thinking Sweet Spot (Time vs. Accuracy)</h3>
          <p class="section-tagline">How move accuracy and blunders correlate with seconds spent on the clock.</p>
        </div>
        <span class="sweet-spot-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          Decision Pace
        </span>
      </div>
      <div class="sweet-spot-banner">${bannerText}</div>
      <div class="sweet-spot-chart">${bars}</div>
    </div>`;
}

function renderMirrorOfHabits(profile: ProfileSummary): string {
  if (!profile.mirrorOfHabits || profile.mirrorOfHabits.topLeaks.length === 0) {
    return "";
  }
  const leakCards = profile.mirrorOfHabits.topLeaks
    .slice(0, 4)
    .map((l) => {
      return `
        <div class="motif-leak-card" data-motif="${escapeHtml(l.motif)}">
          <div class="leak-card-top">
            <span class="leak-icon">${l.icon}</span>
            <div class="leak-text">
              <span class="leak-name">${escapeHtml(l.label)}</span>
              <span class="leak-count">${l.count}× (${l.share}%)</span>
            </div>
          </div>
          <button type="button" class="btn-quiet leak-train-btn" data-train-motif="${escapeHtml(l.motif)}" title="Train puzzles matching ${escapeHtml(l.label)}">Train This Leak ⚔️</button>
        </div>`;
    })
    .join("");

  const endangeredHtml = profile.mirrorOfHabits.mostEndangeredPiece
    ? `<span class="habit-endangered-pill" title="Piece most often left vulnerable">🛡️ Most Endangered: <strong>${escapeHtml(profile.mirrorOfHabits.mostEndangeredPiece.piece)}</strong> (${profile.mirrorOfHabits.mostEndangeredPiece.count} blunders)</span>`
    : "";

  const tiltHtml =
    profile.tilt && profile.tilt.totalBlunders > 0
      ? `<span class="habit-tilt-pill" title="Blunders immediately following another mistake">🌀 Error Spiral: <strong>${profile.tilt.clusterRate}%</strong> ${profile.tilt.postMistakeRushRate > 0 ? `(${profile.tilt.postMistakeRushRate}% rushed after error)` : ""}</span>`
      : "";

  return `
    <div class="profile-mirror-card">
      <div class="mirror-header">
        <div>
          <h3>The Mirror of Habits (Recurring Tactical Leaks)</h3>
          <p class="section-tagline">Pattern recognition over raw centipawns: drill your most frequent recurring mistakes.</p>
        </div>
        <div class="mirror-meta-pills">
          ${endangeredHtml}
          ${tiltHtml}
        </div>
      </div>
      <div class="motif-leaks-grid">${leakCards}</div>
    </div>`;
}

export type { StrengthEstimate };
