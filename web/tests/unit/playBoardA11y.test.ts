import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlayBoard } from "../../src/playBoard";
import type { Square } from "chess.js";

/** Lightweight Mock DOM node for testing PlayBoard in Node environment */
class MockNode {
  tagName: string;
  className = "";
  attributes: Record<string, string> = {};
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  tabIndex = -1;
  textContent = "";
  parentElement: MockNode | null = null;
  children: MockNode[] = [];
  listeners: Record<string, ((e: any) => void)[]> = {};

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  get classList() {
    return {
      add: (cls: string) => {
        const parts = this.className.split(/\s+/).filter(Boolean);
        if (!parts.includes(cls)) parts.push(cls);
        this.className = parts.join(" ");
      },
      remove: (cls: string) => {
        const parts = this.className.split(/\s+/).filter((c) => c !== cls);
        this.className = parts.join(" ");
      },
      contains: (cls: string) => {
        return this.className.split(/\s+/).includes(cls);
      },
    };
  }

  getAttribute(name: string): string | null {
    if (name === "class") return this.className;
    if (name === "tabindex") return String(this.tabIndex);
    return this.attributes[name] ?? null;
  }

  setAttribute(name: string, value: string): void {
    if (name === "class") this.className = value;
    else if (name === "tabindex") this.tabIndex = parseInt(value, 10);
    else this.attributes[name] = value;
  }

  addEventListener(event: string, fn: (e: any) => void): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  removeEventListener(event: string, fn: (e: any) => void): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((f) => f !== fn);
  }

  dispatchEvent(event: any): boolean {
    event.target = this;
    let curr: MockNode | null = this;
    while (curr) {
      const handlers = curr.listeners[event.type] || [];
      for (const handler of handlers) {
        handler(event);
        if (event._stopped) return !event.defaultPrevented;
      }
      curr = curr.parentElement;
    }
    return !event.defaultPrevented;
  }

  closest(selector: string): MockNode | null {
    let curr: MockNode | null = this;
    while (curr) {
      if (matchesSelector(curr, selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  querySelector(selector: string): MockNode | null {
    return querySelectorInternal(this, selector);
  }

  querySelectorAll(selector: string): MockNode[] {
    const results: MockNode[] = [];
    querySelectorAllInternal(this, selector, results);
    return results;
  }

  focus(): void {
    (globalThis as any).document.activeElement = this;
    this.dispatchEvent({ type: "focusin", bubbles: true });
  }
}

function matchesSelector(node: MockNode, sel: string): boolean {
  if (sel === ".play-board") return node.classList.contains("play-board");
  if (sel === ".play-row") return node.classList.contains("play-row");
  if (sel === ".play-square") return node.classList.contains("play-square");
  if (sel === ".play-promo-overlay") return node.classList.contains("play-promo-overlay");
  if (sel === ".play-promo-btn") return node.classList.contains("play-promo-btn");
  if (sel === ".play-board-live") return node.classList.contains("play-board-live");
  if (sel === '[tabindex="0"]') return node.tabIndex === 0;
  if (sel === '[tabindex="-1"]') return node.tabIndex === -1;
  if (sel === '.play-square[tabindex="0"]') return node.classList.contains("play-square") && node.tabIndex === 0;
  if (sel === '.play-square[tabindex="-1"]') return node.classList.contains("play-square") && node.tabIndex === -1;
  if (sel.startsWith('[data-square="') && sel.endsWith('"]')) {
    const sq = sel.slice(14, -2);
    return node.dataset.square === sq;
  }
  if (sel === "[data-square]") return "square" in node.dataset;
  if (sel.startsWith('[data-promo="') && sel.endsWith('"]')) {
    const p = sel.slice(13, -2);
    return node.dataset.promo === p;
  }
  if (sel === "[data-promo]") return "promo" in node.dataset;
  return false;
}

function querySelectorInternal(root: MockNode, sel: string): MockNode | null {
  for (const child of root.children) {
    if (matchesSelector(child, sel)) return child;
    const found = querySelectorInternal(child, sel);
    if (found) return found;
  }
  return null;
}

function querySelectorAllInternal(root: MockNode, sel: string, results: MockNode[]): void {
  for (const child of root.children) {
    if (matchesSelector(child, sel)) results.push(child);
    querySelectorAllInternal(child, sel, results);
  }
}

/** Simple HTML string parser into MockNode tree for testing */
function parseHtmlToTree(html: string, parent: MockNode): void {
  parent.children = [];
  const tagRegex = /<([a-zA-Z0-9]+)([^>]*?)>(?:([\s\S]*?)<\/\1>|)/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(html)) !== null) {
    const tagName = match[1];
    const attrsStr = match[2];
    const innerHtml = match[3] ?? "";

    const node = new MockNode(tagName);
    node.parentElement = parent;

    // Parse attributes
    const attrRegex = /([a-zA-Z0-9_-]+)(?:="([^"]*)")?/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
      const attrName = attrMatch[1];
      const attrVal = attrMatch[2] ?? "";
      if (attrName === "class") {
        node.className = attrVal;
      } else if (attrName === "tabindex") {
        node.tabIndex = parseInt(attrVal, 10);
      } else if (attrName.startsWith("data-")) {
        const key = attrName.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        node.dataset[key] = attrVal;
      } else {
        node.attributes[attrName] = attrVal;
      }
    }

    if (innerHtml && innerHtml.includes("<")) {
      parseHtmlToTree(innerHtml, node);
    } else if (innerHtml) {
      node.textContent = innerHtml.trim();
    }

    parent.children.push(node);
  }
}

class MockContainer extends MockNode {
  private _html = "";

  constructor() {
    super("DIV");
  }

  get innerHTML(): string {
    return this._html;
  }

  set innerHTML(val: string) {
    this._html = val;
    parseHtmlToTree(val, this);
  }

  contains(node: MockNode | null): boolean {
    let curr = node;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentElement;
    }
    return false;
  }
}

function createKeyboardEvent(key: string): any {
  let prevented = false;
  let stopped = false;
  return {
    type: "keydown",
    key,
    preventDefault: () => {
      prevented = true;
    },
    stopPropagation: () => {
      stopped = true;
    },
    get defaultPrevented() {
      return prevented;
    },
    get _stopped() {
      return stopped;
    },
  };
}

describe("PlayBoard WCAG 2.1 AA Accessibility Pass", () => {
  let container: MockContainer;
  let onPlayerMove: (uci: string, san: string) => void;
  let board: PlayBoard;

  beforeEach(() => {
    container = new MockContainer();
    (globalThis as any).document = {
      activeElement: null,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    (globalThis as any).window = {
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    onPlayerMove = vi.fn();
    board = new PlayBoard(container as any, onPlayerMove);
  });

  describe("ARIA Grid Structure", () => {
    it("renders the chessboard as role='grid' with accessible label and dimensions", () => {
      const grid = container.querySelector(".play-board");
      expect(grid).not.toBeNull();
      expect(grid!.getAttribute("role")).toBe("grid");
      expect(grid!.getAttribute("aria-label")).toBe("Chessboard");
      expect(grid!.getAttribute("aria-rowcount")).toBe("8");
      expect(grid!.getAttribute("aria-colcount")).toBe("8");
    });

    it("renders exactly 8 rows with role='row' and class='play-row'", () => {
      const rows = container.querySelectorAll(".play-row");
      expect(rows).toHaveLength(8);
      for (const row of rows) {
        expect(row.getAttribute("role")).toBe("row");
      }
    });

    it("renders exactly 64 squares with role='gridcell'", () => {
      const cells = container.querySelectorAll(".play-square");
      expect(cells).toHaveLength(64);
      for (const cell of cells) {
        expect(cell.getAttribute("role")).toBe("gridcell");
      }
    });
  });

  describe("Board Square ARIA Labels and Row/Col Coordinates", () => {
    it("assigns row/col coordinates to every square via data attributes and ARIA indices", () => {
      const squares = container.querySelectorAll(".play-square");
      expect(squares).toHaveLength(64);

      for (const sq of squares) {
        const squareName = sq.dataset.square;
        expect(squareName).toBeDefined();
        expect(squareName).toMatch(/^[a-h][1-8]$/);

        expect(sq.dataset.col).toBe(squareName![0]);
        expect(sq.dataset.row).toBe(squareName![1]);

        const rowIndex = parseInt(sq.getAttribute("aria-rowindex") ?? "0", 10);
        const colIndex = parseInt(sq.getAttribute("aria-colindex") ?? "0", 10);
        expect(rowIndex).toBeGreaterThanOrEqual(1);
        expect(rowIndex).toBeLessThanOrEqual(8);
        expect(colIndex).toBeGreaterThanOrEqual(1);
        expect(colIndex).toBeLessThanOrEqual(8);

        const ariaLabel = sq.getAttribute("aria-label");
        expect(ariaLabel).toBeDefined();
        expect(ariaLabel).toContain(squareName!);
      }
    });

    it("includes piece color and piece type in aria-label for occupied squares", () => {
      // White pieces in starting position
      expect(container.querySelector('[data-square="e2"]')!.getAttribute("aria-label")).toBe("e2: white pawn");
      expect(container.querySelector('[data-square="e1"]')!.getAttribute("aria-label")).toBe("e1: white king");
      expect(container.querySelector('[data-square="d1"]')!.getAttribute("aria-label")).toBe("d1: white queen");
      expect(container.querySelector('[data-square="a1"]')!.getAttribute("aria-label")).toBe("a1: white rook");
      expect(container.querySelector('[data-square="b1"]')!.getAttribute("aria-label")).toBe("b1: white knight");
      expect(container.querySelector('[data-square="c1"]')!.getAttribute("aria-label")).toBe("c1: white bishop");

      // Black pieces in starting position
      expect(container.querySelector('[data-square="e7"]')!.getAttribute("aria-label")).toBe("e7: black pawn");
      expect(container.querySelector('[data-square="e8"]')!.getAttribute("aria-label")).toBe("e8: black king");
      expect(container.querySelector('[data-square="d8"]')!.getAttribute("aria-label")).toBe("d8: black queen");
    });

    it("uses clean coordinate for empty squares", () => {
      expect(container.querySelector('[data-square="e4"]')!.getAttribute("aria-label")).toBe("e4");
      expect(container.querySelector('[data-square="d5"]')!.getAttribute("aria-label")).toBe("d5");
      expect(container.querySelector('[data-square="c3"]')!.getAttribute("aria-label")).toBe("c3");
    });

    it("announces selected state in aria-label and aria-selected", () => {
      const e2 = container.querySelector('[data-square="e2"]')!;
      e2.dispatchEvent(createKeyboardEvent("Enter"));

      const updatedE2 = container.querySelector('[data-square="e2"]')!;
      expect(updatedE2.getAttribute("aria-selected")).toBe("true");
      expect(updatedE2.getAttribute("aria-label")).toContain("selected");
    });

    it("announces legal move and capture destinations in aria-label when piece is selected", () => {
      const e2 = container.querySelector('[data-square="e2"]')!;
      e2.dispatchEvent(createKeyboardEvent("Enter"));

      // e3 and e4 are legal moves for White's pawn
      const e3 = container.querySelector('[data-square="e3"]')!;
      const e4 = container.querySelector('[data-square="e4"]')!;
      expect(e3.getAttribute("aria-label")).toBe("e3, legal move");
      expect(e4.getAttribute("aria-label")).toBe("e4, legal move");
    });
  });

  describe("Roving Tabindex and Focus Management", () => {
    it("initializes with exactly one square having tabindex='0' and 63 with tabindex='-1'", () => {
      const tabZero = container.querySelectorAll('.play-square[tabindex="0"]');
      const tabMinusOne = container.querySelectorAll('.play-square[tabindex="-1"]');
      expect(tabZero).toHaveLength(1);
      expect(tabMinusOne).toHaveLength(63);
      expect(tabZero[0].dataset.square).toBe("e2");
    });

    it("defaults initial focus to e7 when orientation is black", () => {
      board.reset("black");
      const tabZero = container.querySelectorAll('.play-square[tabindex="0"]');
      expect(tabZero).toHaveLength(1);
      expect(tabZero[0].dataset.square).toBe("e7");
    });
  });

  describe("Keyboard Arrow Navigation (White Orientation)", () => {
    it("navigates ArrowUp to the rank above", () => {
      const e2 = container.querySelector('[data-square="e2"]')!;
      e2.focus();
      const event = createKeyboardEvent("ArrowUp");
      e2.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      const e3 = container.querySelector('[data-square="e3"]')!;
      expect(e3.tabIndex).toBe(0);
      expect(container.querySelector('[data-square="e2"]')!.tabIndex).toBe(-1);
    });

    it("navigates ArrowDown to the rank below", () => {
      const e2 = container.querySelector('[data-square="e2"]')!;
      e2.focus();
      e2.dispatchEvent(createKeyboardEvent("ArrowDown"));

      const e1 = container.querySelector('[data-square="e1"]')!;
      expect(e1.tabIndex).toBe(0);
    });

    it("navigates ArrowLeft to the file on the left", () => {
      const e2 = container.querySelector('[data-square="e2"]')!;
      e2.focus();
      e2.dispatchEvent(createKeyboardEvent("ArrowLeft"));

      const d2 = container.querySelector('[data-square="d2"]')!;
      expect(d2.tabIndex).toBe(0);
    });

    it("navigates ArrowRight to the file on the right", () => {
      const e2 = container.querySelector('[data-square="e2"]')!;
      e2.focus();
      e2.dispatchEvent(createKeyboardEvent("ArrowRight"));

      const f2 = container.querySelector('[data-square="f2"]')!;
      expect(f2.tabIndex).toBe(0);
    });

    it("clamps at board boundaries and does not navigate off board", () => {
      // Start at e2, navigate down to e1
      const e2 = container.querySelector('[data-square="e2"]')!;
      e2.dispatchEvent(createKeyboardEvent("ArrowDown"));
      expect(container.querySelector('[data-square="e1"]')!.tabIndex).toBe(0);

      // Moving down on rank 1 clamps at rank 1
      const e1 = container.querySelector('[data-square="e1"]')!;
      e1.dispatchEvent(createKeyboardEvent("ArrowDown"));
      expect(container.querySelector('[data-square="e1"]')!.tabIndex).toBe(0);

      // Home moves to a1
      e1.dispatchEvent(createKeyboardEvent("Home"));
      const a1 = container.querySelector('[data-square="a1"]')!;
      expect(a1.tabIndex).toBe(0);

      // Moving left on file a clamps at file a
      a1.dispatchEvent(createKeyboardEvent("ArrowLeft"));
      expect(container.querySelector('[data-square="a1"]')!.tabIndex).toBe(0);
    });

    it("supports Home and End to jump to row boundaries", () => {
      const e4 = container.querySelector('[data-square="e4"]')!;
      e4.focus();
      // Home jumps to file a on current rank
      e4.dispatchEvent(createKeyboardEvent("Home"));
      expect(container.querySelector('[data-square="a4"]')!.tabIndex).toBe(0);

      // End jumps to file h on current rank
      const a4 = container.querySelector('[data-square="a4"]')!;
      a4.focus();
      a4.dispatchEvent(createKeyboardEvent("End"));
      expect(container.querySelector('[data-square="h4"]')!.tabIndex).toBe(0);
    });

    it("supports PageUp and PageDown to jump to board corners", () => {
      const e4 = container.querySelector('[data-square="e4"]')!;
      e4.focus();
      e4.dispatchEvent(createKeyboardEvent("PageUp"));
      expect(container.querySelector('[data-square="a8"]')!.tabIndex).toBe(0);

      const a8 = container.querySelector('[data-square="a8"]')!;
      a8.focus();
      a8.dispatchEvent(createKeyboardEvent("PageDown"));
      expect(container.querySelector('[data-square="h1"]')!.tabIndex).toBe(0);
    });
  });

  describe("Keyboard Arrow Navigation (Black Orientation)", () => {
    beforeEach(() => {
      board.reset("black");
    });

    it("navigates in visual direction when board is flipped", () => {
      // In Black orientation, top is rank 1, left is file h
      const e7 = container.querySelector('[data-square="e7"]')!;
      e7.focus();

      // Visually UP moves towards rank 1 (rank decreases to 6)
      e7.dispatchEvent(createKeyboardEvent("ArrowUp"));
      expect(container.querySelector('[data-square="e6"]')!.tabIndex).toBe(0);

      // Visually LEFT moves towards file h (file becomes f)
      const e6 = container.querySelector('[data-square="e6"]')!;
      e6.focus();
      e6.dispatchEvent(createKeyboardEvent("ArrowLeft"));
      expect(container.querySelector('[data-square="f6"]')!.tabIndex).toBe(0);
    });
  });

  describe("Keyboard Move Selection and Execution", () => {
    it("allows selecting a piece with Space and executing move with Space", () => {
      // White to move: select e2
      const e2 = container.querySelector('[data-square="e2"]')!;
      e2.focus();
      e2.dispatchEvent(createKeyboardEvent(" "));

      // Check selected
      expect(container.querySelector('[data-square="e2"]')!.getAttribute("aria-selected")).toBe("true");

      // Navigate arrow up twice to e4
      const curE2 = container.querySelector('[data-square="e2"]')!;
      curE2.dispatchEvent(createKeyboardEvent("ArrowUp"));
      const curE3 = container.querySelector('[data-square="e3"]')!;
      curE3.dispatchEvent(createKeyboardEvent("ArrowUp"));

      // Now at e4: press Space to commit move
      const curE4 = container.querySelector('[data-square="e4"]')!;
      curE4.dispatchEvent(createKeyboardEvent(" "));

      expect(onPlayerMove).toHaveBeenCalledWith("e2e4", "e4");
      // Focus moves to destination square
      expect(container.querySelector('[data-square="e4"]')!.tabIndex).toBe(0);
      expect(container.querySelector('[data-square="e4"]')!.getAttribute("aria-label")).toContain("last move");
    });

    it("cancels piece selection on Escape", () => {
      const e2 = container.querySelector('[data-square="e2"]')!;
      e2.focus();
      e2.dispatchEvent(createKeyboardEvent("Enter"));
      expect(container.querySelector('[data-square="e2"]')!.getAttribute("aria-selected")).toBe("true");

      // Press Escape
      const curE2 = container.querySelector('[data-square="e2"]')!;
      curE2.dispatchEvent(createKeyboardEvent("Escape"));
      expect(container.querySelector('[data-square="e2"]')!.getAttribute("aria-selected")).toBe("false");
    });
  });

  describe("Pawn Promotion Accessibility", () => {
    it("renders accessible promotion dialog with ARIA roles and labels", () => {
      // Setup position with pawn about to promote: White pawn on e7, white to move
      board.reset("white", "8/4P3/8/8/8/8/8/k6K w - - 0 1");

      const e7 = container.querySelector('[data-square="e7"]')!;
      e7.focus();
      e7.dispatchEvent(createKeyboardEvent("Enter"));

      // Navigate up from e7 to e8
      e7.dispatchEvent(createKeyboardEvent("ArrowUp"));
      const curE8 = container.querySelector('[data-square="e8"]')!;
      curE8.dispatchEvent(createKeyboardEvent("Enter"));

      expect(board.isPromotionPending()).toBe(true);

      const promoOverlay = container.querySelector(".play-promo-overlay");
      expect(promoOverlay).not.toBeNull();
      expect(promoOverlay!.getAttribute("role")).toBe("dialog");
      expect(promoOverlay!.getAttribute("aria-label")).toBe("Pawn promotion");

      const promoButtons = container.querySelectorAll(".play-promo-btn");
      expect(promoButtons).toHaveLength(4);
      expect(promoButtons[0].getAttribute("aria-label")).toBe("Promote to queen");
      expect(promoButtons[1].getAttribute("aria-label")).toBe("Promote to rook");
      expect(promoButtons[2].getAttribute("aria-label")).toBe("Promote to bishop");
      expect(promoButtons[3].getAttribute("aria-label")).toBe("Promote to knight");
    });
  });
});
