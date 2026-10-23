// Chegga Web — game picker: the markup
//
// One horizontal strip of game cards, newest first. Each card shows the
// result, the opponent and rating, the date, the time control, and the
// opening. Hovering or focusing a card shows the first moves of that game.
// Native horizontal scroll with snap, so a swipe and a trackpad both work;
// the two arrow buttons cover a mouse wheel. All strings that come from the
// network or the viewer (usernames, opening names) are escaped.

import type { PickerCard } from "./gamePicker";

function esc(text: string): string {
  return text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const RESULT_LABEL: Record<PickerCard["result"], string> = { win: "Win", loss: "Loss", draw: "Draw" };

function formatDate(endTime: number): string {
  if (!endTime) return "";
  return new Date(endTime * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

function renderCard(card: PickerCard, busyId: string | null): string {
  const busy = busyId === card.id;
  const disabled = !card.supported || (busyId !== null && !busy);
  const classes = ["picker-card", `picker-card-${card.result}`, busy ? "picker-card-busy" : ""]
    .filter(Boolean)
    .join(" ");
  const date = formatDate(card.endTime);
  const meta = [date, card.timeClass].filter(Boolean).join(" · ");
  const label = `${RESULT_LABEL[card.result]} against ${card.opponent}, ${meta}`;
  const opening = !card.supported ? "Variant game" : card.opening || "";
  return `<button type="button" class="${classes}" data-game-id="${esc(card.id)}" ${disabled ? "disabled" : ""} aria-label="${esc(label)}">
    <span class="picker-result">${RESULT_LABEL[card.result]}</span>
    <span class="picker-vs">${esc(card.opponent)} <span class="picker-rating">${card.opponentRating || ""}</span></span>
    <span class="picker-meta">${esc(meta)}</span>
    <span class="picker-opening">${opening ? esc(opening) : "&nbsp;"}</span>
    ${card.preview ? `<span class="picker-preview">${esc(card.preview)}</span>` : ""}
    ${busy ? `<span class="picker-busy-label">Analyzing…</span>` : ""}
  </button>`;
}

export function renderGamePicker(cards: PickerCard[], busyId: string | null, openingName?: string): string {
  // Set from a weak-opening diagnostic's "see these games" jump, with its
  // own way back to the full list.
  const openingBanner = openingName
    ? `<p class="picker-opening-focus">Showing games in <strong>${esc(openingName)}</strong> — <button type="button" class="btn-quiet" data-picker-clear-opening>Clear filter</button></p>`
    : "";
  const body = cards.length
    ? `<div class="picker-carousel">
        <button type="button" class="picker-nav" data-picker-nav="-1" aria-label="Scroll to newer games">◀</button>
        <div class="picker-track" id="picker-track" tabindex="0" role="group" aria-label="Your games, newest first">${cards.map((c) => renderCard(c, busyId)).join("")}</div>
        <button type="button" class="picker-nav" data-picker-nav="1" aria-label="Scroll to older games">▶</button>
      </div>`
    : `<p class="status-line">No games${openingName ? ` in "${esc(openingName)}"` : ""} yet.</p>`;
  return `${openingBanner}${body}`;
}
