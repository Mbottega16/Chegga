// Chegga Web — instant post-game report for a just-finished bot game
//
// Reuses the exact same engineAnalysis.ts/profileService.ts pipeline
// that already grades real synced Chess.com games -- a bot game is just
// a GameRecord with a PGN, so it goes through the identical path. Zero
// new analysis logic, just a synthetic GameRecord built from a finished
// PlayBoard.

import { Chess } from "chess.js";
import { getAnalysisEngine } from "./analysisPanel";
import { analyzeGame, DEFAULT_ANALYSIS_OPTIONS } from "./engineAnalysis";
import { computeProfile } from "./profileService";
import { accuracyFromCpLoss } from "./statsInsights";
import type { GameRecord, MoveAnalysisRecord } from "./db";
import type { ReviewGame, ReviewStep } from "./gameReview";

export interface PostGameReport {
  accuracy: number;
  avgCentipawnLoss: number;
  totalMoves: number;
  blunderCount: number;
  mistakeCount: number;
  worstMove?: MoveAnalysisRecord;
}

function buildSyntheticGame(pgn: string, humanColor: "white" | "black"): GameRecord {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const outcome = chess.isCheckmate()
    ? (chess.turn() === "w" ? "black" : "white") === humanColor
      ? "win"
      : "loss"
    : "draw";

  return {
    chessComUuid: `bot-game-${Date.now()}`,
    username: "bot-game",
    url: "",
    pgn,
    timeControl: "0", // no clock in a bot game -- 0 reads as "no time pressure data," which is correct here
    timeClass: "unknown",
    rules: "chess",
    rated: false,
    endTime: Math.floor(Date.now() / 1000),
    whiteUsername: humanColor === "white" ? "you" : "bot",
    whiteRating: 0,
    blackUsername: humanColor === "black" ? "you" : "bot",
    blackRating: 0,
    whiteResult: humanColor === "white" ? outcome : outcome === "win" ? "loss" : outcome === "loss" ? "win" : "draw",
    blackResult: humanColor === "black" ? outcome : outcome === "win" ? "loss" : outcome === "loss" ? "win" : "draw",
    userColor: humanColor,
    userResult: outcome as "win" | "loss" | "draw",
    analyzed: false,
  };
}

/** The per-move records come back alongside the report because every
 * consumer needs them: the annotated PGN and the move-by-move review are
 * both built from the same rows. Engine analysis is the expensive part of
 * a finished game (one pass per position), so it runs exactly once. */
export async function analyzeFinishedBotGame(
  pgn: string,
  humanColor: "white" | "black",
): Promise<{ report: PostGameReport; moves: MoveAnalysisRecord[] }> {
  const engine = await getAnalysisEngine();
  const game = buildSyntheticGame(pgn, humanColor);
  const moves = await analyzeGame(engine, game, DEFAULT_ANALYSIS_OPTIONS);
  const ownMoves = moves.filter((m) => m.sideToMove === humanColor);

  const profile = computeProfile([game], ownMoves);
  const worstMove = [...ownMoves].sort((a, b) => b.centipawnLoss - a.centipawnLoss)[0];

  return {
    report: {
      accuracy: accuracyFromCpLoss(profile.avgCentipawnLoss),
      avgCentipawnLoss: profile.avgCentipawnLoss,
      totalMoves: profile.totalMoves,
      blunderCount: profile.classificationCounts.blunder ?? 0,
      mistakeCount: profile.classificationCounts.mistake ?? 0,
      worstMove,
    },
    moves,
  };
}

export function renderPostGameReport(report: PostGameReport): string {
  const worst = report.worstMove
    ? `<div class="insight-item">Your costliest move: <strong>${report.worstMove.san}</strong> (-${report.worstMove.centipawnLoss}cp, ${report.worstMove.classification}).</div>`
    : "";
  return `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${report.accuracy}</div><div class="stat-label">accuracy</div></div>
      <div class="stat-card"><div class="stat-value">${report.avgCentipawnLoss}</div><div class="stat-label">avg cp loss</div></div>
      <div class="stat-card"><div class="stat-value">${report.blunderCount}</div><div class="stat-label">blunders</div></div>
      <div class="stat-card"><div class="stat-value">${report.mistakeCount}</div><div class="stat-label">mistakes</div></div>
    </div>
    ${worst}
    <p class="status-line" style="margin-top:12px">
      Want this for your real games too?
      <a href="#sync-section" id="post-game-connect-link">Connect your Chess.com username</a>.
    </p>
  `;
}

export interface BuildAnnotatedPgnOptions {
  /** If true, includes [%eval ...] computer evaluation comments. Defaults to true. */
  includeEvals?: boolean;
  /** If true, includes standard NAG codes ($1..$6). Defaults to true. */
  includeNags?: boolean;
}

export type MoveAnnotationSource = {
  ply: number;
  sideToMove?: "white" | "black";
  side?: "white" | "black";
  san?: string;
  classification?: string;
  centipawnLoss?: number;
  bestMoveSan?: string;
  bestMoveUci?: string;
  evalAfterCp?: number;
  evalAfterMate?: number;
};

const NAG_MAP: Record<string, { nag: string; title: string }> = {
  brilliant: { nag: "$3", title: "Brilliant!" },
  best: { nag: "$1", title: "Best move" },
  excellent: { nag: "$6", title: "Excellent" },
  good: { nag: "", title: "Good" },
  inaccuracy: { nag: "$5", title: "Inaccuracy" },
  mistake: { nag: "$2", title: "Mistake" },
  blunder: { nag: "$4", title: "Blunder" },
  book: { nag: "", title: "Book" },
};

/** Annotated PGN: adds standard NAG glyphs ($1..$6) and [%eval ...] comments.
 * Preserves PGN headers (players, event, result). Works with both MoveAnalysisRecord[]
 * and ReviewStep[]. */
export function buildAnnotatedPgn(
  pgn: string,
  moves: (MoveAnalysisRecord | ReviewStep | MoveAnnotationSource)[],
  humanColor?: "white" | "black",
  options: BuildAnnotatedPgnOptions = {},
): string {
  const includeEvals = options.includeEvals !== false;
  const includeNags = options.includeNags !== false;

  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    // best-effort
  }

  const byPly = new Map(moves.map((m) => [m.ply, m]));
  const replay = new Chess();

  // Preserve all original headers
  try {
    for (const [k, v] of Object.entries(chess.header())) {
      if (v) replay.setHeader(k, v);
    }
  } catch {
    // header copy best effort
  }

  const sanHistory = chess.history();
  for (let i = 0; i < sanHistory.length; i++) {
    const ply = i + 1;
    replay.move(sanHistory[i]);
    const analysis = byPly.get(ply);
    if (!analysis) continue;

    const side =
      ("sideToMove" in analysis ? analysis.sideToMove : undefined) ??
      ("side" in analysis ? analysis.side : undefined) ??
      (ply % 2 === 1 ? "white" : "black");
    if (humanColor && side !== humanColor) continue;

    const cls = analysis.classification;
    const info = cls ? NAG_MAP[cls] : undefined;

    // Evaluation comment [%eval +X.XX] or [%eval #X]
    let evalTag = "";
    if (includeEvals) {
      if (analysis.evalAfterMate !== undefined) {
        evalTag = `[%eval #${analysis.evalAfterMate}]`;
      } else if (analysis.evalAfterCp !== undefined) {
        const cp = analysis.evalAfterCp;
        const pawns = (cp / 100).toFixed(2);
        evalTag = `[%eval ${cp > 0 ? "+" + pawns : pawns}]`;
      }
    }

    // Explanatory note
    let note = "";
    if (cls === "blunder" || cls === "mistake" || cls === "inaccuracy") {
      const parts: string[] = [];
      if (analysis.centipawnLoss) parts.push(`-${analysis.centipawnLoss}cp`);
      if (analysis.bestMoveSan) parts.push(`better was ${analysis.bestMoveSan}`);
      note = `${info?.title ?? cls}${parts.length ? ` (${parts.join(", ")})` : ""}`;
    } else if (cls === "brilliant") {
      note = "Brilliant!";
    } else if (cls === "best") {
      note = "Best move";
    } else if (cls && cls !== "good" && cls !== "book") {
      note = info?.title ?? cls;
    }

    const textParts = [evalTag, note].filter(Boolean);
    if (textParts.length === 0 && (!includeNags || !info?.nag)) continue;

    if (includeNags && info?.nag) {
      const nagPlaceholder = `__NAG_${info.nag.slice(1)}__`;
      replay.setComment(textParts.length ? `${nagPlaceholder} ${textParts.join(" ")}` : nagPlaceholder);
    } else if (textParts.length > 0) {
      replay.setComment(textParts.join(" "));
    }
  }

  let pgnOut = replay.pgn();
  if (includeNags) {
    pgnOut = pgnOut.replace(/\{__NAG_(\d+)__\s*/g, (_, g) => `$${g} {`);
    pgnOut = pgnOut.replace(/\{__NAG_(\d+)__\}/g, (_, g) => `$${g}`);
  }

  return pgnOut;
}

export interface ShareableSummaryOptions {
  accuracy?: number;
  avgCentipawnLoss?: number;
  whiteName?: string;
  blackName?: string;
  result?: string;
  opening?: string;
}

/** Formats a text card for game review sharing (clipboard / social). */
export function buildShareableSummary(
  review: ReviewGame,
  options: ShareableSummaryOptions = {},
): string {
  const chess = new Chess();
  try {
    chess.loadPgn(review.pgn);
  } catch {
    // best-effort
  }
  const headers = chess.header();
  const white = options.whiteName ?? headers["White"] ?? (review.humanColor === "white" ? "You" : "Opponent");
  const black = options.blackName ?? headers["Black"] ?? (review.humanColor === "black" ? "You" : "Opponent");
  const rawResult = options.result ?? headers["Result"] ?? "*";
  const opening = options.opening ?? headers["Opening"] ?? "";

  const humanSteps = review.steps.filter((s) => s.isHuman);
  const scoredSteps = humanSteps.filter((s) => s.centipawnLoss !== undefined);
  const totalCp = scoredSteps.reduce((sum, s) => sum + (s.centipawnLoss ?? 0), 0);
  const avgCp = options.avgCentipawnLoss ?? (scoredSteps.length ? Math.round(totalCp / scoredSteps.length) : undefined);
  const accuracy = options.accuracy ?? (avgCp !== undefined ? accuracyFromCpLoss(avgCp) : undefined);

  const tallyMap: Record<string, number> = {};
  for (const s of humanSteps) {
    if (s.classification) {
      tallyMap[s.classification] = (tallyMap[s.classification] ?? 0) + 1;
    }
  }

  const order = ["brilliant", "best", "excellent", "good", "inaccuracy", "mistake", "blunder"];
  const glyphs: Record<string, string> = {
    brilliant: "!!",
    best: "!",
    excellent: "✦",
    good: "✓",
    inaccuracy: "?!",
    mistake: "?",
    blunder: "??",
  };
  const labels: Record<string, string> = {
    brilliant: "Brilliant",
    best: "Best",
    excellent: "Excellent",
    good: "Good",
    inaccuracy: "Inaccuracy",
    mistake: "Mistake",
    blunder: "Blunder",
  };

  const tallyParts = order
    .filter((tier) => (tallyMap[tier] ?? 0) > 0)
    .map((tier) => {
      const count = tallyMap[tier]!;
      const baseLabel = labels[tier] ?? tier;
      const plural = count === 1 ? baseLabel : (tier === "inaccuracy" ? "Inaccuracies" : `${baseLabel}s`);
      return `${glyphs[tier] ?? ""} ${count} ${plural}`.trim();
    });

  // Highlight moment
  const highlight =
    humanSteps.find((s) => s.classification === "brilliant") ??
    humanSteps.find((s) => s.classification === "best" && s.moveNumber >= 10) ??
    humanSteps.find((s) => s.classification === "best");

  const lines: string[] = [
    "♟️ Chegga Game Review",
    `⚔️ ${white} vs ${black} [${rawResult}]`,
  ];
  if (opening) {
    lines.push(`📖 Opening: ${opening}`);
  }
  if (accuracy !== undefined) {
    lines.push(`🎯 Accuracy: ${accuracy}%${avgCp !== undefined ? ` · Avg Loss: ${avgCp}cp` : ""}`);
  }
  if (tallyParts.length) {
    lines.push(`📊 Moves: ${tallyParts.join(" · ")}`);
  }
  if (highlight) {
    const moveNotation = highlight.side === "black" ? `${highlight.moveNumber}...` : `${highlight.moveNumber}.`;
    const glyph = glyphs[highlight.classification ?? ""] ?? "";
    lines.push(`🔥 Highlight: ${moveNotation} ${highlight.san} ${glyph}`.trim());
  }
  lines.push("Analyzed 100% locally with Chegga: https://chegga-web.vercel.app");

  return lines.join("\n");
}

/** Copies text to system clipboard with fallback support for all browser environments. */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback
    }
  }
  if (typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      textarea.remove();
      return success;
    } catch {
      return false;
    }
  }
  return false;
}

/** Returns whether the download actually fired -- some embedded/
 * restricted browser contexts block Blob downloads outright; the caller
 * uses this to show a fallback instead of pretending it worked. */
export function downloadTextFile(filename: string, content: string): boolean {
  try {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.warn("PGN download unavailable in this browser context.", err);
    return false;
  }
}
