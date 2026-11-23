// Chegga Web — background & while-playing game sync orchestration.
//
// Lets the user sync their Chess.com or Lichess games:
//   1. While actively playing a bot game or reviewing a game on the board
//      (non-blocking background fetch + incremental engine analysis).
//   2. Automatically on a periodic timer while the app is open, when
//      returning to the tab (visibilitychange), or when coming back online.
//   3. While the app is closed or backgrounded, via Service Worker
//      Background Sync / Periodic Background Sync + IndexedDB config handoff.

import { openDb } from "./db";
import type { Site } from "./siteSync";

export const BG_SYNC_STORAGE_KEY = "chegga-web:bg-sync-config";
export const BG_SYNC_IDB_KEY = "__bg_sync_config__";
export const BG_SYNC_TAG = "chegga-background-sync";

// Check for new games every 3 minutes while the app is open (or when playing).
const LIVE_POLL_INTERVAL_MS = 3 * 60 * 1000;
// Minimum gap between automatic background syncs triggered by visibility/focus.
const MIN_AUTO_SYNC_GAP_MS = 45 * 1000;

export interface BgSyncConfig {
  username: string;
  site: Site;
  enabled: boolean;
  lastSyncAt: number;
}

export function readBgSyncConfig(): BgSyncConfig | null {
  try {
    const raw = localStorage.getItem(BG_SYNC_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BgSyncConfig;
    if (!parsed || typeof parsed.username !== "string" || !parsed.username.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveBgSyncConfig(username: string, site: Site): Promise<void> {
  const clean = username.trim();
  if (!clean) return;
  const cfg: BgSyncConfig = {
    username: clean,
    site,
    enabled: true,
    lastSyncAt: Date.now(),
  };
  try {
    localStorage.setItem(BG_SYNC_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // localStorage may be blocked in private mode
  }

  // Persist into IndexedDB's syncState store so the Service Worker can read
  // the user's username and site even when all app tabs are closed.
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction("syncState", "readwrite");
      tx.objectStore("syncState").put({
        key: BG_SYNC_IDB_KEY,
        username: clean,
        site,
        lastSyncedAt: Date.now(),
        status: "complete",
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // best-effort IndexedDB config save
  }

  void registerServiceWorkerBgSync(cfg);
}

async function registerServiceWorkerBgSync(cfg: BgSyncConfig): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({
      type: "CHEGGA_BG_SYNC_CONFIG",
      username: cfg.username,
      site: cfg.site,
    });

    const anyReg = reg as unknown as {
      sync?: { register(tag: string): Promise<void> };
      periodicSync?: { register(tag: string, opts: { minInterval: number }): Promise<void> };
    };
    if (anyReg.sync) {
      await anyReg.sync.register(BG_SYNC_TAG).catch(() => undefined);
    }
    if (anyReg.periodicSync) {
      await anyReg.periodicSync
        .register(BG_SYNC_TAG, { minInterval: 15 * 60 * 1000 })
        .catch(() => undefined);
    }
  } catch {
    // Service worker not active in dev/test
  }
}

export function requestClosingBgSync(): void {
  const cfg = readBgSyncConfig();
  if (!cfg || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    navigator.serviceWorker.controller?.postMessage({
      type: "CHEGGA_TRIGGER_BG_SYNC",
      username: cfg.username,
      site: cfg.site,
    });
    void navigator.serviceWorker.ready
      .then((reg) => {
        const anyReg = reg as unknown as { sync?: { register(tag: string): Promise<void> } };
        return anyReg.sync?.register(BG_SYNC_TAG);
      })
      .catch(() => undefined);
  } catch {
    // best-effort on tab close
  }
}

export interface BackgroundSyncControllerOptions {
  getCredentials: () => { username: string; site: Site } | null;
  isSyncBusy: () => boolean;
  runSilentSync: (username: string, site: Site) => Promise<void>;
  onSwSyncCompleted: () => Promise<void>;
}

/**
 * Installs background sync hooks:
 * - Periodic non-blocking sync while the user is playing or has the app open
 * - Instant catch-up when returning to the app or reconnecting to the network
 * - Service Worker handoff when the tab is hidden or closed
 */
export function setupBackgroundSync(opts: BackgroundSyncControllerOptions): void {
  let lastAutoAttempt = Date.now();

  const maybeRunAutoSync = () => {
    if (opts.isSyncBusy()) return;
    const now = Date.now();
    if (now - lastAutoAttempt < MIN_AUTO_SYNC_GAP_MS) return;
    const creds = opts.getCredentials() ?? readBgSyncConfig();
    if (!creds || !creds.username) return;
    lastAutoAttempt = now;
    void opts.runSilentSync(creds.username, creds.site);
  };

  window.setInterval(() => {
    if (document.visibilityState === "visible") {
      maybeRunAutoSync();
    } else {
      requestClosingBgSync();
    }
  }, LIVE_POLL_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      requestClosingBgSync();
    } else if (document.visibilityState === "visible") {
      maybeRunAutoSync();
    }
  });

  window.addEventListener("pagehide", () => {
    requestClosingBgSync();
  });

  window.addEventListener("online", () => {
    maybeRunAutoSync();
  });

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      const data = event.data as { type?: string; gamesAdded?: number } | null;
      if (data?.type === "CHEGGA_BG_SYNC_DONE" && (data.gamesAdded ?? 0) > 0) {
        void opts.onSwSyncCompleted();
      }
    });
  }
}
