// Studio Menu (the launchpad, which folds into an icon rail on the left) and
// the games panel on the right, which folds the same way.

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
  if (remember && !window.matchMedia(NARROW_QUERY).matches) {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "open");
    } catch {
      // blocked storage: the fold still works, it just isn't remembered
    }
  }
}

/** Brings the board to the top, for a game or review that is starting. */
export function showBoard(): void {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("play-section")?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
}

/** Returns the section, opening the menu first if folded away. */
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

  // Customize and Feedback open on top of the page, so they work the same
  // whether the menu is open or folded into its icon rail.
  document.querySelectorAll<HTMLButtonElement>("button.studio-nav-link[data-dialog]").forEach((button) => {
    const dialog = document.getElementById(button.dataset.dialog!) as HTMLDialogElement;
    button.addEventListener("click", () => dialog.showModal());
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close(); // a click on the dimmed backdrop
    });
  });

  setupSidePanel();

  const links = document.querySelectorAll<HTMLAnchorElement>("a.studio-nav-link");
  links.forEach((link) => {
    link.addEventListener("click", () => {
      const id = link.hash.slice(1);
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

const SIDE_KEY = "chegga-web:side-panel";

/** The games panel on the right folds into an icon rail, like the menu on the left. */
function setupSidePanel(): void {
  const button = document.getElementById("side-panel-toggle");
  if (!grid || !button) return;
  const set = (collapsed: boolean, remember = true) => {
    grid!.classList.toggle("side-collapsed", collapsed);
    button.setAttribute("aria-expanded", String(!collapsed));
    button.title = collapsed ? "Expand the games panel" : "Collapse the games panel";
    if (!remember) return;
    try {
      localStorage.setItem(SIDE_KEY, collapsed ? "collapsed" : "open");
    } catch {
      // blocked storage: the fold still works, it just isn't remembered
    }
  };
  let remembered = false;
  try {
    remembered = localStorage.getItem(SIDE_KEY) === "collapsed";
  } catch {
    // blocked storage: start open
  }
  set(remembered, false);
  button.addEventListener("click", () => set(!grid!.classList.contains("side-collapsed")));
  document.querySelectorAll<HTMLButtonElement>("[data-side-open]").forEach((rail) => {
    rail.addEventListener("click", () => {
      set(false);
      const target = document.getElementById(rail.dataset.sideOpen!);
      if (target) flashTarget(target);
    });
  });
}
