import { describe, it, expect } from "vitest";
import { formatBytes, summarizeStorage, readStorageSummary } from "../../src/storageQuota";

describe("formatBytes", () => {
  it("scales to the largest sensible unit", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(12.4 * 1024 * 1024)).toBe("12.4 MB");
    expect(formatBytes(2.1 * 1024 ** 3)).toBe("2.1 GB");
  });

  it("drops the decimal once the number has three digits", () => {
    expect(formatBytes(250 * 1024 * 1024)).toBe("250 MB");
  });

  it("treats bad input as zero", () => {
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });
});

describe("summarizeStorage", () => {
  const MB = 1024 * 1024;

  it("reports usage, quota and a rounded percent", () => {
    const s = summarizeStorage({ usage: 10 * MB, quota: 1000 * MB });
    expect(s).toMatchObject({ percent: 1, level: "ok", text: "10.0 MB of 1000 MB used (1%)" });
  });

  it("raises the level at 80% and 95%", () => {
    expect(summarizeStorage({ usage: 79, quota: 100 })?.level).toBe("ok");
    expect(summarizeStorage({ usage: 80, quota: 100 })?.level).toBe("high");
    expect(summarizeStorage({ usage: 94, quota: 100 })?.level).toBe("high");
    expect(summarizeStorage({ usage: 95, quota: 100 })?.level).toBe("full");
  });

  it("caps the percent at 100 when usage passes the quota", () => {
    expect(summarizeStorage({ usage: 150, quota: 100 })?.percent).toBe(100);
  });

  it("says nothing when the browser gave no usable numbers", () => {
    expect(summarizeStorage(null)).toBeNull();
    expect(summarizeStorage({})).toBeNull();
    expect(summarizeStorage({ usage: 5 })).toBeNull();
    expect(summarizeStorage({ usage: 5, quota: 0 })).toBeNull();
    expect(summarizeStorage({ usage: -1, quota: 100 })).toBeNull();
  });
});

describe("readStorageSummary", () => {
  it("returns null when the storage API is missing (node has no navigator.storage)", async () => {
    expect(await readStorageSummary()).toBeNull();
  });
});
