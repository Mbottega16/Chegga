// Studio Launchpad (2x3 entry window) & Dashboard Orientation (Operating vs. Playing).
//
// Distinguishes:
//   - "operating": the operating-based view of the app (opens first with the
//     2x3 panel-style launchpad window, followed by full-width borderless
//     operating panels for Get Connected, Daily Training Sets, Previously
//     Played Games, Scouting Profile, and What's Coming Soon).
//   - "playing": the dedicated playing-the-game orientation of the dashboard,
//     where the chessboard stage (#play-section) rises to the top at full
//     screen width for playing vs. Stockfish or stepping through a game review.

const STORAGE_KEY = "chegga-web:studio-menu";
const NARROW_QUERY = "(max-width: 1040px)";

export type DashboardOrientation = "operating" | "playing";

let grid: HTMLElement | null = null;
let toggle: HTMLButtonElement | null = null;
let operatingBtn: HTMLButtonElement | null = null;
let playingBtn: HTMLButtonElement | null = null;

function rememberedCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

export function isStudioMenuCollapsed(): boolean {
  return grid?.classList.contains("menu-collapsed") ?? false;
}

export function setStudioMenuCollapsed(collapsed: boolean, remember = true): void {
  if (!grid || !toggle) return;
  grid.classList.toggle("menu-collapsed", collapsed);
  toggle.setAttribute("aria-expanded", String(!collapsed));
  if (remember && !window.matchMedia(NARROW_QUERY).matches) {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "open");
    } catch {
      // blocked storage: the fold still works, it just isn't remembered
    }
  }
}

export function getDashboardOrientation(): DashboardOrientation {
  return (grid?.dataset.orientation as DashboardOrientation) || "operating";
}

export function setDashboardOrientation(mode: DashboardOrientation): void {
  if (!grid) grid = document.getElementById("studio-grid");
  if (!grid) return;
  grid.dataset.orientation = mode;
  document.body.dataset.orientation = mode;

  if (operatingBtn) {
    const isOp = mode === "operating";
    operatingBtn.classList.toggle("active", isOp);
    operatingBtn.setAttribute("aria-pressed", String(isOp));
  }
  if (playingBtn) {
    const isPlay = mode === "playing";
    playingBtn.classList.toggle("active", isPlay);
    playingBtn.setAttribute("aria-pressed", String(isPlay));
  }
}

/** Returns the section, opening the menu/operating view first if folded away. */
export function revealSection(id: string): HTMLElement | null {
  const target = document.getElementById(id);
  if (id === "play-section") {
    setDashboardOrientation("playing");
  } else if (id) {
    setDashboardOrientation("operating");
  }
  if (target && isStudioMenuCollapsed() && target.getClientRects().length === 0) {
    setStudioMenuCollapsed(false);
  }
  return target;
}

/** Call once at startup, after the page's static template is in the DOM. */
export function setupStudioMenu(): void {
  grid = document.getElementById("studio-grid");
  toggle = document.querySelector<HTMLButtonElement>("#studio-nav-toggle");
  operatingBtn = document.querySelector<HTMLButtonElement>("#orientation-operating-btn");
  playingBtn = document.querySelector<HTMLButtonElement>("#orientation-playing-btn");
  if (!grid || !toggle) return;

  // Start in Operating View with the 2x3 panel window open on desktop.
  setDashboardOrientation("operating");

  const narrow = window.matchMedia(NARROW_QUERY);
  const applyDefault = () => setStudioMenuCollapsed(narrow.matches || rememberedCollapsed(), false);
  applyDefault();
  narrow.addEventListener("change", applyDefault);

  toggle.addEventListener("click", () => setStudioMenuCollapsed(!isStudioMenuCollapsed()));

  operatingBtn?.addEventListener("click", () => {
    setDashboardOrientation("operating");
    if (isStudioMenuCollapsed() && !narrow.matches) {
      setStudioMenuCollapsed(false);
    }
  });

  playingBtn?.addEventListener("click", () => {
    setDashboardOrientation("playing");
    document.getElementById("play-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const links = document.querySelectorAll<HTMLAnchorElement>(".studio-nav-link");
  links.forEach((link) => {
    link.addEventListener("click", () => {
      const id = link.hash.slice(1);
      const requestedMode = link.dataset.viewMode as DashboardOrientation | undefined;
      if (requestedMode) {
        setDashboardOrientation(requestedMode);
      }
      const target = id ? revealSection(id) : null;
      links.forEach((l) => {
        l.classList.toggle("active", l === link);
        if (l === link) l.setAttribute("aria-current", "location");
        else l.removeAttribute("aria-current");
      });
      if (!target) return;
      if (target instanceof HTMLDetailsElement) target.open = true;
      flashTarget(target);
    });
  });
}

function flashTarget(el: HTMLElement): void {
  el.classList.remove("nav-target-flash");
  void el.offsetWidth; // restart the animation on a repeat click
  el.classList.add("nav-target-flash");
  window.setTimeout(() => el.classList.remove("nav-target-flash"), 1200);
}
