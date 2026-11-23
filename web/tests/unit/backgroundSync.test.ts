import { describe, it, expect, beforeEach } from "vitest";
import { BG_SYNC_STORAGE_KEY, readBgSyncConfig, saveBgSyncConfig } from "../../src/backgroundSync";

describe("backgroundSync — config persistence for while-playing & closed-app sync", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    };
  });

  it("returns null when no background sync account is stored", () => {
    expect(readBgSyncConfig()).toBeNull();
  });

  it("persists and trims the connected username and site for background sync", async () => {
    await saveBgSyncConfig("  MichaelBottega  ", "chesscom");
    const cfg = readBgSyncConfig();
    expect(cfg).not.toBeNull();
    expect(cfg?.username).toBe("MichaelBottega");
    expect(cfg?.site).toBe("chesscom");
    expect(cfg?.enabled).toBe(true);
    expect(typeof cfg?.lastSyncAt).toBe("number");
  });

  it("ignores empty usernames", async () => {
    await saveBgSyncConfig("   ", "lichess");
    expect(localStorage.getItem(BG_SYNC_STORAGE_KEY)).toBeNull();
    expect(readBgSyncConfig()).toBeNull();
  });
});
