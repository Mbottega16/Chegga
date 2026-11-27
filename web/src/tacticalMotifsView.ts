// Chegga Web — rendering for tacticalMotifs.ts (the Tactical motifs tool)
//
// A ranked list of motifs, one button each; the selected motif opens below
// with its habit, a button that trains it on themed puzzles, and its
// costliest examples as small boards that open in the game review. main.ts
// owns the clicks: [data-motif-select], [data-motif-train] and
// [data-review-game] / [data-review-ply].

import { LOSS_CAP_CP, type MotifRow, type MotifSide, type MotifSummary } from "./tacticalMotifs";
import { getClassColor, getClassGlyph } from "./classificationColors";
import { renderMiniBoardSvg } from "./miniBoardSvg";
import { count, esc, pawns, pct, plural, shortDate } from "./labFormat";

const SIDE_LABEL: Record<MotifSide, string> = {
  missed: "You missed it",
  allowed: "You allowed it",
  none: "No tactic",
};

function sideColor(side: MotifSide): string {
  if (side === "allowed") return getClassColor("blunder");
  if (side === "missed") return getClassColor("inaccuracy");
  return "var(--muted-dim)";
}

function splitBar(s: MotifSummary): string {
  const none = s.total - s.missed - s.allowed;
  const parts: [MotifSide, number, string][] = [
    ["missed", s.missed, "missed"],
    ["allowed", s.allowed, "allowed"],
    ["none", none, "no clear tactic"],
  ];
  const segs = parts
    .filter(([, n]) => n > 0)
    .map(([side, n]) => `<span class="motif-split-seg" style="flex-grow:${n};--side-color:${sideColor(side)}"></span>`)
    .join("");
  const label = parts.map(([, n, word]) => `${count(n)} ${word}`).join(", ");
  const legend = parts
    .map(
      ([side, n, word]) =>
        `<span class="motif-legend-item"><i style="--side-color:${sideColor(side)}"></i>${count(n)} ${word}</span>`,
    )
    .join("");
  return `
    <div class="motif-split" role="img" aria-label="${esc(`Your ${s.total} mistakes and blunders: ${label}.`)}">${segs}</div>
    <p class="motif-legend" aria-hidden="true">${legend}</p>`;
}

function rowButton(r: MotifRow, selected: boolean, maxShare: number): string {
  const width = Math.max(3, Math.round((r.share / maxShare) * 100));
  const blunderNote = r.blunders ? ` · ${plural(r.blunders, "blunder", "blunders")}` : "";
  return `
    <li>
      <button type="button" class="motif-row" data-motif-select="${r.motif.id}" aria-pressed="${selected}"
        style="--side-color:${sideColor(r.motif.side)}">
        <span class="motif-row-head">
          <span class="motif-row-label">${esc(r.motif.label)}</span>
          <span class="motif-side-chip">${SIDE_LABEL[r.motif.side]}</span>
        </span>
        <span class="motif-row-bar" aria-hidden="true"><span style="width:${width}%"></span></span>
        <span class="motif-row-stats">
          <strong>${count(r.count)}</strong> (${pct(r.share)})${blunderNote} · about ${pawns(r.avgLossCp)} pawns lost each
        </span>
      </button>
    </li>`;
}

/** Analysis clamps one move's loss at LOSS_CAP_CP (a mate swing reads as
 * that cap), so the cap means "this much or more". */
function lossText(cp: number): string {
  return cp >= LOSS_CAP_CP ? `lost ${pawns(LOSS_CAP_CP)} pawns or more` : `lost ${pawns(cp)} pawns`;
}

function exampleCard(r: MotifRow, i: number): string {
  const e = r.examples[i];
  const lastMove: [string, string] | undefined = e.uci.length >= 4 ? [e.uci.slice(0, 2), e.uci.slice(2, 4)] : undefined;
  const moveLabel = `${e.moveNumber}${e.sideToMove === "white" ? "." : "…"} ${e.san}`;
  const glyph = getClassGlyph(e.classification);
  const better = e.bestMoveSan ? `Better was <strong>${esc(e.bestMoveSan)}</strong>.` : "";
  const vs = e.opponent ? ` vs ${esc(e.opponent)}` : "";
  const when = e.endTime ? ` · ${shortDate(e.endTime)}` : "";
  return `
    <li class="motif-example">
      <div class="motif-example-board">${renderMiniBoardSvg(e.fenBefore, e.sideToMove, lastMove)}</div>
      <div class="motif-example-text">
        <p class="motif-example-move">
          <span class="motif-quality" style="--q-color:${getClassColor(e.classification)}">${esc(glyph)}</span>
          You played <strong>${esc(moveLabel)}</strong> and ${lossText(e.centipawnLoss)}. ${better}
        </p>
        <p class="status-line">Move ${e.moveNumber}${vs}${when}</p>
        <button type="button" class="btn-quiet" data-review-game="${esc(e.gameId)}" data-review-ply="${e.ply}">Review this move</button>
      </div>
    </li>`;
}

function detail(r: MotifRow): string {
  const train = r.motif.themes.length
    ? `<button type="button" data-motif-train="${r.motif.id}">Train it: ${esc(r.motif.trainLabel)}</button>`
    : "";
  const examples = r.examples.map((_, i) => exampleCard(r, i)).join("");
  return `
    <div class="motif-detail" id="motif-detail" aria-live="polite">
      <h3>${esc(r.motif.label)}</h3>
      <p class="motif-advice">${esc(r.motif.advice)}</p>
      ${train ? `<p class="card-action">${train}</p>` : ""}
      <h4>Your costliest ${r.examples.length === 1 ? "example" : `${r.examples.length} examples`}</h4>
      <ul class="motif-examples" role="list">${examples}</ul>
    </div>`;
}

export function renderTacticalMotifs(s: MotifSummary, selectedId?: string): string {
  const selected = s.rows.find((r) => r.motif.id === selectedId) ?? s.top ?? s.rows[0];
  const maxShare = Math.max(...s.rows.map((r) => r.share));
  const headline = s.top
    ? `Your most common tactical leak: <strong>${esc(s.top.motif.label.toLowerCase())}</strong>, ${count(s.top.count)} of your ${count(s.total)} mistakes and blunders.`
    : `None of your ${count(s.total)} mistakes and blunders had a clear one-move tactic. They are slow, positional slips.`;
  return `
    <p class="motif-headline">${headline}</p>
    ${splitBar(s)}
    <div class="motif-layout">
      <ul class="motif-rows" role="list" aria-label="Motifs, most common first">
        ${s.rows.map((r) => rowButton(r, r === selected, maxShare)).join("")}
      </ul>
      ${detail(selected)}
    </div>`;
}
