// Chegga Web — which synced games to drop when browser storage runs low
//
// The cache is the `games` store plus each game's move analysis. Saved
// positions are never part of it: each one holds its own board, so it stays
// useful without its game. Games leave oldest-opened first (LRU). A game
// that was never opened counts as last used on the day it was played.
//
// Pure: no DOM, no storage. db.ts does the reading and deleting.

export interface EvictionCandidate {
  id: string;
  lastAccessedAt?: number; // unix ms, set when the game is opened for review
  endTime: number; // unix seconds, when the game was played
}

export const EVICT_BATCH = 50;
/** Automatic runs never take more than this share of the games at once. */
export const AUTO_EVICT_MAX_SHARE = 0.25;

const PREF_KEY = "chegga-web:auto-evict";

export function lastUsedMs(c: EvictionCandidate): number {
  return c.lastAccessedAt ?? c.endTime * 1000;
}

/** The ids to remove: the least recently used first, at most `count`, and at
 * most `maxShare` of all candidates (rounded down). Ties go to the older game,
 * then to the id, so the answer is always the same for the same input. */
export function planEviction(
  candidates: readonly EvictionCandidate[],
  opts: { count?: number; maxShare?: number } = {},
): string[] {
  const count = Math.max(0, Math.floor(opts.count ?? EVICT_BATCH));
  const cap = Math.floor(candidates.length * Math.min(1, Math.max(0, opts.maxShare ?? 1)));
  const take = Math.min(count, cap);
  return [...candidates]
    .sort((a, b) => lastUsedMs(a) - lastUsedMs(b) || a.endTime - b.endTime || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, take)
    .map((c) => c.id);
}

export function isAutoEvictOn(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAutoEvict(on: boolean): void {
  try {
    if (on) localStorage.setItem(PREF_KEY, "1");
    else localStorage.removeItem(PREF_KEY);
  } catch {
    // best-effort only, like every other remembered preference here
  }
}
