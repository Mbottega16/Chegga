// Chegga Web — Chess.com Published-Data API client (Phase 1)
//
// Ported from Chegga's own `app/services/chess_com_client.py`, same
// contract: only the official read-only `api.chess.com/pub/...`
// endpoints, serial requests only (never parallel — that's what
// triggers 429s), a minimum spacing enforced client-side, exponential
// backoff with jitter honoring `Retry-After` on 429/5xx. A browser hitting the same
// public GET endpoint is exactly what Chess.com's PubAPI is meant for —
// no proxy, no server-side key.

import { calculateBackoffWithJitter } from "./backoff";

export { calculateBackoffWithJitter };

const CHESS_COM_API_BASE = "https://api.chess.com/pub";

export interface ChessComPlayerSide {
  username: string;
  rating?: number;
  result: string;
}

export interface ChessComRawGame {
  uuid: string;
  url?: string;
  pgn?: string;
  time_control?: string;
  time_class?: string;
  rules?: string;
  rated?: boolean;
  end_time?: number;
  eco?: string;
  white: ChessComPlayerSide;
  black: ChessComPlayerSide;
}

/** Thrown for a non-retryable HTTP error so callers can special-case a
 * specific status (e.g. a 404 archive month) without string-matching a
 * generic Error's message. */
export class ChessComHttpError extends Error {
  status: number;

  constructor(status: number, url: string) {
    super(`Chess.com API request failed: ${status} ${url}`);
    this.status = status;
  }
}

export interface ChessComClientOptions {
  minIntervalSeconds?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  fetchImpl?: typeof fetch;
  randomFn?: () => number;
  sleepFn?: (ms: number) => Promise<void>;
  onRateLimit?: (secondsRemaining: number) => void;
}

export class ChessComClient {
  private minIntervalMs: number;
  private maxRetries: number;
  private baseDelayMs: number;
  private maxDelayMs: number;
  private lastRequestAt = 0;
  private fetchImpl: typeof fetch;
  private randomFn?: () => number;
  private sleepFn?: (ms: number) => Promise<void>;
  public onRateLimit?: (secondsRemaining: number) => void;

  // `contact` no longer has anywhere to go (see the note on `get()` below
  // about why no custom header is sent) — kept as a required param so call
  // sites still read as "who's using this instance," but it's unused.
  constructor(_contact: string, opts: ChessComClientOptions = {}) {
    this.minIntervalMs = (opts.minIntervalSeconds ?? 1.0) * 1000;
    this.maxRetries = opts.maxRetries ?? 5;
    this.baseDelayMs = opts.baseDelayMs ?? 1000;
    this.maxDelayMs = opts.maxDelayMs ?? 60_000;
    // Wrapped, not stored bare: `this.fetchImpl(url)` would call the browser's
    // fetch with this client as its receiver, which throws "Illegal invocation"
    // in every browser (Node's fetch does not care, so the unit tests pass).
    this.fetchImpl = opts.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.randomFn = opts.randomFn;
    this.sleepFn = opts.sleepFn;
    this.onRateLimit = opts.onRateLimit;
  }

  private sleep(ms: number): Promise<void> {
    return (this.sleepFn ?? defaultSleep)(ms);
  }

  private async throttle(): Promise<void> {
    const elapsed = performance.now() - this.lastRequestAt;
    const wait = this.minIntervalMs - elapsed;
    if (wait > 0) await this.sleep(wait);
  }

  private async pauseCooldown(delayMs: number): Promise<void> {
    const totalSeconds = Math.max(1, Math.ceil(delayMs / 1000));
    if (delayMs <= 1000) {
      this.onRateLimit?.(totalSeconds);
      await this.sleep(delayMs);
      return;
    }

    let remainingMs = delayMs;
    while (remainingMs > 0) {
      const secondsLeft = Math.ceil(remainingMs / 1000);
      this.onRateLimit?.(secondsLeft);
      const step = Math.min(1000, remainingMs);
      await this.sleep(step);
      remainingMs -= step;
    }
  }

  private async get<T>(url: string): Promise<T> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      await this.throttle();
      // No custom headers: Chess.com's CORS preflight only allows the
      // browser's own simple-request headers, and a custom header here
      // (an attempted User-Agent/contact-string equivalent, like the
      // backend client sends) makes the preflight fail outright. Browsers
      // also restrict/override User-Agent on fetch regardless, so there's
      // no real equivalent to Python's requests-level UA string from here.
      let response: Response;
      try {
        response = await this.fetchImpl(url);
      } catch (err) {
        // A thrown fetch (offline, DNS hiccup, transient CORS/network
        // blip) used to propagate straight out and abort an entire
        // multi-month sync over one dropped request. Treat it like a 5xx:
        // back off and retry up to maxRetries, only giving up (rethrow)
        // once the attempts are exhausted.
        if (attempt >= this.maxRetries) throw err;
        const delayMs = calculateBackoffWithJitter(attempt, {
          baseDelayMs: this.baseDelayMs,
          maxDelayMs: this.maxDelayMs,
          randomFn: this.randomFn,
        });
        console.warn(
          `Chess.com API network error on ${url} (attempt ${attempt}/${this.maxRetries}) — backing off ${delayMs}ms`,
          err,
        );
        await this.sleep(delayMs);
        continue;
      }
      this.lastRequestAt = performance.now();

      if (response.ok) return (await response.json()) as T;

      if (response.status === 429) {
        if (attempt >= this.maxRetries) {
          throw new ChessComHttpError(429, url);
        }
        const retryAfterHeader = response.headers?.get?.("Retry-After");
        const retryAfterSec = retryAfterHeader ? parseFloat(retryAfterHeader) : null;
        const delayMs = calculateBackoffWithJitter(attempt, {
          baseDelayMs: this.baseDelayMs,
          maxDelayMs: this.maxDelayMs,
          retryAfterSeconds: Number.isFinite(retryAfterSec) && (retryAfterSec ?? 0) > 0 ? retryAfterSec : null,
          randomFn: this.randomFn,
        });
        console.warn(
          `Chess.com API 429 on ${url} (attempt ${attempt}/${this.maxRetries}) — backing off ${delayMs}ms`,
        );
        await this.pauseCooldown(delayMs);
        continue;
      }

      if (response.status >= 500) {
        if (attempt >= this.maxRetries) {
          throw new ChessComHttpError(response.status, url);
        }
        const retryAfterHeader = response.headers?.get?.("Retry-After");
        const retryAfterSec = retryAfterHeader ? parseFloat(retryAfterHeader) : null;
        const delayMs = calculateBackoffWithJitter(attempt, {
          baseDelayMs: this.baseDelayMs,
          maxDelayMs: this.maxDelayMs,
          retryAfterSeconds: Number.isFinite(retryAfterSec) && (retryAfterSec ?? 0) > 0 ? retryAfterSec : null,
          randomFn: this.randomFn,
        });
        console.warn(
          `Chess.com API ${response.status} on ${url} (attempt ${attempt}/${this.maxRetries}) — backing off ${delayMs}ms`,
        );
        await this.sleep(delayMs);
        continue;
      }

      throw new ChessComHttpError(response.status, url);
    }

    throw new Error(`Chess.com API request failed after ${this.maxRetries} retries: ${url}`);
  }

  async getArchiveUrls(username: string): Promise<string[]> {
    const data = await this.get<{ archives?: string[] }>(
      `${CHESS_COM_API_BASE}/player/${encodeURIComponent(username)}/games/archives`,
    );
    return data.archives ?? [];
  }

  async getArchive(archiveUrl: string): Promise<ChessComRawGame[]> {
    const data = await this.get<{ games?: ChessComRawGame[] }>(archiveUrl);
    return data.games ?? [];
  }

  /** A player's public profile. Only `avatar` is used (opponentAvatars.ts);
   * a player with no picture has no `avatar` field. */
  async getPlayer(username: string): Promise<{ avatar?: unknown }> {
    return this.get<{ avatar?: unknown }>(`${CHESS_COM_API_BASE}/player/${encodeURIComponent(username.toLowerCase())}`);
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
