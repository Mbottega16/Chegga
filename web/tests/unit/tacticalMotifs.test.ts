import { describe, it, expect } from "vitest";
import { MOTIFS, LOSS_CAP_CP, EXAMPLES_PER_MOTIF, computeMotifSummary, motifFor } from "../../src/tacticalMotifs";
import { THEME_OPTIONS } from "../../src/curatedPuzzles";
import { game, move } from "./_factories";

const g = game({ chessComUuid: "g1", userColor: "white", blackUsername: "rival" });

function mistake(ply: number, tag: string | undefined, cp: number, classification = "mistake") {
  return move({ gameId: "g1", ply, sideToMove: "white", classification, centipawnLoss: cp, blunderTag: tag, san: `m${ply}`, uci: "e2e4" });
}

describe("computeMotifSummary", () => {
  it("returns null when there are no mistakes or blunders", () => {
    expect(computeMotifSummary([g], [move({ classification: "best" }), move({ classification: "inaccuracy" })])).toBeNull();
  });

  it("groups mistakes and blunders by motif, largest first, and ignores other moves", () => {
    const moves = [
      mistake(1, "fork", 300),
      mistake(3, "fork", 200, "blunder"),
      mistake(5, "missed_mate", 900, "blunder"),
      mistake(7, "positional", 150),
      mistake(9, "positional", 160),
      mistake(11, "positional", 170),
      move({ gameId: "g1", ply: 13, classification: "good", centipawnLoss: 30 }),
    ];
    const s = computeMotifSummary([g], moves)!;
    expect(s.total).toBe(6);
    expect(s.rows.map((r) => r.motif.id)).toEqual(["positional", "fork", "missed_mate"]);
    expect(s.missed).toBe(1);
    expect(s.allowed).toBe(2);
    const fork = s.rows.find((r) => r.motif.id === "fork")!;
    expect(fork.count).toBe(2);
    expect(fork.blunders).toBe(1);
    expect(fork.avgLossCp).toBe(250);
    expect(fork.share).toBeCloseTo(2 / 6);
    expect(s.rows.reduce((n, r) => n + r.share, 0)).toBeCloseTo(1);
  });

  it("picks the largest real tactic as the top leak, never 'no clear tactic'", () => {
    const s = computeMotifSummary([g], [mistake(1, "positional", 150), mistake(3, "positional", 150), mistake(5, "pin", 300)])!;
    expect(s.rows[0].motif.id).toBe("positional");
    expect(s.top?.motif.id).toBe("pin");
    const onlySlow = computeMotifSummary([g], [mistake(1, "positional", 150)])!;
    expect(onlySlow.top).toBeUndefined();
  });

  it("keeps the costliest examples, worst first, with the opponent's name", () => {
    const moves = [100, 500, 300, 900, 200].map((cp, i) => mistake(i * 2 + 1, "hung_material", cp));
    const row = computeMotifSummary([g], moves)!.rows[0];
    expect(row.examples).toHaveLength(EXAMPLES_PER_MOTIF);
    expect(row.examples.map((e) => e.centipawnLoss)).toEqual([900, 500, 300]);
    expect(row.examples[0].opponent).toBe("rival");
    expect(row.examples[0].moveNumber).toBe(4); // ply 7
  });

  it("caps one move's loss in the average", () => {
    const row = computeMotifSummary([g], [mistake(1, "allowed_mate", 50_000), mistake(3, "allowed_mate", 0)])!.rows[0];
    expect(row.avgLossCp).toBe(LOSS_CAP_CP / 2);
  });

  it("reads a missing or unknown tag as 'no clear tactic'", () => {
    expect(motifFor(undefined).id).toBe("positional");
    expect(motifFor("something_new").id).toBe("positional");
    const s = computeMotifSummary([g], [mistake(1, undefined, 200)])!;
    expect(s.rows[0].motif.id).toBe("positional");
  });
});

describe("MOTIFS", () => {
  it("trains every tactic with real themed-puzzle themes", () => {
    const themeIds = new Set(THEME_OPTIONS.map((t) => t.id));
    for (const m of MOTIFS) {
      if (m.side === "none") {
        expect(m.themes).toEqual([]);
        continue;
      }
      expect(m.themes.length, m.id).toBeGreaterThan(0);
      for (const t of m.themes) expect(themeIds.has(t), `${m.id}: ${t}`).toBe(true);
      expect(m.trainLabel, m.id).not.toBe("");
    }
  });

  it("covers every tag the blunder tagger can write", async () => {
    const tagger = await import("../../src/blunderTagger");
    const tags = [
      tagger.MISSED_MATE,
      tagger.ALLOWED_MATE,
      tagger.FORK,
      tagger.PIN,
      tagger.SKEWER,
      tagger.BACK_RANK,
      tagger.TRAPPED_PIECE,
      tagger.HUNG_MATERIAL,
      tagger.MISSED_CAPTURE,
      tagger.POSITIONAL,
    ];
    for (const tag of tags) expect(MOTIFS.some((m) => m.id === tag), tag).toBe(true);
  });
});
