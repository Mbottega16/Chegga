// Chegga Web — game picker: the markup
//
// A row of swipeable game cards (native horizontal scroll with snap, so a
// thumb swipe and a trackpad both work; the two arrow buttons cover a mouse
// wheel that only scrolls vertically) under a row of result filters. Below
// it, the positions the viewer saved from a review. All strings that come
// from the network or the viewer (usernames, opening names, saved moves)
// are escaped.

import type { PickerCard, PickerFilter } from "./gamePicker";
import type { SavedPuzzleRecord } from "./db";
import { describeSavedPuzzle, isDueForReview, describeSpacedBox } from "./savedPuzzles";
import { extractPreviewFromPgn, renderMiniBoardSvg } from "./miniBoardSvg";

function esc(text: string): string {
  return text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const RESULT_LABEL: Record<PickerCard["result"], string> = { win: "Win", loss: "Loss", draw: "Draw" };

const FILTERS: { id: PickerFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "win", label: "Wins" },
  { id: "loss", label: "Losses" },
  { id: "draw", label: "Draws" },
  { id: "analyzed", label: "Analyzed" },
];

function formatDate(endTime: number): string {
  if (!endTime) return "";
  return new Date(endTime * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function statusLine(card: PickerCard, busy: boolean): string {
  if (!card.supported) return "Variant game — can't be reviewed";
  if (busy) return "Analyzing…";
  return card.analyzed ? "Ready to review" : "Analyze & review";
}

function renderCard(card: PickerCard, busyId: string | null): string {
  const busy = busyId === card.id;
  const disabled = !card.supported || (busyId !== null && !busy);
  const classes = ["picker-card", `picker-card-${card.result}`, card.analyzed ? "picker-card-ready" : "", busy ? "picker-card-busy" : ""]
    .filter(Boolean)
    .join(" ");
  const meta = [formatDate(card.endTime), card.timeClass, `as ${card.color === "white" ? "White" : "Black"}`]
    .filter(Boolean)
    .join(" · ");
  const label = `${RESULT_LABEL[card.result]} against ${card.opponent}, ${meta}`;
  const preview = extractPreviewFromPgn(card.pgn ?? "");
  const miniBoard = renderMiniBoardSvg(preview.fen, card.color, preview.lastMove);
  const statusIcon = card.analyzed ? "✦" : busy ? "◌" : "▶";

  return `<button type="button" class="${classes}" data-game-id="${esc(card.id)}" data-pgn="${esc(card.pgn ?? "")}" data-orientation="${card.color}" ${disabled ? "disabled" : ""} aria-label="${esc(label)}">
    <div class="picker-card-top">
      <div class="picker-mini-board-wrap">
        <div class="picker-mini-board-svg-wrap">
          ${miniBoard}
        </div>
      </div>
      <div class="picker-card-info">
        <div class="game-card-player">
          <div class="game-card-name-group">
            <span class="game-card-vs">vs</span>
            <strong class="game-card-opponent">${esc(card.opponent)}</strong>
            ${card.opponentRating ? `<span class="picker-rating">(${card.opponentRating})</span>` : ""}
          </div>
          <span class="picker-result picker-result-badge">${RESULT_LABEL[card.result]}</span>
        </div>
        <div class="game-card-sub">
          <span class="picker-opening">${card.opening ? esc(card.opening) : "Standard Game"}</span>
          <span class="picker-meta">${esc(meta)}</span>
        </div>
        <span class="picker-status"><span class="picker-status-dot" aria-hidden="true">${statusIcon}</span> ${statusLine(card, busy)}</span>
      </div>
    </div>
  </button>`;
}

export function renderGamePicker(
  cards: PickerCard[],
  counts: Record<PickerFilter, number>,
  filter: PickerFilter,
  busyId: string | null,
  openingName?: string,
): string {
  const chips = FILTERS.map(
    (f) =>
      `<button type="button" class="picker-filter${f.id === filter ? " picker-filter-active" : ""}" data-picker-filter="${f.id}" aria-pressed="${f.id === filter}">${f.label} <span class="picker-count">${counts[f.id]}</span></button>`,
  ).join("");
  const openingBanner = openingName
    ? `<p class="picker-opening-focus">Showing games in <strong>${esc(openingName)}</strong> — <button type="button" class="btn-quiet" data-picker-clear-opening>Clear filter</button></p>`
    : "";
  const body = cards.length
    ? `<div class="picker-carousel">
        <button type="button" class="picker-nav" data-picker-nav="-1" aria-label="Scroll to newer games">◀</button>
        <div class="picker-track" id="picker-track" tabindex="0" role="group" aria-label="Your games, newest first">${cards.map((c) => renderCard(c, busyId)).join("")}</div>
        <button type="button" class="picker-nav" data-picker-nav="1" aria-label="Scroll to older games">▶</button>
      </div>`
    : `<p class="status-line">No games match this filter${openingName ? ` in "${esc(openingName)}"` : ""}.</p>`;
  return `${openingBanner}<div class="picker-filters" role="group" aria-label="Filter your games">${chips}</div>${body}`;
}

export function renderSavedPositions(saved: SavedPuzzleRecord[], solvedIds: Set<string>): string {
  if (!saved.length) return "";
  const dueCount = saved.filter((p) => isDueForReview(p)).length;
  const dueSummary = dueCount > 0 ? `<span class="saved-due-summary">🔥 ${dueCount} due</span>` : "";

  const rows = saved
    .map((p) => {
      const solved = solvedIds.has(p.id);
      const due = isDueForReview(p);
      const box = p.box ?? 1;
      const boxLabel = describeSpacedBox(box);
      const dueTag = due ? `<span class="saved-due-tag">Due today</span>` : "";
      const boxBadge = `<span class="saved-box-badge box-${box}">${esc(boxLabel)}</span>`;
      const pips = Array.from(
        { length: 5 },
        (_, i) => `<span class="leitner-pip${i < box ? " leitner-pip-filled" : ""}" aria-hidden="true"></span>`,
      ).join("");
      const miniBoard = renderMiniBoardSvg(p.fenBefore, p.sideToMove);

      return `<li class="saved-row${due ? " is-due" : ""}">
        <div class="saved-mini-board">${miniBoard}</div>
        <div class="saved-text">
          <div class="saved-title-row">
            <span class="saved-title">${p.sideToMove === "white" ? "White" : "Black"} to move${solved ? ` <span class="saved-solved">solved</span>` : ""}</span>
            ${boxBadge}
            <span class="leitner-pips" aria-hidden="true">${pips}</span>
            ${dueTag}
          </div>
          <span class="saved-meta">${esc(describeSavedPuzzle(p))}${p.openingName ? ` · ${esc(p.openingName)}` : ""}</span>
        </div>
        <div class="saved-actions">
          <button type="button" class="btn-quiet saved-try-btn" data-saved-try="${esc(p.id)}">Try it</button>
          <button type="button" class="btn-quiet saved-remove-btn" data-saved-remove="${esc(p.id)}" aria-label="Remove this saved position">✕</button>
        </div>
      </li>`;
    })
    .join("");
  return `<div class="saved-vault-header"><h3 class="picker-subheading">Saved Tactical Vault <span class="picker-count">${saved.length}</span></h3>${dueSummary}</div><ul class="saved-list">${rows}</ul>`;
}
