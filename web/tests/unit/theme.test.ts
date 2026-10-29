import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  applyThemeMode,
  applyAccentColor,
  cycleThemeMode,
  getActiveThemeMode,
  getActiveAccent,
  initTheme,
  ACCENT_OPTIONS,
  THEME_MODES,
} from "../../src/theme";

describe("Chegga Theme & Accent Engine", () => {
  let mockStorage: Record<string, string> = {};
  let mockAttributes: Record<string, string> = {};
  let mockStyles: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    mockAttributes = {};
    mockStyles = {};

    // Mock localStorage
    const storage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = String(value);
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };
    (globalThis as any).localStorage = storage;

    // Mock document
    const docElement = {
      setAttribute: (k: string, v: string) => {
        mockAttributes[k] = v;
      },
      getAttribute: (k: string) => mockAttributes[k] ?? null,
      removeAttribute: (k: string) => {
        delete mockAttributes[k];
      },
      style: {
        setProperty: (k: string, v: string) => {
          mockStyles[k] = v;
        },
        getPropertyValue: (k: string) => mockStyles[k] ?? "",
        removeProperty: (k: string) => {
          delete mockStyles[k];
        },
      },
    };

    const docHead = {
      appendChild: vi.fn(),
    };

    (globalThis as any).document = {
      documentElement: docElement,
      head: docHead,
      querySelector: vi.fn(() => ({ content: "" })),
      createElement: vi.fn(() => ({ name: "", content: "" })),
    };

    // Mock window
    (globalThis as any).window = {
      dispatchEvent: vi.fn(),
      matchMedia: vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    };
  });

  afterEach(() => {
    delete (globalThis as any).localStorage;
    delete (globalThis as any).document;
    delete (globalThis as any).window;
  });

  it("initializes with default dark mode and amber accent", () => {
    const res = initTheme();
    expect(res.mode).toBe("dark");
    expect(res.accent).toBe("amber");
    expect(mockAttributes["data-theme"]).toBe("dark");
    expect(mockAttributes["data-accent"]).toBe("amber");
  });

  it("applies light mode cleanly and persists to localStorage", () => {
    applyThemeMode("light");
    expect(getActiveThemeMode()).toBe("light");
    expect(mockAttributes["data-theme"]).toBe("light");
    expect(mockStorage["chegga:theme:mode"]).toBe("light");
  });

  it("applies oled mode cleanly", () => {
    applyThemeMode("oled");
    expect(getActiveThemeMode()).toBe("oled");
    expect(mockAttributes["data-theme"]).toBe("oled");
    expect(mockStorage["chegga:theme:mode"]).toBe("oled");
  });

  it("applies and sets accent color custom properties", () => {
    applyAccentColor("emerald");
    expect(getActiveAccent()).toBe("emerald");
    expect(mockAttributes["data-accent"]).toBe("emerald");
    expect(mockStyles["--accent"]).toBe("#10b981");
    expect(mockStorage["chegga:theme:accent"]).toBe("emerald");
  });

  it("cycles theme mode through dark -> light -> oled -> dark", () => {
    applyThemeMode("dark");
    expect(cycleThemeMode()).toBe("light");
    expect(getActiveThemeMode()).toBe("light");
    expect(cycleThemeMode()).toBe("oled");
    expect(getActiveThemeMode()).toBe("oled");
    expect(cycleThemeMode()).toBe("dark");
    expect(getActiveThemeMode()).toBe("dark");
  });

  it("dispatches theme change custom event when mode or accent changes", () => {
    applyThemeMode("light");
    expect((globalThis as any).window.dispatchEvent).toHaveBeenCalled();

    applyAccentColor("sapphire");
    expect((globalThis as any).window.dispatchEvent).toHaveBeenCalled();
  });
});
