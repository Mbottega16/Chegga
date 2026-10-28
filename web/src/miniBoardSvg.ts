// Chegga Web — lightweight SVG 8x8 mini-board thumbnail generator
//
// Used on Game Picker cards (.picker-card) and Saved Position cards (.saved-row)
// so visitors see real board positions instead of walls of plain text.

import { Chess } from "chess.js";

const STANDARD_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export interface BoardPreview {
  fen: string;
  lastMove?: [string, string];
  moveCount: number;
}

const pgnPreviewCache = new Map<string, BoardPreview>();

/** Extracts the final (or late-middlegame) FEN and last move from a PGN string.
 * Cached in-memory so re-filtering the game picker is O(1) instant. */
export function extractPreviewFromPgn(pgn: string): BoardPreview {
  if (!pgn || !pgn.trim()) {
    return { fen: STANDARD_START_FEN, moveCount: 0 };
  }
  const cached = pgnPreviewCache.get(pgn);
  if (cached) return cached;

  let result: BoardPreview = { fen: STANDARD_START_FEN, moveCount: 0 };
  try {
    const chess = new Chess();
    chess.loadPgn(pgn, { strict: false });
    const history = chess.history({ verbose: true });
    if (history.length > 0) {
      const last = history[history.length - 1]!;
      result = {
        fen: chess.fen(),
        lastMove: [last.from, last.to],
        moveCount: Math.ceil(history.length / 2),
      };
    }
  } catch {
    // Variant or malformed PGN falls back cleanly to standard start position
  }

  if (pgnPreviewCache.size > 400) {
    const firstKey = pgnPreviewCache.keys().next().value;
    if (firstKey !== undefined) pgnPreviewCache.delete(firstKey);
  }
  pgnPreviewCache.set(pgn, result);
  return result;
}

function renderPieceGlyph(pieceChar: string, x: number, y: number): string {
  const isWhite = pieceChar === pieceChar.toUpperCase();
  const fill = isWhite ? "#f8fafc" : "#111622";
  const stroke = isWhite ? "#0f172a" : "#cbd5e1";
  const strokeW = isWhite ? "0.75" : "0.65";
  const type = pieceChar.toLowerCase();
  const cx = x + 5;

  switch (type) {
    case "p":
      return `<g fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}">
        <circle cx="${cx}" cy="${y + 3.4}" r="1.75"/>
        <path d="M${x + 2.6} ${y + 8.3} C${x + 2.8} ${y + 5.8} ${x + 7.2} ${y + 5.8} ${x + 7.4} ${y + 8.3} Z"/>
      </g>`;
    case "r":
      return `<g fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}">
        <path d="M${x + 2.3} ${y + 8.4} L${x + 7.7} ${y + 8.4} L${x + 7.1} ${y + 4.2} L${x + 2.9} ${y + 4.2} Z"/>
        <rect x="${x + 2.2}" y="${y + 2.2}" width="5.6" height="1.9" rx="0.3"/>
      </g>`;
    case "n":
      return `<g fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}">
        <path d="M${x + 2.3} ${y + 8.4} L${x + 7.7} ${y + 8.4} C${x + 7.8} ${y + 5.2} ${x + 7.2} ${y + 2.6} ${x + 4.8} ${y + 2.1} C${x + 3.2} ${y + 2.4} ${x + 2.1} ${y + 4.0} ${x + 2.6} ${y + 5.1} C${x + 3.8} ${y + 4.6} ${x + 4.3} ${y + 5.2} ${x + 2.3} ${y + 8.4} Z"/>
      </g>`;
    case "b":
      return `<g fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}">
        <circle cx="${cx}" cy="${y + 2.1}" r="0.85"/>
        <path d="M${x + 2.3} ${y + 8.4} L${x + 7.7} ${y + 8.4} C${x + 7.4} ${y + 5.1} ${x + 6.5} ${y + 3.1} ${cx} ${y + 2.9} C${x + 3.5} ${y + 3.1} ${x + 2.6} ${y + 5.1} ${x + 2.3} ${y + 8.4} Z"/>
      </g>`;
    case "q":
      return `<g fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}">
        <path d="M${x + 2.1} ${y + 8.4} L${x + 7.9} ${y + 8.4} L${x + 8.3} ${y + 3.1} L${x + 6.2} ${y + 5.3} L${cx} ${y + 2.4} L${x + 3.8} ${y + 5.3} L${x + 1.7} ${y + 3.1} Z"/>
      </g>`;
    case "k":
      return `<g fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}">
        <line x1="${cx}" y1="${y + 1.2}" x2="${cx}" y2="${y + 3.4}" stroke="${stroke}" stroke-width="0.9"/>
        <line x1="${cx - 1.1}" y1="${y + 2.2}" x2="${cx + 1.1}" y2="${y + 2.2}" stroke="${stroke}" stroke-width="0.9"/>
        <path d="M${x + 2.2} ${y + 8.4} L${x + 7.8} ${y + 8.4} C${x + 7.9} ${y + 5.0} ${x + 6.8} ${y + 3.5} ${cx} ${y + 3.5} C${x + 3.2} ${y + 3.5} ${x + 2.1} ${y + 5.0} ${x + 2.2} ${y + 8.4} Z"/>
      </g>`;
    default:
      return "";
  }
}

/** Renders an 8x8 SVG chessboard thumbnail from a FEN string. */
export function renderMiniBoardSvg(
  fen: string,
  orientation: "white" | "black" = "white",
  lastMove?: [string, string],
): string {
  const boardPart = (fen || STANDARD_START_FEN).split(" ")[0] ?? "";
  const ranks = boardPart.split("/");
  const grid: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));

  for (let r = 0; r < Math.min(8, ranks.length); r++) {
    let c = 0;
    for (const ch of ranks[r]!) {
      if (c >= 8) break;
      if (ch >= "1" && ch <= "8") {
        c += Number(ch);
      } else {
        grid[r]![c] = ch;
        c += 1;
      }
    }
  }

  const highlightSet = new Set<string>(lastMove ?? []);
  let squaresSvg = "";
  let piecesSvg = "";

  for (let visualRow = 0; visualRow < 8; visualRow++) {
    for (let visualCol = 0; visualCol < 8; visualCol++) {
      const rankIdx = orientation === "white" ? visualRow : 7 - visualRow;
      const fileIdx = orientation === "white" ? visualCol : 7 - visualCol;
      const sqName = `${String.fromCharCode(97 + fileIdx)}${8 - rankIdx}`;
      const isLight = (rankIdx + fileIdx) % 2 === 0;
      const isHighlighted = highlightSet.has(sqName);
      const x = visualCol * 10;
      const y = visualRow * 10;

      const baseFill = isLight ? "#cbd8e2" : "#3a6178";
      squaresSvg += `<rect x="${x}" y="${y}" width="10" height="10" fill="${baseFill}"/>`;
      if (isHighlighted) {
        squaresSvg += `<rect x="${x}" y="${y}" width="10" height="10" fill="#e3a857" fill-opacity="0.52"/>`;
      }

      const piece = grid[rankIdx]?.[fileIdx];
      if (piece) {
        piecesSvg += renderPieceGlyph(piece, x, y);
      }
    }
  }

  return `<svg class="mini-board-svg" viewBox="0 0 80 80" aria-hidden="true" focusable="false">${squaresSvg}${piecesSvg}</svg>`;
}
