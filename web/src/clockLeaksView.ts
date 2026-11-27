// Chegga Web — rendering for clockLeaks.ts (the Time trouble tool)
//
// Two bar lists (mistakes per 100 moves by clock left, and by time spent on
// the move), the on-time results, and the advice. Every bar has its numbers
// written beside it; the bars only make the comparison quicker to see.

import type { ClockBand, ClockLeaks, ThinkBucket } from "./clockLeaks";
import { MIN_MOVES, bandPhrase } from "./clockLeaks";
import { getClassColor } from "./classificationColors";
import { count, decimal, esc, pct, plural } from "./labFormat";

function bar(label: string, rate: number, moves: number, scale: number, extra: string, highlight: boolean): string {
  const thin = moves < MIN_MOVES;
  const width = scale > 0 ? Math.min(100, (rate / scale) * 100) : 0;
  const fill = highlight ? getClassColor("mistake") : "var(--muted-dim)";
  const stats = moves
    ? `${decimal(rate)} per 100 · ${plural(moves, "move", "moves")}${extra}${thin ? " · few moves, rough" : ""}`
    : "no moves yet";
  return `
    <li class="clock-row${thin ? " clock-row-thin" : ""}">
      <div class="clock-row-head"><span>${esc(label)}</span><span class="clock-row-stats">${stats}</span></div>
      <div class="clock-track" aria-hidden="true"><span style="width:${width.toFixed(1)}%;background:${fill}"></span></div>
    </li>`;
}

// A bar is picked out only when it runs this far above the comparison rate,
// so a highlight always means a real gap, not the biggest of four equals.
const HIGHLIGHT_LIFT = 1.25;

function bandList(bands: ClockBand[], worstId?: string): string {
  const scale = Math.max(...bands.map((b) => b.rate), 1);
  return bands.map((b) => bar(b.label, b.rate, b.moves, scale, "", b.id === worstId && b.moves >= MIN_MOVES)).join("");
}

function thinkList(think: ThinkBucket[]): string {
  const solid = think.filter((t) => t.moves >= MIN_MOVES);
  const moves = think.reduce((n, t) => n + t.moves, 0);
  const overall = moves ? (think.reduce((n, t) => n + t.mistakes, 0) / moves) * 100 : 0;
  const top = [...solid].sort((a, b) => b.rate - a.rate)[0];
  const worst = top && overall > 0 && top.rate >= overall * HIGHLIGHT_LIFT ? top : undefined;
  const scale = Math.max(...think.map((t) => t.rate), 1);
  return think
    .map((t) =>
      bar(t.label, t.rate, t.moves, scale, t.moves ? ` · ${pct(t.topShare)} best moves` : "", t === worst),
    )
    .join("");
}

export function renderClockLeaks(c: ClockLeaks): string {
  const lift = c.bandLift ?? 0;
  const bandStandsOut = !!c.worstBand && !!c.calmBand && lift >= HIGHLIGHT_LIFT;
  const headline =
    bandStandsOut && c.worstBand && c.calmBand
      ? `With ${esc(bandPhrase(c.worstBand.id))} you make <strong>${decimal(lift)}×</strong> as many mistakes per move as with ${esc(bandPhrase(c.calmBand.id))}.`
      : "Your mistake rate stays about the same at every stage of your clock.";
  const t = c.timeouts;
  const timeoutLine = t.games
    ? `Lost on time: <strong>${count(t.lossesOnTime)}</strong> of your ${plural(t.losses, "loss", "losses")}${
        t.losses ? ` (${pct(t.lossesOnTime / t.losses)})` : ""
      }. Won on time: <strong>${count(t.winsOnTime)}</strong>. From ${plural(t.games, "game", "games")} with a live clock.`
    : "No games with a live clock yet.";
  const timedMoves = c.think.reduce((n, b) => n + b.moves, 0);
  const advice = c.advice.length
    ? `<ul class="clock-advice">${c.advice.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>`
    : `<p class="status-line">Nothing stands out: your clock does not seem to cost you much. Keep it that way.</p>`;
  return `
    <p class="clock-headline">${headline}</p>
    <div class="clock-grid">
      <section class="clock-block" aria-labelledby="clock-bands-title">
        <h3 id="clock-bands-title">Mistakes per 100 moves, by clock left</h3>
        <ul class="clock-rows" role="list">${bandList(c.bands, bandStandsOut ? c.worstBand?.id : undefined)}</ul>
        <p class="status-line">${plural(c.movesWithClock, "move", "moves")} with a clock time.</p>
      </section>
      <section class="clock-block" aria-labelledby="clock-think-title">
        <h3 id="clock-think-title">Mistakes per 100 moves, by time spent on the move</h3>
        ${
          timedMoves
            ? `<ul class="clock-rows" role="list">${thinkList(c.think)}</ul>`
            : `<p class="status-line">No move times yet: they need games with clock times from the first move.</p>`
        }
      </section>
    </div>
    <section class="clock-block" aria-labelledby="clock-timeouts-title">
      <h3 id="clock-timeouts-title">Games decided on time</h3>
      <p>${timeoutLine}</p>
    </section>
    <section class="clock-block" aria-labelledby="clock-advice-title">
      <h3 id="clock-advice-title">What to change</h3>
      ${advice}
    </section>`;
}
