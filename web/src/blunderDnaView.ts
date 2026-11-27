// Chegga Web — rendering for blunderDnaProfile.ts (the Blunder DNA tool)
//
// One block per strand. Each bucket is a bar of its mistake rate (mistakes
// per 100 of your moves there) against a marker at your normal rate, with
// the numbers and an above/below word beside it, so the colour never carries
// the meaning alone. main.ts owns the [data-dna-drill] click.

import type { BlunderDnaProfile, DnaBucket, DnaStrand } from "./blunderDnaProfile";
import { STANDOUT_LIFT } from "./blunderDnaProfile";
import { getClassColor } from "./classificationColors";
import { count, decimal, esc, plural } from "./labFormat";

function verdict(b: DnaBucket): { glyph: string; text: string } {
  if (b.lift >= STANDOUT_LIFT) return { glyph: "▲", text: `${decimal(b.lift)}× your normal rate` };
  if (b.lift <= 1 / STANDOUT_LIFT) return { glyph: "▼", text: "below your normal rate" };
  return { glyph: "≈", text: "about your normal rate" };
}

function bucketRow(s: DnaStrand, b: DnaBucket, scale: number, normal: number): string {
  const v = verdict(b);
  const width = Math.min(100, (b.rate / scale) * 100);
  const marker = Math.min(100, (normal / scale) * 100);
  const isStandout = s.standout?.id === b.id;
  const fill = b.lift >= STANDOUT_LIFT ? getClassColor("mistake") : "var(--muted-dim)";
  return `
    <li class="dna-row${isStandout ? " dna-row-standout" : ""}">
      <div class="dna-row-head">
        <span class="dna-row-label">${esc(b.label)}</span>
        <span class="dna-row-verdict"><span aria-hidden="true">${v.glyph}</span> ${v.text}</span>
      </div>
      <div class="dna-track" aria-hidden="true">
        <span class="dna-fill" style="width:${width.toFixed(1)}%;background:${fill}"></span>
        <span class="dna-marker" style="left:${marker.toFixed(1)}%"></span>
      </div>
      <p class="dna-row-stats">${plural(b.mistakes, "mistake", "mistakes")} in ${plural(b.moves, "move", "moves")}: ${decimal(b.rate)} per 100</p>
    </li>`;
}

function strandBlock(s: DnaStrand): string {
  const normal = (s.mistakes / s.moves) * 100;
  const scale = Math.max(normal * 1.6, ...s.buckets.map((b) => b.rate), 1);
  const note =
    s.id === "clock"
      ? `<p class="status-line">Only moves with clock times (${count(s.moves)} of them). Daily games have none.</p>`
      : "";
  return `
    <section class="dna-strand" aria-labelledby="dna-strand-${s.id}">
      <h3 id="dna-strand-${s.id}">${esc(s.title)}</h3>
      <p class="dna-normal">Normal rate here: ${decimal(normal)} per 100 moves (the line on each bar).</p>
      ${note}
      <ul class="dna-rows" role="list">${s.buckets.map((b) => bucketRow(s, b, scale, normal)).join("")}</ul>
    </section>`;
}

/** "a queen move in the endgame, when you are ahead". */
export function typicalMistake(p: BlunderDnaProfile): string | undefined {
  if (!p.traits.length) return undefined;
  const pieceStrand = p.strands.find((s) => s.id === "piece");
  const [first, ...rest] = pieceStrand?.standout ? p.traits : ["a move", ...p.traits];
  return rest.length ? `${first} ${rest.join(", ")}` : first;
}

export function renderBlunderDnaProfile(p: BlunderDnaProfile): string {
  const typical = typicalMistake(p);
  const headline = typical
    ? `Your typical mistake: <strong>${esc(typical)}</strong>.`
    : "No strong pattern yet: your mistakes are spread evenly across the clock, the phases, the score and your pieces.";
  const drill = p.drill
    ? `<p class="card-action"><button type="button" data-dna-drill='${esc(JSON.stringify({ phase: p.drill.phase ?? null }))}'>${esc(p.drill.label)}</button></p>`
    : "";
  return `
    <p class="dna-headline">${headline}</p>
    <p class="status-line">From ${plural(p.totalMistakes, "mistake or blunder", "mistakes and blunders")} in ${plural(p.totalMoves, "move", "moves")} of yours (${decimal(p.overallRate)} per 100).</p>
    ${drill}
    <div class="dna-strands">${p.strands.map(strandBlock).join("")}</div>`;
}
