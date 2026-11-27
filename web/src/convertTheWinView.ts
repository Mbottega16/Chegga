// Chegga Web — rendering for convertTheWin.ts

import type { ThrownGame } from "./convertTheWin";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function when(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

export function renderThrownGames(games: ThrownGame[]): string {
  if (games.length === 0) {
    return `<p class="status-line">No analyzed games where you reached a clearly winning position and didn't win it. Analyze more games to populate this.</p>`;
  }

  const losses = games.filter((g) => g.result === "loss").length;
  const rows = games
    .map((g) => {
      const slip = g.slipSan
        ? `move ${g.slipMoveNumber}, <strong>${esc(g.slipSan)}</strong> (−${g.slipCpLoss}cp)`
        : "—";
      // A game can have no source URL (the bundled demo dataset, an import
      // from another site). `href=""` is not an inert link — it reloads the
      // current page, which reads as the app losing your place.
      const link = g.url
        ? `<a href="${esc(g.url)}" target="_blank" rel="noopener">open ↗</a>`
        : "";
      // The engine-checked replay here: main.ts's Studio Lab handler opens
      // [data-review-game] on [data-review-ply] in the game review.
      const review = g.slipPly
        ? `<button type="button" class="btn-quiet ctw-review" data-review-game="${esc(g.gameId)}" data-review-ply="${g.slipPly}">Review the slip</button>`
        : "";
      return `
        <tr>
          <td>${when(g.endTime)}</td>
          <td>${esc(g.timeClass)}</td>
          <td>~${g.opponentRating}</td>
          <td class="ctw-peak">+${g.peakEvalPawns}</td>
          <td class="ctw-result ctw-${g.result}">${g.result}</td>
          <td>${slip}</td>
          <td class="ctw-actions">${review}${link}</td>
        </tr>`;
    })
    .join("");

  return `
    <p class="tagline" style="margin-bottom:14px">
      ${games.length} game${games.length === 1 ? "" : "s"} where you stood clearly winning and it slipped
      (${losses} became losses). Peak = the best evaluation you reached, in pawns, from your side. Replay each from the
      slip move: "Review the slip" opens the engine-checked review here, and "open" goes to the game on its site.
    </p>
    <div class="ctw-table-wrap">
      <table class="ctw-table">
        <thead><tr><th>Date</th><th>Type</th><th>Opp.</th><th>Peak</th><th>Result</th><th>Slipped at</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="card-action">
      <button type="button" data-action='{"kind":"redemption"}'>Redeem one of these losses →</button>
    </p>`;
}
