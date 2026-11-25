// Playtest-only seed: loads the owner's exported games so a local playtest
// build opens already synced and reviewable (no re-uploading every time).
//
// Only the `npm run dev:playtest` build can do this. `__PLAYTEST__` is a
// build-time constant (see vite.config.ts), so the default build — the one
// the public site ships — compiles this to a no-op and never bundles the
// seed file.
//
// The seed file lives at web/playtest/*.json and is gitignored. Make it with
// Settings → Export in the app, in the browser where the account is synced,
// then save the file into web/playtest/.

import { importAllData, openDb, type ExportedData } from "./db";

declare const __PLAYTEST__: boolean;

function countStore(db: IDBDatabase, store: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Imports the first playtest backup if this browser doesn't already hold its
 * games. Resolves true when it imported something, so the caller can reload
 * and let the pickers see the new data. */
export async function seedPlaytestData(): Promise<boolean> {
  if (!__PLAYTEST__) return false;
  const loaders = import.meta.glob<ExportedData>("../playtest/*.json", { import: "default" });
  const paths = Object.keys(loaders).sort();
  if (paths.length === 0) return false;
  const data = (await loaders[paths[0]]()) as ExportedData;
  const db = await openDb();
  if ((await countStore(db, "games")) >= data.games.length) return false;
  await importAllData(db, data);
  return true;
}
