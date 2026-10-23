// Chegga Web — picking one synced game to review
//
// The review screen already takes any game's analysis records. What was
// missing is a way to choose which of the synced games to open. This is the
// model behind that chooser: one card per game, newest first. Pure -- the
// markup is gamePickerView.ts, the wiring is main.ts.

import { Chess } from "chess.js";
import type { GameRecord } from "./db";

export interface PickerCard {
  id: string; // chessComUuid
  opponent: string;
  opponentRating: number;
  yourRating: number;
  result: "win" | "loss" | "draw";
  color: "white" | "black";
  endTime: number; // unix seconds
  timeClass: string;
  opening?: string;
  analyzed: boolean;
  /** Only standard chess can be graded; a variant game is listed but not openable. */
  supported: boolean;
  /** The first moves of the game, as "1. e4 e5 2. Nf3 ..." -- shown on hover. */
  preview: string;
}

// A long strip of hundreds of cards is a wall, not a picker. The newest games
// are what someone reviewing wants.
export const PICKER_CARD_LIMIT = 60;

// How many opening moves (plies) the hover preview shows.
const PREVIEW_PLIES = 10;

// The picker re-renders on every click, so keep each game's preview once built.
const previewCache = new Map<string, string>();

function openingPreview(id: string, pgn: string): string {
  const cached = previewCache.get(id);
  if (cached !== undefined) return cached;
  let text = "";
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    text = chess
      .history()
      .slice(0, PREVIEW_PLIES)
      .map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san))
      .join(" ");
  } catch {
    text = "";
  }
  previewCache.set(id, text);
  return text;
}

export function toPickerCard(g: GameRecord): PickerCard {
  const mine = g.userColor === "white";
  return {
    id: g.chessComUuid,
    opponent: mine ? g.blackUsername : g.whiteUsername,
    opponentRating: mine ? g.blackRating : g.whiteRating,
    yourRating: mine ? g.whiteRating : g.blackRating,
    result: g.userResult,
    color: g.userColor,
    endTime: g.endTime,
    timeClass: g.timeClass,
    opening: g.openingName,
    analyzed: g.analyzed,
    supported: g.rules === "chess" && g.pgn.length > 0,
    preview: openingPreview(g.chessComUuid, g.pgn),
  };
}

/** Newest first. `openingName`, when given, narrows to games in that exact
 * opening line -- the "see your games in this line" jump from a weak-opening
 * diagnostic (critique #7: naming a weak opening with no way to look at the
 * games it happened in is a mirror). */
export function buildPickerCards(games: GameRecord[], limit = PICKER_CARD_LIMIT, openingName?: string): PickerCard[] {
  // Narrow and cut before mapping: building a card parses the PGN for its preview.
  return games
    .filter((g) => !openingName || g.openingName === openingName)
    .sort((a, b) => b.endTime - a.endTime)
    .slice(0, limit)
    .map(toPickerCard);
}
