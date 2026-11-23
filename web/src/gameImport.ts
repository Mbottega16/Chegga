// Chegga Web — review any game: a pasted PGN, a Lichess link, a shared link
//
// The picker only shows games synced from the visitor's own account. This
// module is the other way in: whatever game someone has in hand. It reads
// what was pasted, fetches a Lichess game by its link (Lichess's public
// export API allows browser requests), and packs a game into a link
// fragment so a review can be shared. The fragment (#review=...) never
// reaches a server, so "nothing leaves your device" still holds: the link
// itself carries the game, and the receiving browser analyzes it.
//
// No DOM. fetch and CompressionStream are passed in or feature-checked, so
// the logic is testable in Node.

import { Chess } from "chess.js";

export type Side = "white" | "black";

/** A Lichess game id from a pasted link, plus the side in the link if any
 * ("lichess.org/abcdEFGH/black"). Player links carry 12 characters; the
 * game id is the first 8. */
export function parseLichessGameUrl(text: string): { id: string; side?: Side } | null {
  const m = /lichess\.org\/(?:game\/export\/)?([A-Za-z0-9]{8})(?:[A-Za-z0-9]{4})?(?:\/(white|black))?(?=$|[/?#\s])/.exec(text.trim());
  if (!m) return null;
  return { id: m[1], side: m[2] as Side | undefined };
}

/** Lichess's single-game export, with clocks, as PGN. */
export function lichessExportUrl(id: string): string {
  return `https://lichess.org/game/export/${id}?clocks=true&evals=false&literate=false`;
}

export async function fetchLichessGame(id: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const res = await fetchFn(lichessExportUrl(id), { headers: { Accept: "application/x-chess-pgn" } });
  if (res.status === 404) throw new Error("Lichess has no game with that link.");
  if (res.status === 429) throw new Error("Lichess is busy right now. Wait a minute and try again.");
  if (!res.ok) throw new Error(`Lichess answered ${res.status}. Try again, or paste the PGN instead.`);
  return await res.text();
}

export function pgnHeader(pgn: string, tag: string): string | undefined {
  const m = new RegExp(`\\[${tag} "([^"]*)"\\]`).exec(pgn);
  return m ? m[1] : undefined;
}

/** Checks a pasted PGN is one standard game with at least one move.
 * Returns the PGN as chess.js reads it, or throws a sentence a visitor can
 * act on. */
export function readPgn(text: string): string {
  const pgn = text.trim();
  if (!pgn) throw new Error("Paste a PGN or a Lichess game link first.");
  const variant = pgnHeader(pgn, "Variant");
  if (variant && !/^(standard|from position)$/i.test(variant)) {
    throw new Error(`That is a ${variant} game. Chegga reviews standard chess only.`);
  }
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch (err: any) {
    throw new Error(`That PGN didn't read as a game (${String(err?.message ?? err).slice(0, 80)}).`);
  }
  if (chess.history().length === 0) throw new Error("That PGN has no moves to review.");
  return pgn;
}

/** Whose review it is: the side asked for; else the side a known username
 * played; else the side in the link; else White. */
export function chooseReviewSide(
  pgn: string,
  opts: { preferred?: Side | "auto"; usernames?: string[]; linkSide?: Side },
): Side {
  if (opts.preferred === "white" || opts.preferred === "black") return opts.preferred;
  const names = (opts.usernames ?? []).filter(Boolean).map((u) => u.toLowerCase());
  const white = pgnHeader(pgn, "White")?.toLowerCase();
  const black = pgnHeader(pgn, "Black")?.toLowerCase();
  if (white && names.includes(white)) return "white";
  if (black && names.includes(black)) return "black";
  return opts.linkSide ?? "white";
}

const SHARE_HEADERS = ["Event", "Date", "White", "Black", "Result", "WhiteElo", "BlackElo", "TimeControl", "SetUp", "FEN", "Opening", "ECO"];

/** The PGN cut down to what a review needs: the headers it reads, the
 * moves, and the clock comments. Everything else (engine evals, Chess.com
 * links, NAGs, variations) is dropped to keep a shared link short. */
export function compactPgn(pgn: string): string {
  const headers: string[] = [];
  for (const tag of SHARE_HEADERS) {
    const v = pgnHeader(pgn, tag);
    if (v !== undefined && v !== "?" && v !== "") headers.push(`[${tag} "${v}"]`);
  }
  let moves = pgn.replace(/^\s*\[[^\]]*\]\s*$/gm, "").trim();
  // Variations, innermost first.
  let prev = "";
  while (prev !== moves) {
    prev = moves;
    moves = moves.replace(/\([^()]*\)/g, " ");
  }
  moves = moves
    .replace(/\{([^}]*)\}/g, (_, body: string) => {
      const clk = /\[%clk\s+([0-9:.]+)\]/.exec(body);
      return clk ? `{[%clk ${clk[1]}]}` : " ";
    })
    .replace(/\$\d+/g, " ")
    .replace(/(\d+)\.\.\.\s*/g, "") // "12... Nf6" after a comment: the number is implied
    .replace(/\s+/g, " ")
    .trim();
  return `${headers.join("\n")}\n\n${moves}`;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipeThrough(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

const canCompress = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

/** The link fragment for a shared review: "review=z<data>&as=b". "z" is
 * deflate-compressed, "p" plain (a browser without CompressionStream). */
export async function encodeSharedReview(pgn: string, side: Side): Promise<string> {
  const raw = new TextEncoder().encode(compactPgn(pgn));
  const packed = canCompress() ? "z" + toBase64Url(await pipeThrough(raw, new CompressionStream("deflate-raw"))) : "p" + toBase64Url(raw);
  return `review=${packed}${side === "black" ? "&as=b" : ""}`;
}

/** Reads a shared review back out of a location hash ("#review=...").
 * Null when the hash isn't one; throws when it is one but is damaged. */
export async function decodeSharedReview(hash: string): Promise<{ pgn: string; side: Side } | null> {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const packed = params.get("review");
  if (!packed) return null;
  const side: Side = params.get("as") === "b" ? "black" : "white";
  const kind = packed[0];
  const bytes = fromBase64Url(packed.slice(1));
  let raw: Uint8Array;
  if (kind === "z") {
    if (!canCompress()) throw new Error("This browser can't open shared reviews. Try a current Chrome, Safari or Firefox.");
    raw = await pipeThrough(bytes, new DecompressionStream("deflate-raw"));
  } else if (kind === "p") {
    raw = bytes;
  } else {
    throw new Error("That review link is damaged.");
  }
  return { pgn: readPgn(new TextDecoder().decode(raw)), side };
}
