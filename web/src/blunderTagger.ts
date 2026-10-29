// Chegga Web — WHY a mistake/blunder happened (Phase 2 & Tactical DNA)
//
// Identifies tactical motifs (forks, pins, skewers, back-rank threats,
// trapped pieces, hung material) and computes the "Blunder DNA" capsule:
// Motif, Root Cause (time rush vs panic vs tunnel vision), and Damage.

import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

export const MISSED_MATE = "missed_mate";
export const ALLOWED_MATE = "allowed_mate";
export const FORK = "fork";
export const PIN = "pin";
export const SKEWER = "skewer";
export const BACK_RANK = "back_rank";
export const TRAPPED_PIECE = "trapped_piece";
export const HUNG_MATERIAL = "hung_material";
export const MISSED_CAPTURE = "missed_capture";
export const POSITIONAL = "positional";

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100,
};

export const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

const TAGGABLE_CLASSIFICATIONS = new Set(["mistake", "blunder"]);

function findKing(board: Chess, color: Color): Square | null {
  for (const row of board.board()) {
    for (const cell of row) {
      if (cell && cell.color === color && cell.type === "k") {
        return cell.square;
      }
    }
  }
  return null;
}

export function isHanging(board: Chess, square: Square, pieceColor: Color): boolean {
  const piece = board.get(square);
  if (!piece || piece.type === "k") return false;

  const opponent: Color = pieceColor === "w" ? "b" : "w";
  const attackers = board.attackers(square, opponent);
  if (attackers.length === 0) return false;

  const defenders = board.attackers(square, pieceColor);
  if (defenders.length === 0) return true;

  const cheapestAttacker = Math.min(...attackers.map((sq) => PIECE_VALUES[board.get(sq)!.type]));
  return cheapestAttacker < PIECE_VALUES[piece.type];
}

export function hasHangingPiece(board: Chess, color: Color, minValue: number = 1): boolean {
  return hangingPieces(board, color, minValue).length > 0;
}

export function hangingPieces(
  board: Chess,
  color: Color,
  minValue: number = 1,
): { square: Square; type: PieceSymbol }[] {
  const found: { square: Square; type: PieceSymbol }[] = [];
  for (const row of board.board()) {
    for (const cell of row) {
      if (cell && cell.color === color && PIECE_VALUES[cell.type] >= minValue && isHanging(board, cell.square, color)) {
        found.push({ square: cell.square, type: cell.type });
      }
    }
  }
  return found;
}

export interface TacticalDetail {
  motif: string;
  motifLabel: string;
  motifIcon: string;
  attackerSquare?: Square;
  attackerPiece?: PieceSymbol;
  victimSquare?: Square;
  victimPiece?: PieceSymbol;
  secondarySquare?: Square;
  secondaryPiece?: PieceSymbol;
}

export function checkBackRank(boardAfter: Chess, moverColor: Color): TacticalDetail | null {
  const kingSquare = findKing(boardAfter, moverColor);
  if (!kingSquare) return null;
  const backRank = moverColor === "w" ? "1" : "8";
  const pawnRank = moverColor === "w" ? "2" : "7";
  if (kingSquare[1] !== backRank) return null;

  const colIdx = "abcdefgh".indexOf(kingSquare[0]);
  let frontBlocked = true;
  for (let dc = -1; dc <= 1; dc++) {
    const c = colIdx + dc;
    if (c >= 0 && c <= 7) {
      const sq = ("abcdefgh"[c] + pawnRank) as Square;
      const piece = boardAfter.get(sq);
      if (!piece || piece.color !== moverColor || piece.type !== "p") {
        frontBlocked = false;
        break;
      }
    }
  }
  if (!frontBlocked) return null;

  const opponentColor: Color = moverColor === "w" ? "b" : "w";
  for (const row of boardAfter.board()) {
    for (const cell of row) {
      if (cell && cell.color === opponentColor && (cell.type === "r" || cell.type === "q")) {
        if (cell.square[1] === backRank || boardAfter.isAttacked(kingSquare, opponentColor)) {
          return {
            motif: BACK_RANK,
            motifLabel: "Back-Rank Weakness",
            motifIcon: "🏰",
            attackerSquare: cell.square,
            attackerPiece: cell.type,
            victimSquare: kingSquare,
            victimPiece: "k",
          };
        }
      }
    }
  }

  // Also check if opponent has an immediate legal rook/queen move to the back rank
  const oppMoves = boardAfter.moves({ verbose: true });
  for (const m of oppMoves) {
    if ((m.piece === "r" || m.piece === "q") && m.to[1] === backRank) {
      return {
        motif: BACK_RANK,
        motifLabel: "Back-Rank Weakness",
        motifIcon: "🏰",
        attackerSquare: m.from,
        attackerPiece: m.piece,
        victimSquare: kingSquare,
        victimPiece: "k",
        secondarySquare: m.to,
      };
    }
  }
  return null;
}

export function checkPin(boardAfter: Chess, moverColor: Color): TacticalDetail | null {
  const kingSquare = findKing(boardAfter, moverColor);
  if (!kingSquare) return null;
  const opponentColor: Color = moverColor === "w" ? "b" : "w";

  const directions = [
    { df: 0, dr: 1, ortho: true },
    { df: 0, dr: -1, ortho: true },
    { df: 1, dr: 0, ortho: true },
    { df: -1, dr: 0, ortho: true },
    { df: 1, dr: 1, ortho: false },
    { df: 1, dr: -1, ortho: false },
    { df: -1, dr: 1, ortho: false },
    { df: -1, dr: -1, ortho: false },
  ];

  const kf = "abcdefgh".indexOf(kingSquare[0]);
  const kr = parseInt(kingSquare[1], 10) - 1;

  for (const { df, dr, ortho } of directions) {
    let f = kf + df;
    let r = kr + dr;
    let pinnedPiece: { square: Square; type: PieceSymbol } | null = null;

    while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
      const sq = ("abcdefgh"[f] + (r + 1).toString()) as Square;
      const piece = boardAfter.get(sq);
      if (piece) {
        if (!pinnedPiece) {
          if (piece.color === moverColor) {
            pinnedPiece = { square: sq, type: piece.type };
          } else {
            break;
          }
        } else {
          if (piece.color === opponentColor) {
            const isSlider = ortho ? piece.type === "r" || piece.type === "q" : piece.type === "b" || piece.type === "q";
            if (isSlider) {
              return {
                motif: PIN,
                motifLabel: `Pinned ${PIECE_NAMES[pinnedPiece.type] ?? "Piece"}`,
                motifIcon: "📌",
                attackerSquare: sq,
                attackerPiece: piece.type,
                victimSquare: pinnedPiece.square,
                victimPiece: pinnedPiece.type,
              };
            }
          }
          break;
        }
      }
      f += df;
      r += dr;
    }
  }
  return null;
}

export function checkFork(boardAfter: Chess, moverColor: Color): TacticalDetail | null {
  const opponentColor: Color = moverColor === "w" ? "b" : "w";
  const legalMoves = boardAfter.moves({ verbose: true });
  for (const move of legalMoves) {
    const testBoard = new Chess(boardAfter.fen());
    testBoard.move({ from: move.from, to: move.to, promotion: move.promotion });

    const targets: { square: Square; type: PieceSymbol }[] = [];
    for (const row of testBoard.board()) {
      for (const cell of row) {
        if (cell && cell.color === moverColor && (cell.type === "k" || PIECE_VALUES[cell.type] >= 3)) {
          const attackers = testBoard.attackers(cell.square, opponentColor);
          if (attackers.includes(move.to)) {
            targets.push({ square: cell.square, type: cell.type });
          }
        }
      }
    }

    if (targets.length >= 2) {
      const defenderAttackers = testBoard.attackers(move.to, moverColor);
      const isDefendedByMover = defenderAttackers.length > 0;
      const attackerValue = PIECE_VALUES[move.piece];
      const maxTargetValue = Math.max(...targets.map((t) => PIECE_VALUES[t.type]));
      if (!isDefendedByMover || maxTargetValue > attackerValue || targets.some((t) => t.type === "k")) {
        const motifName = move.piece === "n" ? "Knight Fork" : move.piece === "p" ? "Pawn Fork" : "Fork";
        return {
          motif: FORK,
          motifLabel: motifName,
          motifIcon: "⚔️",
          attackerSquare: move.to,
          attackerPiece: move.piece,
          victimSquare: targets[0].square,
          victimPiece: targets[0].type,
          secondarySquare: targets[1].square,
          secondaryPiece: targets[1].type,
        };
      }
    }
  }
  return null;
}

export function checkSkewer(boardAfter: Chess, moverColor: Color): TacticalDetail | null {
  const opponentColor: Color = moverColor === "w" ? "b" : "w";
  for (const row of boardAfter.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== opponentColor) continue;
      if (cell.type !== "r" && cell.type !== "b" && cell.type !== "q") continue;

      const directions = [];
      if (cell.type === "r" || cell.type === "q") {
        directions.push({ df: 0, dr: 1 }, { df: 0, dr: -1 }, { df: 1, dr: 0 }, { df: -1, dr: 0 });
      }
      if (cell.type === "b" || cell.type === "q") {
        directions.push({ df: 1, dr: 1 }, { df: 1, dr: -1 }, { df: -1, dr: 1 }, { df: -1, dr: -1 });
      }

      const cf = "abcdefgh".indexOf(cell.square[0]);
      const cr = parseInt(cell.square[1], 10) - 1;

      for (const { df, dr } of directions) {
        let f = cf + df;
        let r = cr + dr;
        let firstPiece: { square: Square; type: PieceSymbol } | null = null;

        while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
          const sq = ("abcdefgh"[f] + (r + 1).toString()) as Square;
          const target = boardAfter.get(sq);
          if (target) {
            if (!firstPiece) {
              if (target.color === moverColor && (target.type === "k" || target.type === "q" || target.type === "r")) {
                firstPiece = { square: sq, type: target.type };
              } else {
                break;
              }
            } else {
              if (target.color === moverColor && PIECE_VALUES[firstPiece.type] > PIECE_VALUES[target.type] && PIECE_VALUES[target.type] >= 3) {
                return {
                  motif: SKEWER,
                  motifLabel: `Skewer on ${PIECE_NAMES[firstPiece.type]}`,
                  motifIcon: "🎯",
                  attackerSquare: cell.square,
                  attackerPiece: cell.type,
                  victimSquare: firstPiece.square,
                  victimPiece: firstPiece.type,
                  secondarySquare: sq,
                  secondaryPiece: target.type,
                };
              }
              break;
            }
          }
          f += df;
          r += dr;
        }
      }
    }
  }
  return null;
}

export interface TagMoveArgs {
  fenBefore: string;
  uci: string;
  san: string;
  bestMoveSan?: string;
  evalBeforeMate?: number;
  evalAfterMate?: number;
  sideToMove: "white" | "black";
  classification: string;
}

export function tagMove(args: TagMoveArgs): string | undefined {
  if (!TAGGABLE_CLASSIFICATIONS.has(args.classification)) return undefined;

  const moverSign = args.sideToMove === "white" ? 1 : -1;
  const bestBeforeMoverMate = args.evalBeforeMate !== undefined ? args.evalBeforeMate * moverSign : undefined;
  const afterMoverMate = args.evalAfterMate !== undefined ? args.evalAfterMate * moverSign : undefined;

  if (bestBeforeMoverMate !== undefined && bestBeforeMoverMate > 0) return MISSED_MATE;
  if (afterMoverMate !== undefined && afterMoverMate < 0) return ALLOWED_MATE;

  const board = new Chess(args.fenBefore);
  const moverColor = board.turn();
  try {
    board.move({ from: args.uci.slice(0, 2), to: args.uci.slice(2, 4), promotion: args.uci.slice(4) || undefined });
  } catch {
    return POSITIONAL;
  }

  // Check specific tactical motifs
  const backRank = checkBackRank(board, moverColor);
  if (backRank) return BACK_RANK;

  const fork = checkFork(board, moverColor);
  if (fork) return FORK;

  const pin = checkPin(board, moverColor);
  if (pin) return PIN;

  const skewer = checkSkewer(board, moverColor);
  if (skewer) return SKEWER;

  if (hasHangingPiece(board, moverColor)) return HUNG_MATERIAL;

  if (args.bestMoveSan?.includes("x") && !args.san.includes("x")) return MISSED_CAPTURE;

  return POSITIONAL;
}

export interface TacticalLine {
  from: Square;
  to: Square;
  type: "attack" | "pin" | "skewer" | "target";
  color?: string;
}

export interface BlunderDnaInput {
  fenBefore: string;
  uci: string;
  san: string;
  classification: string;
  sideToMove: "white" | "black";
  centipawnLoss?: number;
  evalBeforeMate?: number;
  evalAfterMate?: number;
  bestMoveSan?: string;
  clockRemainingSec?: number;
  timeSpentSec?: number;
  clockAlert?: "panic" | "rush";
}

export interface BlunderDna {
  motif: string;
  motifLabel: string;
  motifIcon: string;
  rootCause: string;
  rootCauseLabel: string;
  rootCauseIcon: string;
  damageLabel: string;
  damageCp?: number;
  victimPiece?: PieceSymbol;
  victimSquare?: Square;
  attackerPiece?: PieceSymbol;
  attackerSquare?: Square;
  secondarySquare?: Square;
  secondaryPiece?: PieceSymbol;
  tacticalLines: TacticalLine[];
}

export function extractBlunderDna(input: BlunderDnaInput): BlunderDna | null {
  if (!TAGGABLE_CLASSIFICATIONS.has(input.classification)) return null;

  const board = new Chess(input.fenBefore);
  const moverColor: Color = board.turn();
  try {
    board.move({ from: input.uci.slice(0, 2), to: input.uci.slice(2, 4), promotion: input.uci.slice(4) || undefined });
  } catch {
    return null;
  }

  let motif = POSITIONAL;
  let motifLabel = "Positional Mistake";
  let motifIcon = "📐";
  let attackerSquare: Square | undefined;
  let attackerPiece: PieceSymbol | undefined;
  let victimSquare: Square | undefined;
  let victimPiece: PieceSymbol | undefined;
  let secondarySquare: Square | undefined;
  let secondaryPiece: PieceSymbol | undefined;

  const moverSign = input.sideToMove === "white" ? 1 : -1;
  const bestBeforeMoverMate = input.evalBeforeMate !== undefined ? input.evalBeforeMate * moverSign : undefined;
  const afterMoverMate = input.evalAfterMate !== undefined ? input.evalAfterMate * moverSign : undefined;

  if (bestBeforeMoverMate !== undefined && bestBeforeMoverMate > 0) {
    motif = MISSED_MATE;
    motifLabel = "Missed Mate";
    motifIcon = "👑";
  } else if (afterMoverMate !== undefined && afterMoverMate < 0) {
    motif = ALLOWED_MATE;
    motifLabel = "Allowed Mate";
    motifIcon = "💀";
  } else {
    const backRank = checkBackRank(board, moverColor);
    const fork = checkFork(board, moverColor);
    const pin = checkPin(board, moverColor);
    const skewer = checkSkewer(board, moverColor);

    if (backRank) {
      motif = BACK_RANK;
      motifLabel = backRank.motifLabel;
      motifIcon = backRank.motifIcon;
      attackerSquare = backRank.attackerSquare;
      attackerPiece = backRank.attackerPiece;
      victimSquare = backRank.victimSquare;
      victimPiece = backRank.victimPiece;
    } else if (fork) {
      motif = FORK;
      motifLabel = fork.motifLabel;
      motifIcon = fork.motifIcon;
      attackerSquare = fork.attackerSquare;
      attackerPiece = fork.attackerPiece;
      victimSquare = fork.victimSquare;
      victimPiece = fork.victimPiece;
      secondarySquare = fork.secondarySquare;
      secondaryPiece = fork.secondaryPiece;
    } else if (pin) {
      motif = PIN;
      motifLabel = pin.motifLabel;
      motifIcon = pin.motifIcon;
      attackerSquare = pin.attackerSquare;
      attackerPiece = pin.attackerPiece;
      victimSquare = pin.victimSquare;
      victimPiece = pin.victimPiece;
    } else if (skewer) {
      motif = SKEWER;
      motifLabel = skewer.motifLabel;
      motifIcon = skewer.motifIcon;
      attackerSquare = skewer.attackerSquare;
      attackerPiece = skewer.attackerPiece;
      victimSquare = skewer.victimSquare;
      victimPiece = skewer.victimPiece;
      secondarySquare = skewer.secondarySquare;
      secondaryPiece = skewer.secondaryPiece;
    } else {
      const hung = hangingPieces(board, moverColor);
      if (hung.length > 0) {
        motif = HUNG_MATERIAL;
        motifLabel = `Hanging ${PIECE_NAMES[hung[0].type] ?? "Piece"}`;
        motifIcon = "💥";
        victimSquare = hung[0].square;
        victimPiece = hung[0].type;
      } else if (input.bestMoveSan?.includes("x") && !input.san.includes("x")) {
        motif = MISSED_CAPTURE;
        motifLabel = "Missed Free Capture";
        motifIcon = "🎯";
      }
    }
  }

  // Root cause determination
  let rootCause = "tactical_blindspot";
  let rootCauseLabel = "Tactical Blindspot";
  let rootCauseIcon = "🧠";

  if (input.clockAlert === "panic" || (input.clockRemainingSec !== undefined && input.clockRemainingSec <= 10)) {
    rootCause = "clock_panic";
    const rem = input.clockRemainingSec !== undefined ? Math.round(input.clockRemainingSec) : 10;
    rootCauseLabel = `Clock Panic (${rem}s left)`;
    rootCauseIcon = "⏱️";
  } else if (input.clockAlert === "rush" || (input.timeSpentSec !== undefined && input.timeSpentSec <= 2.5)) {
    rootCause = "time_rush";
    const t = input.timeSpentSec !== undefined ? input.timeSpentSec.toFixed(1) : "1.5";
    rootCauseLabel = `Time Rush (${t}s)`;
    rootCauseIcon = "⚡";
  } else if (victimSquare) {
    const playedCol = "abcdefgh".indexOf(input.uci[0]);
    const victimCol = "abcdefgh".indexOf(victimSquare[0]);
    if ((playedCol <= 2 && victimCol >= 5) || (playedCol >= 5 && victimCol <= 2)) {
      rootCause = "tunnel_vision";
      rootCauseLabel = "Tunnel Vision";
      rootCauseIcon = "👁️";
    }
  }

  // Damage label
  let damageLabel = "-1.0 pawns";
  if (motif === ALLOWED_MATE) {
    damageLabel = "Forced Mate";
  } else if (input.centipawnLoss && input.centipawnLoss > 0) {
    const pawns = (input.centipawnLoss / 100).toFixed(1);
    if (victimPiece) {
      damageLabel = `-${pawns} (Lost ${PIECE_NAMES[victimPiece]})`;
    } else {
      damageLabel = `-${pawns} pawns`;
    }
  }

  // Tactical tension lines for threat radar
  const tacticalLines: TacticalLine[] = [];
  if (attackerSquare && victimSquare) {
    tacticalLines.push({
      from: attackerSquare,
      to: victimSquare,
      type: motif === PIN ? "pin" : motif === SKEWER ? "skewer" : "attack",
      color: "#f43f5e",
    });
  }
  if (attackerSquare && secondarySquare) {
    tacticalLines.push({
      from: attackerSquare,
      to: secondarySquare,
      type: "attack",
      color: "#fb7185",
    });
  }

  return {
    motif,
    motifLabel,
    motifIcon,
    rootCause,
    rootCauseLabel,
    rootCauseIcon,
    damageLabel,
    damageCp: input.centipawnLoss,
    victimPiece,
    victimSquare,
    attackerPiece,
    attackerSquare,
    secondarySquare,
    secondaryPiece,
    tacticalLines,
  };
}

