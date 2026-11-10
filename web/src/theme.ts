// Chegga Web — Theme & Color Customization Engine
//
// Manages light, dark, and OLED display modes, as well as customizable
// studio accent color schemes and persistent user preferences in localStorage.

export type ThemeMode = "dark" | "light" | "oled" | "system";

export type AccentColor = "amber" | "emerald" | "sapphire" | "ruby" | "amethyst" | "cyan";

export interface AccentOption {
  id: AccentColor;
  label: string;
  hex: string;
  strongHex: string;
  inkHex: string;
  /* Dark variants painted instead while the light theme is active: the
     bright hues measure 1.6–4.0:1 as text on white (under WCAG AA),
     while these hold >= 4.8:1 on both light surfaces. lightInkHex is
     white — the near-black inks read at 8.7:1 on the bright fills but
     would drop to ~3.7:1 on these deeper ones; white holds >= 5:1. */
  lightHex: string;
  lightStrongHex: string;
  lightInkHex: string;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  { id: "amber", label: "Studio Gold", hex: "#e3a857", strongHex: "#f0be73", inkHex: "#1c1305", lightHex: "#b45309", lightStrongHex: "#92400e", lightInkHex: "#ffffff" },
  { id: "emerald", label: "Emerald", hex: "#10b981", strongHex: "#34d399", inkHex: "#022c22", lightHex: "#047857", lightStrongHex: "#065f46", lightInkHex: "#ffffff" },
  { id: "sapphire", label: "Sapphire", hex: "#3b82f6", strongHex: "#60a5fa", inkHex: "#0f172a", lightHex: "#1d4ed8", lightStrongHex: "#1e40af", lightInkHex: "#ffffff" },
  { id: "ruby", label: "Ruby", hex: "#f43f5e", strongHex: "#fb7185", inkHex: "#1f0207", lightHex: "#be123c", lightStrongHex: "#9f1239", lightInkHex: "#ffffff" },
  { id: "amethyst", label: "Amethyst", hex: "#a855f7", strongHex: "#c084fc", inkHex: "#1e0538", lightHex: "#7e22ce", lightStrongHex: "#6b21a8", lightInkHex: "#ffffff" },
  { id: "cyan", label: "Cyber Cyan", hex: "#06b6d4", strongHex: "#22d3ee", inkHex: "#042f2e", lightHex: "#0e7490", lightStrongHex: "#155e75", lightInkHex: "#ffffff" },
];

export const THEME_MODES: { id: ThemeMode; label: string; icon: string }[] = [
  { id: "dark", label: "Dark", icon: "🌙" },
  { id: "light", label: "Light", icon: "☀️" },
  { id: "oled", label: "OLED", icon: "🖤" },
  { id: "system", label: "Auto", icon: "⚙️" },
];

const STORAGE_MODE_KEY = "chegga:theme:mode";
const STORAGE_ACCENT_KEY = "chegga:theme:accent";

let activeMode: ThemeMode = "dark";
let activeAccent: AccentColor = "amber";
let systemMediaListener: ((e: MediaQueryListEvent) => void) | null = null;

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Updates <meta name="theme-color"> for iOS Safari & Android header chrome */
function updateMetaThemeColor(resolvedMode: "dark" | "light" | "oled"): void {
  if (typeof document === "undefined") return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  if (resolvedMode === "light") {
    meta.content = "#f8fafc";
  } else if (resolvedMode === "oled") {
    meta.content = "#000000";
  } else {
    meta.content = "#0a0c10";
  }
}

/** Apply the mode (and resolve "system" to real mode) */
export function applyThemeMode(mode: ThemeMode): void {
  activeMode = mode;
  if (typeof document === "undefined") return;

  const resolved = mode === "system" ? (getSystemPrefersDark() ? "dark" : "light") : mode;

  document.documentElement.setAttribute("data-theme", resolved);
  updateMetaThemeColor(resolved);
  paintAccent();

  try {
    localStorage.setItem(STORAGE_MODE_KEY, mode);
  } catch {
    // storage disabled
  }

  // Setup/teardown system listener
  if (typeof window !== "undefined" && window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (systemMediaListener) {
      mq.removeEventListener("change", systemMediaListener);
      systemMediaListener = null;
    }
    if (mode === "system") {
      systemMediaListener = (e: MediaQueryListEvent) => {
        if (activeMode === "system") {
          const sysResolved = e.matches ? "dark" : "light";
          document.documentElement.setAttribute("data-theme", sysResolved);
          updateMetaThemeColor(sysResolved);
          paintAccent();
          dispatchThemeChange();
        }
      };
      mq.addEventListener("change", systemMediaListener);
    }
  }

  dispatchThemeChange();
}

/** Paint the active accent's custom properties for the resolved theme.
    The light theme gets each accent's dark variants (see AccentOption);
    dark and OLED get the bright studio hues. No storage write and no
    event — callers own those, so applyThemeMode can repaint on a mode
    switch without double-firing. */
function paintAccent(): void {
  if (typeof document === "undefined") return;
  const opt = ACCENT_OPTIONS.find((a) => a.id === activeAccent) ?? ACCENT_OPTIONS[0];
  const light = document.documentElement.getAttribute("data-theme") === "light";
  document.documentElement.setAttribute("data-accent", opt.id);
  document.documentElement.style.setProperty("--accent", light ? opt.lightHex : opt.hex);
  document.documentElement.style.setProperty("--accent-strong", light ? opt.lightStrongHex : opt.strongHex);
  document.documentElement.style.setProperty("--accent-ink", light ? opt.lightInkHex : opt.inkHex);
}

/** Apply studio accent color */
export function applyAccentColor(accent: AccentColor): void {
  const opt = ACCENT_OPTIONS.find((a) => a.id === accent) ?? ACCENT_OPTIONS[0];
  activeAccent = opt.id;

  if (typeof document === "undefined") return;

  paintAccent();

  try {
    localStorage.setItem(STORAGE_ACCENT_KEY, opt.id);
  } catch {
    // storage disabled
  }

  dispatchThemeChange();
}

/** Cycle theme mode quickly (Dark -> Light -> OLED -> Dark) */
export function cycleThemeMode(): ThemeMode {
  const cycle: ThemeMode[] = ["dark", "light", "oled"];
  const currIdx = cycle.indexOf(activeMode);
  const nextMode = currIdx >= 0 ? cycle[(currIdx + 1) % cycle.length] : "dark";
  applyThemeMode(nextMode);
  return nextMode;
}

export function getActiveThemeMode(): ThemeMode {
  return activeMode;
}

export function getActiveAccent(): AccentColor {
  return activeAccent;
}

function dispatchThemeChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("chegga:theme-changed", {
      detail: { mode: activeMode, accent: activeAccent },
    })
  );
}

/** Initializes saved theme mode and accent preferences on app startup */
export function initTheme(): { mode: ThemeMode; accent: AccentColor } {
  let savedMode: ThemeMode = "dark";
  let savedAccent: AccentColor = "amber";

  try {
    const m = localStorage.getItem(STORAGE_MODE_KEY) as ThemeMode | null;
    if (m && (m === "dark" || m === "light" || m === "oled" || m === "system")) {
      savedMode = m;
    }
    const a = localStorage.getItem(STORAGE_ACCENT_KEY) as AccentColor | null;
    if (a && ACCENT_OPTIONS.some((opt) => opt.id === a)) {
      savedAccent = a;
    }
  } catch {
    // localStorage not accessible
  }

  applyThemeMode(savedMode);
  applyAccentColor(savedAccent);

  return { mode: savedMode, accent: savedAccent };
}
