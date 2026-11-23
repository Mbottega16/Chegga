// Chegga Web Service Worker (PWA, Offline Cache & Closed-App Background Game Sync)
const CACHE_NAME = "chegga-cache-v1";
const BG_SYNC_TAG = "chegga-background-sync";
const BG_SYNC_IDB_KEY = "__bg_sync_config__";
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Bypass external chess APIs
  if (url.hostname.includes("chess.com") || url.hostname.includes("lichess.org")) {
    return;
  }

  // Navigation requests: Network first, fall back to cached index.html
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html") || caches.match("/"))
    );
    return;
  }

  // Static assets: Cache first, then network with background cache update
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        return cached;
      });
    })
  );
});

// --- Closed-App & Background Game Sync (IndexedDB + Chess.com / Lichess API) ---

function openCheggaDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("chegga-web", 4);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readSyncConfigFromDb(db) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("syncState", "readonly");
      const req = tx.objectStore("syncState").get(BG_SYNC_IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function saveSyncConfigToDb(db, username, site) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("syncState", "readwrite");
      tx.objectStore("syncState").put({
        key: BG_SYNC_IDB_KEY,
        username,
        site,
        lastSyncedAt: Date.now(),
        status: "complete",
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function putGamesIfNew(db, records) {
  return new Promise((resolve) => {
    let added = 0;
    try {
      const tx = db.transaction("games", "readwrite");
      const store = tx.objectStore("games");
      for (const rec of records) {
        const getReq = store.get(rec.chessComUuid);
        getReq.onsuccess = () => {
          if (!getReq.result) {
            store.put(rec);
            added += 1;
          }
        };
      }
      tx.oncomplete = () => resolve(added);
      tx.onerror = () => resolve(added);
    } catch {
      resolve(0);
    }
  });
}

async function performBackgroundGameSync(overrideUser, overrideSite) {
  let db = null;
  try {
    db = await openCheggaDb();
    let username = overrideUser;
    let site = overrideSite;
    if (!username) {
      const cfg = await readSyncConfigFromDb(db);
      if (!cfg || !cfg.username) {
        db.close();
        return 0;
      }
      username = cfg.username;
      site = cfg.site || "chesscom";
    } else {
      await saveSyncConfigToDb(db, username, site || "chesscom");
    }

    const lcUser = String(username).trim().toLowerCase();
    const records = [];

    if (site === "lichess") {
      const res = await fetch(
        `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=20&pgnInJson=true&opening=true`,
        { headers: { Accept: "application/x-ndjson" } }
      );
      if (res.ok) {
        const text = await res.text();
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          try {
            const g = JSON.parse(line);
            if (!g || !g.id || !g.pgn) continue;
            const wName = (g.players?.white?.user?.name || g.players?.white?.user?.id || "White");
            const bName = (g.players?.black?.user?.name || g.players?.black?.user?.id || "Black");
            const isWhite = wName.toLowerCase() === lcUser;
            const userColor = isWhite ? "white" : "black";
            const userResult = !g.winner ? "draw" : g.winner === userColor ? "win" : "loss";
            records.push({
              chessComUuid: `lichess:${g.id}`,
              username: lcUser,
              url: `https://lichess.org/${g.id}`,
              pgn: g.pgn,
              timeControl: g.clock ? `${g.clock.initial}+${g.clock.increment}` : "",
              timeClass: g.speed || "rapid",
              rules: g.variant === "standard" ? "chess" : (g.variant || "chess"),
              rated: Boolean(g.rated),
              endTime: Math.floor((g.lastMoveAt || g.createdAt || Date.now()) / 1000),
              openingName: g.opening?.name,
              whiteUsername: wName,
              whiteRating: g.players?.white?.rating || 0,
              blackUsername: bName,
              blackRating: g.players?.black?.rating || 0,
              whiteResult: g.winner === "white" ? "win" : g.winner === "black" ? "resigned" : "agreed",
              blackResult: g.winner === "black" ? "win" : g.winner === "white" ? "resigned" : "agreed",
              userColor,
              userResult,
              analyzed: false,
            });
          } catch {
            // skip malformed row
          }
        }
      }
    } else {
      const archRes = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(lcUser)}/games/archives`);
      if (archRes.ok) {
        const archData = await archRes.json();
        const archives = Array.isArray(archData?.archives) ? archData.archives : [];
        const latestArchive = archives[archives.length - 1];
        if (latestArchive) {
          const monthRes = await fetch(latestArchive);
          if (monthRes.ok) {
            const monthData = await monthRes.json();
            const games = Array.isArray(monthData?.games) ? monthData.games.slice(-25) : [];
            for (const g of games) {
              if (!g || !g.uuid || !g.pgn) continue;
              const isWhite = (g.white?.username || "").toLowerCase() === lcUser;
              const userColor = isWhite ? "white" : "black";
              const rawRes = isWhite ? g.white?.result : g.black?.result;
              const userResult = rawRes === "win" ? "win" : ["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"].includes(rawRes) ? "draw" : "loss";
              records.push({
                chessComUuid: g.uuid,
                username: lcUser,
                url: g.url || "",
                pgn: g.pgn,
                timeControl: g.time_control || "",
                timeClass: g.time_class || "rapid",
                rules: g.rules || "chess",
                rated: Boolean(g.rated),
                endTime: g.end_time || 0,
                whiteUsername: g.white?.username || "White",
                whiteRating: g.white?.rating || 0,
                blackUsername: g.black?.username || "Black",
                blackRating: g.black?.rating || 0,
                whiteResult: g.white?.result || "",
                blackResult: g.black?.result || "",
                userColor,
                userResult,
                analyzed: false,
              });
            }
          }
        }
      }
    }

    const gamesAdded = records.length ? await putGamesIfNew(db, records) : 0;
    db.close();
    db = null;

    if (gamesAdded > 0) {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: "CHEGGA_BG_SYNC_DONE", gamesAdded });
      }
    }
    return gamesAdded;
  } catch {
    if (db) db.close();
    return 0;
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === BG_SYNC_TAG) {
    event.waitUntil(performBackgroundGameSync());
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === BG_SYNC_TAG) {
    event.waitUntil(performBackgroundGameSync());
  }
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "CHEGGA_BG_SYNC_CONFIG" && data.username) {
    event.waitUntil(
      openCheggaDb()
        .then((db) => saveSyncConfigToDb(db, data.username, data.site || "chesscom").then(() => db.close()))
        .catch(() => undefined)
    );
  } else if (data.type === "CHEGGA_TRIGGER_BG_SYNC") {
    event.waitUntil(performBackgroundGameSync(data.username, data.site));
  }
});
