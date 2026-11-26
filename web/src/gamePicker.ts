// Chegga Web — picking one synced game to review
//
// The review screen already takes any game's analysis records. What was
// missing is a way to choose which of the synced games to open. This is the
// model behind that chooser: one card per game, newest first, filterable by
// result. Pure -- the markup is gamePickerView.ts, the wiring is main.ts.

import type { GameRecord } from "./db";
import type { Site } from "./siteSync";
import { LICHESS_ID_PREFIX } from "./lichessNormalizer";

export type PickerFilter = "all" | "win" | "loss" | "draw" | "analyzed";

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
  pgn?: string;
  /** Where it was played: Lichess game ids carry a prefix, Chess.com's do not. */
  site: Site;
}

// A carousel of hundreds of cards is a wall, not a picker. The newest games
// are what someone reviewing wants; older ones stay reachable through the
// filters as the newer ones are played out.
export const PICKER_CARD_LIMIT = 60;

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
    pgn: g.pgn,
    site: g.chessComUuid.startsWith(LICHESS_ID_PREFIX) ? "lichess" : "chesscom",
  };
}

function matches(card: PickerCard, filter: PickerFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "analyzed":
      return card.analyzed;
    default:
      return card.result === filter;
  }
}

/** Newest first. `openingName`, when given, narrows to games in that exact
 * opening line on top of the result filter -- the "see your games in this
 * line" jump from a weak-opening diagnostic (critique #7: naming a weak
 * opening with no way to look at the games it happened in is a mirror). */
export function buildPickerCards(
  games: GameRecord[],
  filter: PickerFilter,
  limit = PICKER_CARD_LIMIT,
  openingName?: string,
): PickerCard[] {
  return games
    .map(toPickerCard)
    .filter((c) => matches(c, filter))
    .filter((c) => !openingName || c.opening === openingName)
    .sort((a, b) => b.endTime - a.endTime)
    .slice(0, limit);
}

export function pickerCounts(games: GameRecord[], openingName?: string): Record<PickerFilter, number> {
  const cards = games.map(toPickerCard).filter((c) => !openingName || c.opening === openingName);
  return {
    all: cards.length,
    win: cards.filter((c) => c.result === "win").length,
    loss: cards.filter((c) => c.result === "loss").length,
    draw: cards.filter((c) => c.result === "draw").length,
    analyzed: cards.filter((c) => c.analyzed).length,
  };
}

export const RECENT_LIMIT = 10;

/** The newest games for the short list under "Review any game". A query
 * narrows it, across every synced game, to an opponent or opening that
 * contains the text. */
export function findRecentGames(games: GameRecord[], query = "", limit = RECENT_LIMIT): PickerCard[] {
  const q = query.trim().toLowerCase();
  const matching = games.filter((g) => {
    if (!q) return true;
    const opponent = g.userColor === "white" ? g.blackUsername : g.whiteUsername;
    return opponent.toLowerCase().includes(q) || (g.openingName ?? "").toLowerCase().includes(q);
  });
  return matching
    .sort((a, b) => b.endTime - a.endTime)
    .slice(0, limit)
    .map(toPickerCard);
}
