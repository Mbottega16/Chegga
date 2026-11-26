// Chegga Web — opponents' profile pictures for the "Last 10 games" list
//
// Chess.com gives every player a picture through the same public
// Published-Data API the sync uses: GET /pub/player/{name} answers with an
// `avatar` link on Chess.com's image server. Lichess has no profile
// pictures, so its players (and anyone whose picture is missing or does not
// load) get their initials instead.
//
// The rules the sync follows apply here too: one request at a time, never
// while a sync is talking to Chess.com, and a rate limit or network error
// stops the lookups until the next visit. Each answer, "no picture"
// included, is kept in this browser for a week, so a list that is already
// known costs no requests at all.
//
// Everything here is pure except loading and saving the cache, which take
// the storage as a parameter so tests can hand in a fake.

import { ChessComHttpError, type ChessComClient } from "./chessComClient";
import type { PickerCard } from "./gamePicker";

export interface AvatarEntry {
  url: string | null; // null: the player has no picture
  at: number; // unix ms of the lookup
}
export type AvatarCache = Record<string, AvatarEntry>;

export const AVATAR_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const AVATAR_CACHE_KEY = "chegga-web:opponent-avatars";
export const AVATAR_CACHE_MAX = 300;

// Chess.com names: letters, digits, "_" and "-". Nothing else reaches a URL.
const CHESS_COM_NAME = /^[A-Za-z0-9_-]{2,30}$/;

export function avatarKey(username: string): string {
  return username.trim().toLowerCase();
}

/** The picture link, only when it is https on Chess.com's own image server. */
export function safeAvatarUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== "chesscomfiles.com" && !url.hostname.endsWith(".chesscomfiles.com")) return null;
  return url.href;
}

/** One or two capital letters for a name: "KingTcan" -> "KT",
 * "magnus_carlsen" -> "MC", "rival" -> "R". */
export function initialsFor(name: string): string {
  const words = name.trim().match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])/g) ?? [];
  const letters = words.slice(0, 2).map((w) => w[0]).join("");
  if (letters) return letters.toUpperCase();
  const first = name.trim()[0];
  return first ? first.toUpperCase() : "?";
}

export function isFresh(entry: AvatarEntry | undefined, now: number, ttlMs = AVATAR_TTL_MS): boolean {
  return !!entry && now - entry.at < ttlMs && entry.at <= now;
}

/** The opponents in `cards` whose picture is unknown or a week old, in list
 * order, each name once. Lichess games are left out: Lichess has no pictures. */
export function namesToLookUp(cards: Pick<PickerCard, "opponent" | "site">[], cache: AvatarCache, now: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const card of cards) {
    if (card.site !== "chesscom") continue;
    const name = card.opponent.trim();
    if (!CHESS_COM_NAME.test(name)) continue;
    const key = avatarKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!isFresh(cache[key], now)) out.push(name);
  }
  return out;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // blocked storage: pictures are simply looked up again next visit
  }
}

/** The saved answers, with anything malformed dropped (the saved copy is
 * never trusted: a bad link would otherwise reach an <img>). */
export function loadAvatarCache(storage: StorageLike | null = browserStorage()): AvatarCache {
  const cache: AvatarCache = {};
  let raw: string | null = null;
  try {
    raw = storage?.getItem(AVATAR_CACHE_KEY) ?? null;
  } catch {
    return cache;
  }
  if (!raw) return cache;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return cache;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return cache;
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const { url, at } = value as { url?: unknown; at?: unknown };
    if (typeof at !== "number" || !Number.isFinite(at)) continue;
    if (url === null) cache[key] = { url: null, at };
    else {
      const safe = safeAvatarUrl(url);
      if (safe) cache[key] = { url: safe, at };
    }
  }
  return cache;
}

/** Keeps the newest `max` answers, so the saved copy never grows without end. */
export function pruneAvatarCache(cache: AvatarCache, max = AVATAR_CACHE_MAX): AvatarCache {
  const entries = Object.entries(cache).sort((a, b) => b[1].at - a[1].at).slice(0, max);
  return Object.fromEntries(entries);
}

export function saveAvatarCache(cache: AvatarCache, storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.setItem(AVATAR_CACHE_KEY, JSON.stringify(pruneAvatarCache(cache)));
  } catch {
    // full or blocked storage: the pictures still show for this visit
  }
}

/** The inside of one avatar slot: the picture, or the initials. The picture
 * is decorative (the row already names the player), and no page address is
 * sent along with it. */
export function renderAvatarInner(name: string, url: string | null | undefined): string {
  const safe = url ? safeAvatarUrl(url) : null;
  if (safe) {
    const src = safe.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    return `<img src="${src}" alt="" width="28" height="28" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
  }
  return `<span class="recent-avatar-initials" aria-hidden="true">${initialsFor(name)}</span>`;
}

/** Looks the picture up on Chess.com. `null` when the player has none (or no
 * longer exists); throws on a rate limit or network error. */
export async function fetchChessComAvatar(client: ChessComClient, username: string): Promise<string | null> {
  try {
    const profile = await client.getPlayer(username);
    return safeAvatarUrl(profile.avatar);
  } catch (err) {
    if (err instanceof ChessComHttpError && (err.status === 404 || err.status === 410)) return null;
    throw err;
  }
}

export interface AvatarLookupDeps {
  /** The names still to look up, read again before every request, so a list
   * that changes while lookups run is followed. */
  wanted: () => string[];
  fetchAvatar: (username: string) => Promise<string | null>;
  store: (username: string, url: string | null) => void;
  /** True while something else (a sync) is talking to Chess.com. */
  busy?: () => boolean;
  wait?: (ms: number) => Promise<void>;
  /** How long to wait for `busy` to clear before giving up for this visit. */
  maxBusyWaitMs?: number;
}

/** Looks the wanted names up one at a time. "stopped" means an error (or a
 * sync that never finished) ended the run early; the caller should not start
 * another one this visit. Each name is tried at most once per run. */
export async function runAvatarLookups(deps: AvatarLookupDeps): Promise<"done" | "stopped"> {
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const maxBusyWaitMs = deps.maxBusyWaitMs ?? 10 * 60 * 1000;
  const tried = new Set<string>();
  for (;;) {
    const name = deps.wanted().find((n) => !tried.has(avatarKey(n)));
    if (name === undefined) return "done";
    let waited = 0;
    while (deps.busy?.()) {
      if (waited >= maxBusyWaitMs) return "stopped";
      await wait(1000);
      waited += 1000;
    }
    tried.add(avatarKey(name));
    let url: string | null;
    try {
      url = await deps.fetchAvatar(name);
    } catch {
      return "stopped";
    }
    deps.store(name, url);
  }
}
