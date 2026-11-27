// Chegga Web — the Tactical motifs tool: your mistakes sorted by the tactic
// behind them
//
// Every mistake and blunder already carries a `blunderTag` from analysis time
// (blunderTagger.ts's tagMove): a mate you missed or walked into, a fork, pin,
// skewer or back-rank shot you allowed, a piece left hanging, a free capture
// passed up, or no clean tactic at all. This groups them, says which side of
// the tactic you were on, and keeps the costliest examples so the view can
// open each one in the game review. It also names the Lichess puzzle themes
// that train each motif (curatedPuzzles.ts's THEME_OPTIONS ids).
//
// A heuristic, like the tagger it reads: it names the first motif the tagger
// finds, not a full explanation of the position.

import type { GameRecord, MoveAnalysisRecord } from "./db";

export type MotifSide = "missed" | "allowed" | "none";

export interface MotifInfo {
  id: string;
  label: string;
  side: MotifSide;
  /** Lichess puzzle themes that train it; empty when no theme fits. */
  themes: string[];
  /** The button text for those themes. */
  trainLabel: string;
  /** One plain habit that prevents it. */
  advice: string;
}

export const MOTIFS: MotifInfo[] = [
  {
    id: "missed_mate",
    label: "Missed a mate",
    side: "missed",
    themes: ["mateIn1", "mateIn2"],
    trainLabel: "Mate in 1 and 2 puzzles",
    advice: "Before every move, look at each check you can give.",
  },
  {
    id: "missed_capture",
    label: "Missed a free capture",
    side: "missed",
    themes: ["hangingPiece", "capturingDefender"],
    trainLabel: "Hanging piece puzzles",
    advice: "After your opponent moves, ask what that move left undefended.",
  },
  {
    id: "allowed_mate",
    label: "Walked into mate",
    side: "allowed",
    themes: ["mateIn1", "mateIn2"],
    trainLabel: "Mate in 1 and 2 puzzles",
    advice: "Before you move, look at every check your opponent could give next.",
  },
  {
    id: "fork",
    label: "Allowed a fork",
    side: "allowed",
    themes: ["fork"],
    trainLabel: "Fork puzzles",
    advice: "Watch for knight jumps and pawn pushes that hit two of your pieces at once.",
  },
  {
    id: "pin",
    label: "Allowed a pin",
    side: "allowed",
    themes: ["pin"],
    trainLabel: "Pin puzzles",
    advice: "Do not line up your king or queen behind another piece on an open line.",
  },
  {
    id: "skewer",
    label: "Allowed a skewer",
    side: "allowed",
    themes: ["skewer", "xRayAttack"],
    trainLabel: "Skewer puzzles",
    advice: "Keep your big pieces off the same open line as an enemy rook, bishop or queen.",
  },
  {
    id: "back_rank",
    label: "Back-rank weakness",
    side: "allowed",
    themes: ["backRankMate"],
    trainLabel: "Back-rank mate puzzles",
    advice: "Give your castled king an escape square before the rooks come off.",
  },
  {
    id: "trapped_piece",
    label: "Trapped piece",
    side: "allowed",
    themes: ["trappedPiece"],
    trainLabel: "Trapped piece puzzles",
    advice: "Before a piece goes deep, count its way back out.",
  },
  {
    id: "hung_material",
    label: "Left a piece hanging",
    side: "allowed",
    themes: ["hangingPiece"],
    trainLabel: "Hanging piece puzzles",
    advice: "Before you let go of a piece, check what it stops defending.",
  },
  {
    id: "positional",
    label: "No clear tactic",
    side: "none",
    themes: [],
    trainLabel: "",
    advice: "These are slow slips, not one-move shots. Review them to see the better plan.",
  },
];

const BY_ID = new Map(MOTIFS.map((m) => [m.id, m]));

/** Unknown or missing tags read as "no clear tactic": a mistake the tagger
 * could not pin on a motif. */
export function motifFor(tag: string | undefined): MotifInfo {
  return BY_ID.get(tag ?? "") ?? BY_ID.get("positional")!;
}

// Analysis already clamps one move's loss at 1000 cp (engineAnalysis.ts's
// DISPLAY_CLAMP_CP; a mate swing reads as exactly that). The same cap here
// keeps hand-made or older records from skewing an average.
export const LOSS_CAP_CP = 1000;

export interface MotifExample {
  gameId: string;
  ply: number;
  moveNumber: number;
  sideToMove: "white" | "black";
  fenBefore: string;
  san: string;
  uci: string;
  bestMoveSan?: string;
  centipawnLoss: number;
  classification: string;
  opponent?: string;
  endTime?: number;
}

export interface MotifRow {
  motif: MotifInfo;
  count: number;
  blunders: number;
  /** 0..1 of all your mistakes and blunders. */
  share: number;
  avgLossCp: number;
  /** The costliest few, worst first. */
  examples: MotifExample[];
}

export interface MotifSummary {
  total: number;
  missed: number;
  allowed: number;
  /** Largest count first; ties go to the costlier average. */
  rows: MotifRow[];
  /** The largest row that is an actual tactic (not "no clear tactic"). */
  top?: MotifRow;
}

export const EXAMPLES_PER_MOTIF = 3;

/** `ownMoves` must be the player's own moves only (as computeProfile wants). */
export function computeMotifSummary(games: GameRecord[], ownMoves: MoveAnalysisRecord[]): MotifSummary | null {
  const gameById = new Map(games.map((g) => [g.chessComUuid, g]));
  const buckets = new Map<string, { count: number; blunders: number; loss: number; moves: MoveAnalysisRecord[] }>();
  let total = 0;
  for (const m of ownMoves) {
    if (m.classification !== "mistake" && m.classification !== "blunder") continue;
    total += 1;
    const id = motifFor(m.blunderTag).id;
    const b = buckets.get(id) ?? { count: 0, blunders: 0, loss: 0, moves: [] };
    b.count += 1;
    if (m.classification === "blunder") b.blunders += 1;
    b.loss += Math.min(Math.max(m.centipawnLoss, 0), LOSS_CAP_CP);
    b.moves.push(m);
    buckets.set(id, b);
  }
  if (total === 0) return null;

  const rows: MotifRow[] = [...buckets.entries()].map(([id, b]) => {
    const examples = [...b.moves]
      .sort((x, y) => y.centipawnLoss - x.centipawnLoss)
      .slice(0, EXAMPLES_PER_MOTIF)
      .map((m) => {
        const g = gameById.get(m.gameId);
        const opponent = g ? (g.userColor === "white" ? g.blackUsername : g.whiteUsername) : undefined;
        return {
          gameId: m.gameId,
          ply: m.ply,
          moveNumber: Math.ceil(m.ply / 2),
          sideToMove: m.sideToMove,
          fenBefore: m.fenBefore,
          san: m.san,
          uci: m.uci,
          bestMoveSan: m.bestMoveSan,
          centipawnLoss: m.centipawnLoss,
          classification: m.classification,
          opponent,
          endTime: g?.endTime,
        };
      });
    return {
      motif: motifFor(id),
      count: b.count,
      blunders: b.blunders,
      share: b.count / total,
      avgLossCp: Math.round(b.loss / b.count),
      examples,
    };
  });
  rows.sort((a, b) => b.count - a.count || b.avgLossCp - a.avgLossCp);

  const sum = (side: MotifSide) => rows.filter((r) => r.motif.side === side).reduce((n, r) => n + r.count, 0);
  return {
    total,
    missed: sum("missed"),
    allowed: sum("allowed"),
    rows,
    top: rows.find((r) => r.motif.side !== "none"),
  };
}
