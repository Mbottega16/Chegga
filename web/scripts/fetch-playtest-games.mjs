// Builds the playtest seed from Chess.com's public API.
//   node scripts/fetch-playtest-games.mjs <chess.com username>
// Writes playtest/games-backup.json.gz (gitignored) in exportAllData's shape, using
// the app's own normalizeGame, so the records match what a real sync stores.
// Serial requests only, same as the app's client.
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { normalizeGame } from "../src/gameNormalizer.ts";

const username = process.argv[2];
if (!username) throw new Error("Usage: node scripts/fetch-playtest-games.mjs <username>");

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "chegga-playtest-seed" } });
    if (res.ok) return res.json();
    if (res.status === 404) return {};
    if (attempt >= 5) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
  }
}

const { archives = [] } = await get(
  `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`,
);
const now = new Date().toISOString().slice(0, 7);
const games = new Map();
const syncState = [];
let skipped = 0;
for (const url of archives) {
  const [year, month] = url.split("/").slice(-2);
  const yearMonth = `${year}-${month}`;
  const { games: raw = [] } = await get(url);
  let added = 0;
  for (const g of raw) {
    if (!g.uuid || games.has(g.uuid)) continue;
    try {
      games.set(g.uuid, normalizeGame(g, username, username));
      added++;
    } catch {
      skipped++;
    }
  }
  syncState.push({
    username,
    yearMonth,
    status: yearMonth === now ? "partial" : "complete",
    gamesFetched: added,
    lastSyncedAt: Date.now(),
  });
}
if (games.size === 0) throw new Error("No games found; nothing written.");
const dir = new URL("../playtest/", import.meta.url);
mkdirSync(dir, { recursive: true });
const data = {
  formatVersion: 4,
  exportedAt: Date.now(),
  games: [...games.values()],
  moveAnalysis: [],
  syncState,
};
writeFileSync(new URL("games-backup.json.gz", dir), gzipSync(JSON.stringify(data)));
console.log(`months=${archives.length} games=${games.size} skipped=${skipped}`);
