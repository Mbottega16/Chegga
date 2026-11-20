// Chegga Web — exponential backoff with jitter for HTTP rate limits (429) and retries
//
// Shared by ChessComClient and LichessClient to handle HTTP 429 responses
// and transient network errors gracefully.

export interface BackoffOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryAfterSeconds?: number | null;
  randomFn?: () => number;
}

/**
 * Calculates backoff delay in milliseconds using exponential backoff with jitter.
 *
 * - When `retryAfterSeconds` is provided (> 0), honors the server-specified delay
 *   and adds small jitter (up to 10% or 1000ms) to avoid thundering herd.
 * - Otherwise, computes exponential backoff: base * 2^(attempt - 1), capped at maxDelayMs,
 *   with equal jitter: delay = half + random * half (ensuring a non-zero lower bound).
 */
export function calculateBackoffWithJitter(
  attempt: number,
  opts: BackoffOptions = {},
): number {
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  const maxDelayMs = opts.maxDelayMs ?? 60_000;
  const random = opts.randomFn ?? Math.random;

  if (opts.retryAfterSeconds !== undefined && opts.retryAfterSeconds !== null && opts.retryAfterSeconds > 0) {
    const retryAfterMs = opts.retryAfterSeconds * 1000;
    const jitter = random() * Math.min(1000, retryAfterMs * 0.1);
    return Math.round(retryAfterMs + jitter);
  }

  const expDelay = Math.min(baseDelayMs * 2 ** Math.max(0, attempt - 1), maxDelayMs);
  const half = expDelay / 2;
  const jitter = random() * half;
  return Math.round(half + jitter);
}
