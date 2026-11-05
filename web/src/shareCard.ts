// Chegga Web — 1-Click Shareable Game Review Card Generator
//
// Creates a high-res (1200x675 16:9) graphic card badge summarizing the game review:
// player names, ratings, result, opening, accuracy score, move quality breakdown,
// advantage flow curve, and key turning point.
//
// Pure data parsing is separated from canvas rendering so unit tests run cleanly
// under Node without DOM dependencies.

import { Chess } from "chess.js";
import { getClassColor, getClassGlyph } from "./classificationColors";
import { computeStorylineMoments, type ReviewGame } from "./gameReview";
import { accuracyFromCpLoss } from "./statsInsights";

export interface QualityTallyItem {
  tier: string;
  label: string;
  count: number;
  glyph: string;
  color: string;
}

export interface ShareCardData {
  white: string;
  whiteRating?: string;
  black: string;
  blackRating?: string;
  result: string;
  opening: string;
  accuracy: number;
  avgCentipawnLoss: number;
  totalMoves: number;
  tallies: QualityTallyItem[];
  highlightMoment?: {
    moveNotation: string;
    headline: string;
    badge: string;
    color: string;
  };
  evalScores: number[]; // Clamped to [-8, +8] white advantage
}

export interface ShareCardOptions {
  whiteName?: string;
  blackName?: string;
  whiteRating?: string;
  blackRating?: string;
  result?: string;
  opening?: string;
  accuracy?: number;
  avgCentipawnLoss?: number;
}

const TIER_ORDER = ["brilliant", "best", "excellent", "good", "inaccuracy", "mistake", "blunder"] as const;

const TIER_LABELS: Record<string, string> = {
  brilliant: "Brilliant",
  best: "Best",
  excellent: "Excellent",
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

/** Extracts pure shareable metadata and metrics from a ReviewGame. */
export function buildShareCardData(review: ReviewGame, options: ShareCardOptions = {}): ShareCardData {
  let white = options.whiteName;
  let black = options.blackName;
  let result = options.result;
  let opening = options.opening;
  let whiteRating = options.whiteRating;
  let blackRating = options.blackRating;

  try {
    const chess = new Chess();
    if (review.pgn) {
      chess.loadPgn(review.pgn);
      const headers = chess.header();
      if (!white) white = headers["White"] || (review.humanColor === "white" ? "You" : "Opponent");
      if (!black) black = headers["Black"] || (review.humanColor === "black" ? "You" : "Opponent");
      if (!result) result = headers["Result"] || "*";
      if (!opening) opening = headers["Opening"] || "";
      if (!whiteRating && headers["WhiteElo"]) whiteRating = headers["WhiteElo"];
      if (!blackRating && headers["BlackElo"]) blackRating = headers["BlackElo"];
    }
  } catch {
    // Fall back to defaults
  }

  white = white || (review.humanColor === "white" ? "You" : "Opponent");
  black = black || (review.humanColor === "black" ? "You" : "Opponent");
  result = result || "*";
  opening = opening || "";

  // Human steps analysis
  const humanSteps = review.steps.filter((s) => s.isHuman);
  const scoredSteps = humanSteps.filter((s) => s.centipawnLoss !== undefined);
  const totalCp = scoredSteps.reduce((sum, s) => sum + (s.centipawnLoss ?? 0), 0);
  const computedAvgCp = scoredSteps.length ? Math.round(totalCp / scoredSteps.length) : 0;
  const avgCentipawnLoss = options.avgCentipawnLoss ?? computedAvgCp;
  const accuracy = options.accuracy ?? (scoredSteps.length ? accuracyFromCpLoss(avgCentipawnLoss) : 85);

  // Tallies
  const counts: Record<string, number> = {};
  for (const s of humanSteps) {
    if (s.classification) {
      counts[s.classification] = (counts[s.classification] ?? 0) + 1;
    }
  }

  const tallies: QualityTallyItem[] = TIER_ORDER.map((tier) => ({
    tier,
    label: TIER_LABELS[tier] ?? tier,
    count: counts[tier] ?? 0,
    glyph: getClassGlyph(tier),
    color: getClassColor(tier),
  })).filter((t) => t.count > 0);

  // Storyline moments & turning point highlight
  const moments = computeStorylineMoments(review);
  let highlightMoment: ShareCardData["highlightMoment"];
  if (moments.length > 0) {
    // Prioritize brilliant or blunder/swing turning points
    const topMoment =
      moments.find((m) => m.classification === "brilliant") ||
      moments.find((m) => m.badge.includes("Turn") || m.badge.includes("Swing")) ||
      moments[0];
    if (topMoment) {
      const moveNotation = `${topMoment.moveNumber}${topMoment.side === "white" ? "." : "..."} ${topMoment.san}`;
      highlightMoment = {
        moveNotation,
        headline: topMoment.headline,
        badge: topMoment.badge,
        color: topMoment.classification ? getClassColor(topMoment.classification) : "#22d3ee",
      };
    }
  }

  // Eval curve scores (clamped [-8, +8])
  let prevScore = 0;
  const evalScores: number[] = review.steps.map((step) => {
    if (step.evalAfterMate !== undefined) {
      prevScore = step.evalAfterMate > 0 ? 8 : -8;
    } else if (step.evalAfterCp !== undefined) {
      prevScore = Math.max(-8, Math.min(8, step.evalAfterCp / 100));
    }
    return prevScore;
  });

  return {
    white,
    whiteRating,
    black,
    blackRating,
    result,
    opening,
    accuracy,
    avgCentipawnLoss,
    totalMoves: Math.ceil(review.steps.length / 2),
    tallies,
    highlightMoment,
    evalScores,
  };
}

/** Draws the card graphic onto a 2D canvas context. */
export function drawShareCard(ctx: CanvasRenderingContext2D, data: ShareCardData, width = 1200, height = 675): void {
  // Background gradient: Dark studio slate
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#0b0f17");
  bgGrad.addColorStop(0.5, "#0f172a");
  bgGrad.addColorStop(1, "#070a0f");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Outer border with subtle glow
  ctx.save();
  ctx.strokeStyle = "rgba(34, 211, 238, 0.35)";
  ctx.lineWidth = 2;
  roundRect(ctx, 16, 16, width - 32, height - 32, 16);
  ctx.stroke();
  ctx.restore();

  // Top accent bar
  ctx.fillStyle = "#22d3ee";
  ctx.fillRect(16, 16, width - 32, 4);

  // 1. Header: Logo & Branding
  ctx.save();
  ctx.font = "900 24px 'JetBrains Mono', 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = "#22d3ee";
  ctx.fillText("CHEGGA", 48, 64);

  ctx.font = "700 13px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("BROADCAST REVIEW", 168, 62);

  ctx.font = "500 13px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.textAlign = "right";
  ctx.fillText("chegga-web.vercel.app  •  Client-Side Stockfish 18", width - 48, 62);
  ctx.restore();

  // Header separator
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 86);
  ctx.lineTo(width - 48, 86);
  ctx.stroke();

  // 2. Matchup & Opening Banner
  const whiteText = data.white + (data.whiteRating ? ` (${data.whiteRating})` : "");
  const blackText = data.black + (data.blackRating ? ` (${data.blackRating})` : "");

  ctx.save();
  ctx.font = "800 28px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(whiteText, 48, 128);

  const whiteWidth = ctx.measureText(whiteText).width;
  ctx.font = "700 18px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#f59e0b";
  ctx.fillText("VS", 48 + whiteWidth + 18, 126);

  ctx.font = "800 28px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(blackText, 48 + whiteWidth + 58, 128);

  // Result Badge
  ctx.font = "800 20px 'JetBrains Mono', monospace";
  ctx.textAlign = "right";
  ctx.fillStyle = "#38bdf8";
  ctx.fillText(data.result, width - 48, 128);

  // Opening line
  if (data.opening) {
    ctx.textAlign = "left";
    ctx.font = "500 15px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`📖 ${data.opening}`, 48, 158);
  }
  ctx.restore();

  // 3. Left Bento: Accuracy & Move Quality Breakdown
  const leftX = 48;
  const leftY = 190;
  const leftW = 440;
  const leftH = 410;

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  roundRect(ctx, leftX, leftY, leftW, leftH, 12);
  ctx.fill();
  ctx.stroke();

  // Accuracy Header
  ctx.font = "700 13px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("ACCURACY SCORE", leftX + 24, leftY + 36);

  // Accuracy Big Number
  ctx.font = "900 68px 'JetBrains Mono', sans-serif";
  ctx.fillStyle = "#22d3ee";
  ctx.fillText(`${data.accuracy}%`, leftX + 24, leftY + 104);

  // Avg loss subtext
  ctx.font = "600 14px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(`Avg Centipawn Loss: ${data.avgCentipawnLoss} cp  •  ${data.totalMoves} moves`, leftX + 24, leftY + 132);

  // Divider inside left bento
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.beginPath();
  ctx.moveTo(leftX + 24, leftY + 152);
  ctx.lineTo(leftX + leftW - 24, leftY + 152);
  ctx.stroke();

  // Move Quality Grid/List
  ctx.font = "700 13px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("MOVE QUALITY BREAKDOWN", leftX + 24, leftY + 178);

  let tallyY = leftY + 210;
  for (const item of data.tallies) {
    // Glyph badge
    ctx.fillStyle = item.color;
    roundRect(ctx, leftX + 24, tallyY - 14, 28, 20, 4);
    ctx.fill();

    ctx.font = "900 12px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.fillText(item.glyph, leftX + 38, tallyY);

    // Label
    ctx.font = "600 14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#f1f5f9";
    ctx.textAlign = "left";
    ctx.fillText(item.label, leftX + 64, tallyY);

    // Count
    ctx.font = "800 14px 'JetBrains Mono', monospace";
    ctx.fillStyle = item.color;
    ctx.textAlign = "right";
    ctx.fillText(`${item.count}`, leftX + leftW - 24, tallyY);

    tallyY += 28;
    if (tallyY > leftY + leftH - 16) break;
  }
  ctx.restore();

  // 4. Right Bento Top: Advantage Flow Curve (Eval Curve)
  const rightX = 512;
  const rightY = 190;
  const rightW = width - rightX - 48;
  const curveH = 240;

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  roundRect(ctx, rightX, rightY, rightW, curveH, 12);
  ctx.fill();
  ctx.stroke();

  // Curve Header
  ctx.font = "700 13px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("EVALUATION FLOW", rightX + 24, rightY + 36);

  ctx.font = "600 12px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = "#38bdf8";
  ctx.textAlign = "right";
  ctx.fillText("▲ White Advantage  •  ▼ Black Advantage", rightX + rightW - 24, rightY + 36);

  // Graph area inside box
  const graphPadX = 32;
  const graphPadY = 56;
  const graphW = rightW - graphPadX * 2;
  const graphH = curveH - graphPadY - 24;
  const midY = rightY + graphPadY + graphH / 2;

  // Midline (0.00 equal eval)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(rightX + graphPadX, midY);
  ctx.lineTo(rightX + graphPadX + graphW, midY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw eval line and fill
  const n = data.evalScores.length;
  if (n > 1) {
    const pts = data.evalScores.map((score, i) => {
      const x = rightX + graphPadX + (i / (n - 1)) * graphW;
      const y = midY - (score / 8) * (graphH / 2);
      return { x, y: Math.max(rightY + graphPadY, Math.min(rightY + graphPadY + graphH, y)) };
    });

    // Fill White advantage (above midline)
    const whiteGrad = ctx.createLinearGradient(0, rightY + graphPadY, 0, midY);
    whiteGrad.addColorStop(0, "rgba(34, 211, 238, 0.35)");
    whiteGrad.addColorStop(1, "rgba(34, 211, 238, 0.02)");
    ctx.fillStyle = whiteGrad;
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, midY);
    for (const p of pts) ctx.lineTo(p.x, Math.min(midY, p.y));
    ctx.lineTo(pts[pts.length - 1]!.x, midY);
    ctx.closePath();
    ctx.fill();

    // Fill Black advantage (below midline)
    const blackGrad = ctx.createLinearGradient(0, midY, 0, rightY + graphPadY + graphH);
    blackGrad.addColorStop(0, "rgba(229, 57, 53, 0.02)");
    blackGrad.addColorStop(1, "rgba(229, 57, 53, 0.3)");
    ctx.fillStyle = blackGrad;
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, midY);
    for (const p of pts) ctx.lineTo(p.x, Math.max(midY, p.y));
    ctx.lineTo(pts[pts.length - 1]!.x, midY);
    ctx.closePath();
    ctx.fill();

    // Advantage Curve Stroke
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }
  ctx.restore();

  // 5. Right Bento Bottom: Key Turning Point
  const turnY = rightY + curveH + 18;
  const turnH = leftH - curveH - 18;

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  roundRect(ctx, rightX, turnY, rightW, turnH, 12);
  ctx.fill();
  ctx.stroke();

  if (data.highlightMoment) {
    const hm = data.highlightMoment;
    // Badge
    ctx.font = "800 12px 'JetBrains Mono', monospace";
    ctx.fillStyle = hm.color;
    ctx.fillText(`⚡ ${hm.badge.toUpperCase()}`, rightX + 24, turnY + 34);

    // Move Notation
    ctx.font = "900 22px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(hm.moveNotation, rightX + 24, turnY + 70);

    // Headline
    ctx.font = "600 15px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(hm.headline, rightX + 24, turnY + 104);
  } else {
    ctx.font = "700 13px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("KEY MOMENTS", rightX + 24, turnY + 34);

    ctx.font = "500 15px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Even game throughout with balanced accuracy from both players.", rightX + 24, turnY + 74);
  }
  ctx.restore();

  // 6. Footer tag
  ctx.save();
  ctx.font = "500 12px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#475569";
  ctx.textAlign = "center";
  ctx.fillText("Chegga Web Studio  •  Free, Private, Open Source Chess Intelligence", width / 2, height - 28);
  ctx.restore();
}

/** Draws rounded rectangle path onto context. */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** In browser: renders the review card onto a newly created or provided HTML5 canvas. */
export function renderReviewCardCanvas(
  review: ReviewGame,
  options: ShareCardOptions = {},
  targetCanvas?: HTMLCanvasElement,
): HTMLCanvasElement {
  const canvas = targetCanvas || document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 675;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2D canvas context");

  const data = buildShareCardData(review, options);
  drawShareCard(ctx, data, 1200, 675);
  return canvas;
}

/** Converts canvas to a PNG Blob. */
export async function shareCardToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to export canvas to PNG blob"));
    }, "image/png");
  });
}

/** Copies the rendered canvas directly into the visitor's clipboard as an image (where supported). */
export async function copyReviewCardImage(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await shareCardToBlob(canvas);
    if (typeof ClipboardItem !== "undefined" && navigator?.clipboard?.write) {
      const item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Triggers an immediate browser download of the card as a high-res PNG file. */
export function downloadReviewCardImage(canvas: HTMLCanvasElement, filename = "chegga-game-review.png"): void {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
