// Chegga Web — Lichess public games API client
//
// Lichess's game export is public and open to browsers (it answers with
// `Access-Control-Allow-Origin: *`), so a visitor's own tab can read their
// games directly: no login, no proxy, no key. `Accept` is one of the
// headers a browser may send without a CORS preflight, so this is a plain
// GET. No `User-Agent` is set on purpose: browsers do not allow it.
//
// One request at a time, and a 429 means "wait a minute" -- both are
// Lichess's own rules for the API. The tutorial and the sync form each
// make a single request, so neither needs a queue.

import { calculateBackoffWithJitter } from "./backoff";

export { calculateBackoffWithJitter };

const LICHESS_API_BASE = "https://lichess.org/api";

export interface LichessPlayer {
  user?: { name: string; id?: string };
  rating?: number;
  aiLevel?: number;
}

export interface LichessRawGame {
  id: string;
  rated?: boolean;
  variant?: string; // "standard", "fromPosition", "chess960", ...
  speed?: string; // ultraBullet | bullet | blitz | rapid | classical | correspondence
  createdAt?: number; // ms
  lastMoveAt?: number; // ms
  status?: string; // mate | resign | stalemate | timeout | outoftime | draw | ...
  players?: { white?: LichessPlayer; black?: LichessPlayer };
  winner?: "white" | "black";
  opening?: { eco?: string; name?: string; ply?: number };
  clock?: { initial: number; increment: number };
  pgn?: string;
}

export class LichessHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Plain-language message for the errors a visitor can actually hit. */
export function messageFor(status: number, username: string): string {
  if (status === 404) return `Lichess has no account named "${username}". Check the spelling and try again.`;
  if (status === 429) return "Lichess asked us to slow down. Wait a minute, then try again.";
  return `Lichess could not be reached (error ${status}). Try again in a moment.`;
}

/** One NDJSON line -> a game, or null when it is blank or not a game. */
function parseNdjsonLine(line: string): LichessRawGame | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const game = JSON.parse(trimmed) as LichessRawGame;
    return game && typeof game.id === "string" ? game : null;
  } catch {
    return null;
  }
}

/** NDJSON: one JSON game per line. A line that does not parse is skipped,
 * so one bad record cannot lose the rest. */
export function parseNdjson(text: string): LichessRawGame[] {
  const games: LichessRawGame[] = [];
  for (const line of text.split("\n")) {
    const game = parseNdjsonLine(line);
    if (game) games.push(game);
  }
  return games;
}

export interface LichessFetchOptions {
  max: number;
  sinceMs?: number;
  untilMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  randomFn?: () => number;
  sleepFn?: (ms: number) => Promise<void>;
  onRateLimit?: (secondsRemaining: number) => void;
}

/** The games URL, with the same fields every Lichess request asks for so a
 * stored game has the same shape whichever path fetched it. `sinceMs` and
 * `untilMs` are milliseconds. */
export function lichessGamesUrl(username: string, opts: { max: number; sinceMs?: number; untilMs?: number }): string {
  const params = new URLSearchParams({
    max: String(opts.max),
    pgnInJson: "true",
    clocks: "true",
    opening: "true",
  });
  if (opts.sinceMs !== undefined) params.set("since", String(opts.sinceMs));
  if (opts.untilMs !== undefined) params.set("until", String(opts.untilMs));
  return `${LICHESS_API_BASE}/games/user/${encodeURIComponent(username)}?${params.toString()}`;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The newest `max` games, newest first. `sinceMs` limits it to games
 * played after that time, for an incremental re-sync.
 * Retries HTTP 429 rate limits using exponential backoff with jitter. */
export async function fetchLichessGames(
  username: string,
  opts: LichessFetchOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<LichessRawGame[]> {
  const url = lichessGamesUrl(username, opts);
  const maxRetries = opts.maxRetries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  const maxDelayMs = opts.maxDelayMs ?? 60_000;
  const sleep = opts.sleepFn ?? defaultSleep;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let response: Response;
    try {
      response = await fetchImpl(url, { headers: { Accept: "application/x-ndjson" } });
    } catch {
      throw new LichessHttpError(0, "Could not reach Lichess. Check your connection and try again.");
    }

    if (response.status === 429) {
      if (attempt >= maxRetries) {
        throw new LichessHttpError(429, messageFor(429, username));
      }
      const retryAfterHeader = response.headers?.get?.("Retry-After");
      const retryAfterSec = retryAfterHeader ? parseFloat(retryAfterHeader) : null;
      const delayMs = calculateBackoffWithJitter(attempt, {
        baseDelayMs,
        maxDelayMs,
        retryAfterSeconds: Number.isFinite(retryAfterSec) && (retryAfterSec ?? 0) > 0 ? retryAfterSec : null,
        randomFn: opts.randomFn,
      });

      const totalSeconds = Math.max(1, Math.ceil(delayMs / 1000));
      if (delayMs <= 1000) {
        opts.onRateLimit?.(totalSeconds);
        await sleep(delayMs);
      } else {
        let remainingMs = delayMs;
        while (remainingMs > 0) {
          const secondsLeft = Math.ceil(remainingMs / 1000);
          opts.onRateLimit?.(secondsLeft);
          const step = Math.min(1000, remainingMs);
          await sleep(step);
          remainingMs -= step;
        }
      }
      continue;
    }

    if (!response.ok) throw new LichessHttpError(response.status, messageFor(response.status, username));
    return parseNdjson(await response.text());
  }

  throw new LichessHttpError(429, messageFor(429, username));
}

/** The same request as fetchLichessGames, but the body is read as it
 * arrives and each game is handed out as soon as its line is complete. A line
 * can be split across two network chunks, so bytes are held until the
 * newline. Stops reading (and closes the connection) when the caller stops
 * iterating or `signal` aborts. Used by the full-history sync, where one
 * response can be long. */
export async function* streamLichessGames(
  username: string,
  opts: LichessFetchOptions,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): AsyncGenerator<LichessRawGame> {
  const url = lichessGamesUrl(username, opts);
  const maxRetries = opts.maxRetries ?? 1;
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  const maxDelayMs = opts.maxDelayMs ?? 60_000;
  const sleep = opts.sleepFn ?? defaultSleep;

  let response: Response | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) return;
    try {
      response = await fetchImpl(url, { headers: { Accept: "application/x-ndjson" }, signal });
    } catch {
      if (signal?.aborted) return;
      throw new LichessHttpError(0, "Could not reach Lichess. Check your connection and try again.");
    }

    if (response.status === 429) {
      if (attempt >= maxRetries) {
        throw new LichessHttpError(429, messageFor(429, username));
      }
      const retryAfterHeader = response.headers?.get?.("Retry-After");
      const retryAfterSec = retryAfterHeader ? parseFloat(retryAfterHeader) : null;
      const delayMs = calculateBackoffWithJitter(attempt, {
        baseDelayMs,
        maxDelayMs,
        retryAfterSeconds: Number.isFinite(retryAfterSec) && (retryAfterSec ?? 0) > 0 ? retryAfterSec : null,
        randomFn: opts.randomFn,
      });

      const totalSeconds = Math.max(1, Math.ceil(delayMs / 1000));
      if (delayMs <= 1000) {
        opts.onRateLimit?.(totalSeconds);
        await sleep(delayMs);
      } else {
        let remainingMs = delayMs;
        while (remainingMs > 0 && !signal?.aborted) {
          const secondsLeft = Math.ceil(remainingMs / 1000);
          opts.onRateLimit?.(secondsLeft);
          const step = Math.min(1000, remainingMs);
          await sleep(step);
          remainingMs -= step;
        }
      }
      continue;
    }

    if (!response.ok) throw new LichessHttpError(response.status, messageFor(response.status, username));
    break;
  }

  if (!response || !response.ok) {
    if (signal?.aborted) return;
    throw new LichessHttpError(429, messageFor(429, username));
  }

  if (!response.body) {
    // No streaming in this environment: fall back to the whole body.
    for (const game of parseNdjson(await response.text())) yield game;
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      if (signal?.aborted) return;
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        if (signal?.aborted) return;
        throw new LichessHttpError(0, "The connection to Lichess dropped. Check your connection and try again.");
      }
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const game = parseNdjsonLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (game) yield game;
        newline = buffer.indexOf("\n");
      }
    }
    const last = parseNdjsonLine(buffer + decoder.decode());
    if (last) yield last;
  } finally {
    reader.cancel().catch(() => {});
  }
}
