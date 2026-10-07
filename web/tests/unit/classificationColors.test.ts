import { describe, it, expect, beforeEach } from "vitest";
import {
  CLASSIFICATION_ORDER,
  getClassColor,
  getClassGlyph,
  isColorblindPalette,
  setColorblindPalette,
} from "../../src/classificationColors";

describe("classification colours", () => {
  beforeEach(() => {
    setColorblindPalette(false); // module-level state — reset between cases
  });

  it("covers the six quality tiers in order", () => {
    expect(CLASSIFICATION_ORDER).toEqual([
      "best",
      "excellent",
      "good",
      "inaccuracy",
      "mistake",
      "blunder",
    ]);
  });

  it("returns the default palette when colour-blind mode is off", () => {
    expect(getClassColor("best")).toBe("#4caf50");
    expect(getClassColor("blunder")).toBe("#e53935");
  });

  it("switches every tier to the blue->orange palette when enabled", () => {
    setColorblindPalette(true);
    expect(isColorblindPalette()).toBe(true);
    expect(getClassColor("best")).toBe("#1565c0");
    expect(getClassColor("blunder")).toBe("#b23a00");
  });

  it("does not throw on an unknown key", () => {
    expect(() => getClassColor("not-a-tier")).not.toThrow();
  });

  it("provides pixel glyphs for quality tiers", () => {
    expect(getClassGlyph("brilliant")).toBe("!!");
    expect(getClassGlyph("best")).toBe("!");
    expect(getClassGlyph("excellent")).toBe("✦");
    expect(getClassGlyph("good")).toBe("✓");
    expect(getClassGlyph("inaccuracy")).toBe("?!");
    expect(getClassGlyph("mistake")).toBe("?");
    expect(getClassGlyph("blunder")).toBe("??");
    expect(getClassGlyph("book")).toBe("📖");
    expect(getClassGlyph("unknown")).toBe("");
  });

  it("supports brilliant and book color classifications", () => {
    expect(getClassColor("brilliant")).toBe("#22d3ee");
    expect(getClassColor("book")).toBe("#a855f7");
  });
});
