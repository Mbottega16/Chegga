// Playtest-only seed: loads the owner's games so the playtest build opens
// already synced and reviewable (no re-syncing on every playtest).
//
// `__PLAYTEST__` is a build-time constant (see vite.config.ts), so the default
// build — the one the main site ships — compiles this to a no-op and never
// includes the data file.
//
// The data file is web/playtest/games-backup.json.gz (gitignored). Rebuild it
// with: node scripts/fetch-playtest-games.mjs <chess.com username>

import { importAllData, openDb, type ExportedData } from "./db";
import { TUTORIAL_KEY } from "./firstRun";

declare const __PLAYTEST__: boolean;

/** Some servers send a .gz file with Content-Encoding: gzip (the browser then
 * unzips it), others send the raw bytes, so check for the gzip magic number. */
async function readBackup(url: string): Promise<ExportedData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load the playtest games (${res.status}).`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(bytes));
  const unzipped = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return (await new Response(unzipped).json()) as ExportedData;
}

function storedGameIds(db: IDBDatabase): Promise<Set<IDBValidKey>> {
  return new Promise((resolve, reject) => {
    const req = db.transaction("games").objectStore("games").getAllKeys();
    req.onsuccess = () => resolve(new Set(req.result));
    req.onerror = () => reject(req.error);
  });
}

const SEEDED_KEY = "chegga-web:playtest-seed";

/** Imports the playtest games this browser doesn't hold yet. Games already
 * stored are left alone, so their analysis is never overwritten. Resolves true
 * when it imported something, so the caller can reload and show it. */
export async function seedPlaytestData(): Promise<boolean> {
  if (!__PLAYTEST__) return false;
  const files = import.meta.glob<string>("../playtest/games-backup.json.gz", { query: "?url", import: "default" });
  const load = Object.values(files)[0];
  if (!load) return false;
  const url = await load();
  // The asset URL carries a content hash, so a visit with nothing new skips the download.
  if (localStorage.getItem(SEEDED_KEY) === url) return false;

  const data = await readBackup(url);
  const db = await openDb();
  const stored = await storedGameIds(db);
  const games = data.games.filter((g) => !stored.has(g.chessComUuid));
  if (games.length) {
    await importAllData(db, { ...data, games, syncState: stored.size ? [] : data.syncState });
  }
  db.close();

  // The app only shows games for a remembered username, so set it.
  localStorage.setItem("chegga-web:last-username", data.syncState[0].username);
  localStorage.setItem("chegga-web:last-site", "chesscom");
  localStorage.setItem(TUTORIAL_KEY, "done");
  localStorage.setItem(SEEDED_KEY, url);
  return games.length > 0;
}
