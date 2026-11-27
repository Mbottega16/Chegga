import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  LAB_GROUPS,
  LAB_TOOLS,
  hashWithOpen,
  labToolByCard,
  labToolById,
  needsLine,
  needsMessage,
  openFromHash,
} from "../../src/labTools";

// The Studio Lab's tool list must agree with the cards main.ts actually
// renders: same ids, same headings, every card marked as a lab tool.
const mainTs = readFileSync(resolve(__dirname, "../../src/main.ts"), "utf8");

function cardMarkup(cardId: string): string | undefined {
  const start = mainTs.indexOf(`id="${cardId}"`);
  if (start < 0) return undefined;
  const open = mainTs.lastIndexOf("<section", start);
  const end = mainTs.indexOf("</section>", start);
  return mainTs.slice(open, end);
}

const unescape = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'");

describe("LAB_TOOLS", () => {
  it("has 19 tools with unique ids and unique cards", () => {
    expect(LAB_TOOLS).toHaveLength(19);
    expect(new Set(LAB_TOOLS.map((t) => t.id)).size).toBe(LAB_TOOLS.length);
    expect(new Set(LAB_TOOLS.map((t) => t.cardId)).size).toBe(LAB_TOOLS.length);
  });

  it("puts every tool in a known group, and every group has tools", () => {
    const groups = new Set(LAB_GROUPS.map((g) => g.id));
    for (const t of LAB_TOOLS) expect(groups.has(t.group), t.id).toBe(true);
    for (const g of LAB_GROUPS) expect(LAB_TOOLS.some((t) => t.group === g.id), g.id).toBe(true);
  });

  it("names each tool with the exact heading of the card it opens", () => {
    for (const t of LAB_TOOLS) {
      const markup = cardMarkup(t.cardId);
      expect(markup, `no card #${t.cardId} in main.ts`).toBeDefined();
      const heading = /<h2>([^<]*)<\/h2>/.exec(markup!)?.[1];
      expect(unescape(heading ?? ""), t.cardId).toBe(t.name);
    }
  });

  it("marks each tool's card as that tool, and never collapsible", () => {
    for (const t of LAB_TOOLS) {
      const markup = cardMarkup(t.cardId)!;
      expect(markup, t.cardId).toContain(`data-lab-tool="${t.id}"`);
      expect(markup, t.cardId).toContain(`data-non-collapsible="true"`);
      expect(markup, t.cardId).not.toContain("data-coming-soon");
    }
  });

  it("looks tools up by id and by card", () => {
    expect(labToolById("motifs")?.cardId).toBe("motifs-section");
    expect(labToolByCard("depth-section")?.name).toBe("Move-by-move heatmap");
    expect(labToolById("nope")).toBeUndefined();
  });
});

describe("hashWithOpen / openFromHash", () => {
  it("adds the open tool and keeps the username and site", () => {
    expect(hashWithOpen("#u=bob&s=lichess", "dna-section")).toBe("#u=bob&s=lichess&open=dna-section");
  });

  it("replaces an open tool, and removes it", () => {
    expect(hashWithOpen("#u=bob&open=dna-section", "time-section")).toBe("#u=bob&open=time-section");
    expect(hashWithOpen("#u=bob&open=dna-section")).toBe("#u=bob");
    expect(hashWithOpen("#open=dna-section")).toBe("");
  });

  it("drops a plain section anchor", () => {
    expect(hashWithOpen("#lab-section", "rivals-section")).toBe("#open=rivals-section");
    expect(hashWithOpen("", "rivals-section")).toBe("#open=rivals-section");
  });

  it("reads the open tool back, and nothing from an anchor", () => {
    expect(openFromHash("#u=bob&open=rivals-section")).toBe("rivals-section");
    expect(openFromHash("#rivals-section")).toBeUndefined();
    expect(openFromHash("")).toBeUndefined();
  });
});

describe("what a tool still needs", () => {
  const motifs = labToolById("motifs")!;
  const rivals = labToolById("rivals")!;

  it("says 'Needs your games' before anything is synced", () => {
    expect(needsLine("analyzed", { synced: 0, analyzed: 0 })).toBe("Needs your games");
    expect(needsLine("synced", { synced: 0, analyzed: 0 })).toBe("Needs your games");
  });

  it("asks for analysis once games are synced", () => {
    expect(needsLine("analyzed", { synced: 40, analyzed: 0 })).toBe("Needs analyzed games");
    expect(needsMessage(motifs, { synced: 40, analyzed: 0 }).actions).toEqual(["analyze", "games"]);
  });

  it("offers the account form and the sample games to a new visitor", () => {
    const msg = needsMessage(motifs, { synced: 0, analyzed: 0 });
    expect(msg.actions).toEqual(["connect", "demo"]);
    expect(msg.text).toContain("sample games");
  });

  it("says there is not enough data when a tool has data but nothing to show", () => {
    expect(needsLine("synced", { synced: 3, analyzed: 0 })).toBe("Not enough games yet");
    expect(needsMessage(rivals, { synced: 3, analyzed: 0 }).text).toContain("not enough data");
  });
});
