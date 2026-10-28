// Chegga Web — render for the "Today" daily session card.
// Pure: returns HTML. The Start buttons carry data-attributes; main.ts
// handles what they do (scroll to + configure the relevant card).

import type { TodayState, TodayStreak } from "./today";
import { isTodayComplete } from "./today";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function renderToday(state: TodayState, streak: TodayStreak): string {
  const complete = isTodayComplete(state);
  const total = Math.max(1, state.items.length);
  const doneCount = state.items.filter((i) => i.done >= i.target).length;
  const pct = Math.round((doneCount / total) * 100);
  const radius = 18;
  const circum = 2 * Math.PI * radius;
  const dashOffset = circum - (pct / 100) * circum;

  const ringSvg = `
    <div class="today-ring-wrap" aria-hidden="true">
      <svg class="today-ring-svg" viewBox="0 0 44 44" width="44" height="44">
        <circle cx="22" cy="22" r="${radius}" fill="none" stroke="#222a3a" stroke-width="4" />
        <circle cx="22" cy="22" r="${radius}" fill="none" stroke="${complete ? "#4ade80" : "#e3a857"}" stroke-width="4"
          stroke-linecap="round" stroke-dasharray="${circum.toFixed(1)}" stroke-dashoffset="${dashOffset.toFixed(1)}"
          transform="rotate(-90 22 22)" />
        <text x="22" y="25.5" text-anchor="middle" fill="#edeff3" font-family="JetBrains Mono, monospace" font-size="10.5" font-weight="800">${doneCount}/${state.items.length}</text>
      </svg>
    </div>`;

  const rows = state.items
    .map((item) => {
      const itemDone = item.done >= item.target;
      const dots = Array.from({ length: item.target }, (_, i) => `<span class="today-dot${i < item.done ? " today-dot-on" : ""}"></span>`).join("");
      const action = itemDone
        ? `<span class="today-check">✓</span>`
        : `<button type="button" class="today-start-btn" data-today-kind="${item.kind}">Start</button>`;
      return `
        <li class="today-item${itemDone ? " today-item-done" : ""}">
          <div class="today-item-main">
            <span class="today-item-label">${esc(item.label)}</span>
            <span class="today-dots">${dots}</span>
          </div>
          ${action}
        </li>`;
    })
    .join("");

  const header = complete
    ? `<div class="today-summary-bar">${ringSvg}<div class="today-summary-copy"><p class="today-complete">Today's set complete ✓ &nbsp;<span class="status-line">🔥 ${streak.current}-day Today streak (best ${streak.best})</span></p><p class="status-line"><button type="button" id="today-keep-going" class="today-start-btn">Keep training ↓</button></p></div></div>`
    : `<div class="today-summary-bar">${ringSvg}<div class="today-summary-copy"><p class="status-line">${doneCount}/${state.items.length} done · 🔥 ${streak.current}-day Today streak</p></div></div>`;

  return `
    ${header}
    <ul class="today-list">${rows}</ul>
  `;
}
