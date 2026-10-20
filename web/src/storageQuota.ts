// Chegga Web — how full is this browser's storage for this site?
//
// Everything Chegga keeps lives in the visitor's own browser, and browsers
// cap that space. `navigator.storage.estimate()` reports usage and quota for
// the whole site (IndexedDB, caches and the service worker together), so this
// is an honest "site storage" figure, not a count of games. It is read-only:
// nothing here deletes anything.

export interface StorageEstimateLike {
  usage?: number;
  quota?: number;
}

export type StorageLevel = "ok" | "high" | "full";

export interface StorageSummary {
  usedBytes: number;
  quotaBytes: number;
  percent: number; // 0-100, whole number
  level: StorageLevel;
  text: string; // "12.4 MB of 2.1 GB used (1%)"
}

export const HIGH_PERCENT = 80;
export const FULL_PERCENT = 95;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

/** Turns a browser estimate into text and a level. Returns null when the
 * browser gave no usable quota (nothing honest can be said then). */
export function summarizeStorage(estimate: StorageEstimateLike | null | undefined): StorageSummary | null {
  const usedBytes = estimate?.usage;
  const quotaBytes = estimate?.quota;
  if (usedBytes === undefined || quotaBytes === undefined) return null;
  if (!Number.isFinite(usedBytes) || !Number.isFinite(quotaBytes) || quotaBytes <= 0 || usedBytes < 0) return null;
  const percent = Math.min(100, Math.round((usedBytes / quotaBytes) * 100));
  const level: StorageLevel = percent >= FULL_PERCENT ? "full" : percent >= HIGH_PERCENT ? "high" : "ok";
  return {
    usedBytes,
    quotaBytes,
    percent,
    level,
    text: `${formatBytes(usedBytes)} of ${formatBytes(quotaBytes)} used (${percent}%)`,
  };
}

/** Asks the browser. Resolves to null when the API is missing or throws. */
export async function readStorageSummary(): Promise<StorageSummary | null> {
  try {
    const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
    if (!storage || typeof storage.estimate !== "function") return null;
    return summarizeStorage(await storage.estimate());
  } catch {
    return null;
  }
}
