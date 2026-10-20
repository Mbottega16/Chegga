import { describe, it, expect } from "vitest";
import {
  parseTimeControlBaseSeconds,
  clockSecondsFromComment,
  clocksByFen,
  parseTimeControlIncrementSeconds,
  timeSpentSeconds,
} from "../../src/clockParser";

describe("parseTimeControlIncrementSeconds", () => {
  it("reads the increment after the plus", () => {
    expect(parseTimeControlIncrementSeconds("180+2")).toBe(2);
    expect(parseTimeControlIncrementSeconds("600+10")).toBe(10);
  });

  it("is 0 when there is none, or the control is correspondence or unreadable", () => {
    expect(parseTimeControlIncrementSeconds("600")).toBe(0);
    expect(parseTimeControlIncrementSeconds("600+0")).toBe(0);
    expect(parseTimeControlIncrementSeconds("1/259200")).toBe(0);
    expect(parseTimeControlIncrementSeconds("")).toBe(0);
    expect(parseTimeControlIncrementSeconds("180+x")).toBe(0);
  });
});

describe("timeSpentSeconds", () => {
  it("is the clock drop when there is no increment", () => {
    expect(timeSpentSeconds(180, 177.5)).toBe(2.5);
  });

  it("adds back the increment the move earned", () => {
    expect(timeSpentSeconds(180, 181, 2)).toBe(1);
    expect(timeSpentSeconds(181, 181, 2)).toBe(2);
  });

  it("is undefined when the clock rose more than the increment allows", () => {
    expect(timeSpentSeconds(180, 181)).toBeUndefined();
    expect(timeSpentSeconds(180, 183, 2)).toBeUndefined();
  });

  it("is 0 for an instant move that earned its increment", () => {
    expect(timeSpentSeconds(180, 182, 2)).toBe(0);
  });
});

describe("parseTimeControlBaseSeconds", () => {
  it("returns the base for a plain second count", () => {
    expect(parseTimeControlBaseSeconds("600")).toBe(600);
  });

  it("ignores the increment", () => {
    expect(parseTimeControlBaseSeconds("180+2")).toBe(180);
  });

  it("returns undefined for correspondence/daily controls", () => {
    expect(parseTimeControlBaseSeconds("1/259200")).toBeUndefined();
  });

  it("returns undefined for empty or non-numeric input", () => {
    expect(parseTimeControlBaseSeconds("")).toBeUndefined();
    expect(parseTimeControlBaseSeconds("abc")).toBeUndefined();
  });
});

describe("clockSecondsFromComment", () => {
  it("parses H:MM:SS from a %clk annotation", () => {
    expect(clockSecondsFromComment("[%clk 0:03:00]")).toBe(180);
    expect(clockSecondsFromComment("[%clk 1:00:00]")).toBe(3600);
  });

  it("keeps fractional seconds", () => {
    expect(clockSecondsFromComment("[%clk 0:00:12.7]")).toBeCloseTo(12.7, 5);
  });

  it("returns undefined when there is no %clk", () => {
    expect(clockSecondsFromComment("a normal comment")).toBeUndefined();
  });
});

describe("clocksByFen", () => {
  it("maps each FEN to its remaining seconds and skips clock-less comments", () => {
    const map = clocksByFen([
      { fen: "fen-A", comment: "[%clk 0:05:00]" },
      { fen: "fen-B", comment: "no clock here" },
      { fen: "fen-C", comment: "[%clk 0:04:30]" },
    ]);
    expect(map.get("fen-A")).toBe(300);
    expect(map.has("fen-B")).toBe(false);
    expect(map.get("fen-C")).toBe(270);
  });
});
