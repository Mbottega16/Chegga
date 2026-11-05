// Studio Menu fold (left column of the studio grid).
//
// Wider than 1040px: the left column folds into a slim icon rail, so the
// board stage gets the room. The choice is remembered between visits.
// 1040px or less: the menu list folds into a drawer that starts closed on
// every visit, so it never pushes the board down the page.

const STORAGE_KEY = "chegga-web:studio-menu";
const NARROW_QUERY = "(max-width: 1040px)";

let grid: HTMLElement | null = null;
let toggle: HTMLButtonElement | null = null;

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
  // Only the desktop rail is a preference; the phone drawer always starts closed.
  if (remember && !window.matchMedia(NARROW_QUERY).matches) {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "open");
    } catch {
      // blocked storage: the fold still works, it just isn't remembered
    }
  }
}

/** Returns the section, opening the menu first if the rail has folded it away. */
export function revealSection(id: string): HTMLElement | null {
  const target = document.getElementById(id);
  if (target && isStudioMenuCollapsed() && target.getClientRects().length === 0) {
    setStudioMenuCollapsed(false);
  }
  return target;
}

/** Call once at startup, after the page's static template is in the DOM. */
export function setupStudioMenu(): void {
  grid = document.getElementById("studio-grid");
  toggle = document.querySelector<HTMLButtonElement>("#studio-nav-toggle");
  if (!grid || !toggle) return;

  const narrow = window.matchMedia(NARROW_QUERY);
  const applyDefault = () => setStudioMenuCollapsed(narrow.matches || rememberedCollapsed(), false);
  applyDefault();
  narrow.addEventListener("change", applyDefault);

  toggle.addEventListener("click", () => setStudioMenuCollapsed(!isStudioMenuCollapsed()));

  // A rail link to a folded-away card (Get connected, Daily Training) opens
  // the menu before the browser's own anchor jump runs.
  document.querySelectorAll<HTMLAnchorElement>(".studio-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      const id = link.hash.slice(1);
      if (id) revealSection(id);
    });
  });
}
