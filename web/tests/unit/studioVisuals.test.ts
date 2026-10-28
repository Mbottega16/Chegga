import { describe, it, expect } from "vitest";
import { extractPreviewFromPgn, renderMiniBoardSvg } from "../../src/miniBoardSvg";
import { renderHeroArt } from "../../src/heroArt";

describe("studioVisuals — miniBoardSvg & heroArt", () => {
  it("extracts final FEN, moveCount, and lastMove from a valid PGN", () => {
    const pgn = "1. e4 e5 2. Qh5 Nc6 3. Qxf7# 1-0";
    const preview = extractPreviewFromPgn(pgn);
    expect(preview.moveCount).toBe(3);
    expect(preview.lastMove).toEqual(["h5", "f7"]);
    expect(preview.fen).toContain("r1bqkbnr/pppp1Qpp/2n5/4p3/4P3/8/PPPP1PPP/RNB1KBNR");
  });

  it("falls back cleanly to standard start FEN on empty or variant PGN", () => {
    const empty = extractPreviewFromPgn("");
    expect(empty.moveCount).toBe(0);
    expect(empty.fen).toContain("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
  });

  it("renders an 8x8 SVG mini-board with piece glyphs and last-move highlights", () => {
    const preview = extractPreviewFromPgn("1. e4 e5");
    const svg = renderMiniBoardSvg(preview.fen, "white", preview.lastMove);
    expect(svg).toContain('class="mini-board-svg"');
    expect(svg).toContain("#e3a857"); // highlight square tint
  });

  it("renders the Broadcast Hero SVG showcase with animated trails and callouts", () => {
    const html = renderHeroArt();
    expect(html).toContain("hero-stage-svg");
    expect(html).toContain("Brilliant!");
    expect(html).toContain("EVALUATION FLOW");
  });
});
