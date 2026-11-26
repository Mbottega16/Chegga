// The one-screen shell: the menu on the left, the board in the middle, the
// tabbed side panel on the right, and the other screens (Daily Training, the
// Studio Lab) that the menu opens in their place. Both side panels slide open
// and closed.

const NAV_KEY = "chegga-web:studio-menu";
const SIDE_KEY = "chegga-web:side-panel";
const NARROW_QUERY = "(max-width: 1040px)";
const SLIDE_OUT_MS = 170;
const SLIDE_MS = 260;
const EASE = "cubic-bezier(0.22, 0.8, 0.24, 1)";

export type PanelTab = "games" | "analysis" | "connect";

const byId = (id: string) => document.getElementById(id);
const shell = () => byId("studio-grid");

function remember(key: string, collapsed: boolean): void {
  try {
    localStorage.setItem(key, collapsed ? "collapsed" : "open");
  } catch {
    // blocked storage: the fold still works, it just isn't remembered
  }
}

function remembered(key: string): boolean {
  try {
    return localStorage.getItem(key) === "collapsed";
  } catch {
    return false;
  }
}

// --- Sliding ---------------------------------------------------------------
// Only transform and opacity move. The layout changes once, and each column is
// then carried from where it was to where it now is.

let running: Animation[] = [];
let pending: (() => void) | null = null;

const stillPlease = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.matchMedia(NARROW_QUERY).matches;

function settle(): void {
  const finish = pending;
  pending = null;
  finish?.();
  running.forEach((a) => a.cancel());
  running = [];
}

function carry(change: () => void): void {
  const movers = [...(shell()?.children ?? [])] as HTMLElement[];
  const before = movers.map((el) => el.getBoundingClientRect().x);
  change();
  movers.forEach((el, i) => {
    const dx = before[i] - el.getBoundingClientRect().x;
    if (dx) running.push(el.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], { duration: SLIDE_MS, easing: EASE }));
  });
}

/** Slides `contents` off toward `side` ("left" or "right") before folding, or
 * back in after unfolding. */
function slide(contents: () => HTMLElement[], side: "left" | "right", collapse: boolean, change: () => void): void {
  settle();
  if (stillPlease() || typeof document.body.animate !== "function") return change();
  const away = { transform: `translateX(${side === "left" ? "-100%" : "100%"})`, opacity: 0 };
  const home = { transform: "none", opacity: 1 };
  if (!collapse) {
    carry(change);
    for (const el of contents()) running.push(el.animate([away, home], { duration: SLIDE_MS, easing: EASE }));
    return;
  }
  const leaving = contents().map((el) => el.animate([home, away], { duration: SLIDE_OUT_MS, easing: "ease-in", fill: "forwards" }));
  running.push(...leaving);
  pending = () => change();
  void Promise.all(leaving.map((a) => a.finished)).then(
    () => {
      if (!pending) return;
      pending = null;
      carry(change);
      leaving.forEach((a) => a.cancel());
    },
    () => undefined, // cancelled by a newer click, which has already settled it
  );
}

const parts = (selector: string) => () => [...document.querySelectorAll<HTMLElement>(selector)];

// --- The two side panels -----------------------------------------------------

export function isStudioMenuCollapsed(): boolean {
  return byId("studio-nav-toggle")?.getAttribute("aria-expanded") === "false";
}

export function setStudioMenuCollapsed(collapsed: boolean, save = true, animate = false): void {
  const grid = shell();
  const toggle = byId("studio-nav-toggle");
  if (!grid || !toggle) return;
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.title = collapsed ? "Open the menu" : "Close the menu";
  const change = () => grid.classList.toggle("menu-collapsed", collapsed);
  if (animate) slide(parts("#studio-nav-list, .shell-nav .brand, .shell-nav .header-actions"), "left", collapsed, change);
  else change();
  if (save && !window.matchMedia(NARROW_QUERY).matches) remember(NAV_KEY, collapsed);
}

function setSideCollapsed(collapsed: boolean, save = true, animate = false): void {
  const grid = shell();
  const button = byId("side-panel-toggle");
  if (!grid || !button) return;
  button.setAttribute("aria-expanded", String(!collapsed));
  button.title = collapsed ? "Open the side panel" : "Collapse the side panel";
  const change = () => grid.classList.toggle("side-collapsed", collapsed);
  if (animate) slide(parts(".side-panel-body, .panel-tabs"), "right", collapsed, change);
  else change();
  if (save) remember(SIDE_KEY, collapsed);
}

// --- Screens and tabs --------------------------------------------------------

export function selectPanelTab(tab: PanelTab): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('.panel-tabs [role="tab"]')) {
    const on = button.id === `tab-${tab}`;
    button.setAttribute("aria-selected", String(on));
    button.tabIndex = on ? 0 : -1;
    const page = byId(button.getAttribute("aria-controls")!);
    if (page) page.hidden = !on;
  }
}

/** Opens whichever screen and panel tab hold the element with this id. */
export function showViewFor(id: string): HTMLElement | null {
  const grid = shell();
  const target = id ? byId(id) : null;
  if (!grid || !target || !grid.contains(target)) return target;
  grid.dataset.view = target.closest<HTMLElement>("[data-shell-view]")?.dataset.shellView ?? "board";
  const tab = target.closest<HTMLElement>("[data-panel]")?.dataset.panel as PanelTab | undefined;
  if (tab) {
    selectPanelTab(tab);
    setSideCollapsed(false, false);
  }
  return target;
}

export function revealSection(id: string): HTMLElement | null {
  return showViewFor(id);
}

/** Back to the board, for a game or review that is starting. */
export function showBoard(): void {
  const grid = shell();
  if (grid) grid.dataset.view = "board";
  // Wide screens show the whole board without scrolling; narrow ones scroll to it.
  if (window.matchMedia(NARROW_QUERY).matches) {
    byId("play-section")?.scrollIntoView({ behavior: stillPlease() ? "auto" : "smooth", block: "start" });
  } else {
    window.scrollTo({ top: 0 });
  }
}

/** Call once at startup, after the page's static template is in the DOM. */
export function setupStudioMenu(): void {
  const toggle = byId("studio-nav-toggle");
  const sideToggle = byId("side-panel-toggle");
  if (!shell() || !toggle || !sideToggle) return;

  const narrow = window.matchMedia(NARROW_QUERY);
  const applyDefault = () => setStudioMenuCollapsed(narrow.matches || remembered(NAV_KEY), false);
  applyDefault();
  narrow.addEventListener("change", applyDefault);
  setSideCollapsed(remembered(SIDE_KEY), false);

  toggle.addEventListener("click", () => setStudioMenuCollapsed(!isStudioMenuCollapsed(), true, true));
  sideToggle.addEventListener("click", () =>
    setSideCollapsed(sideToggle.getAttribute("aria-expanded") === "true", true, true),
  );

  const tabs = [...document.querySelectorAll<HTMLButtonElement>('.panel-tabs [role="tab"]')];
  tabs.forEach((tab, i) => {
    const name = () => tab.id.replace("tab-", "") as PanelTab;
    tab.addEventListener("click", () => selectPanelTab(name()));
    tab.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      const next = tabs[(i + step + tabs.length) % tabs.length];
      next.click();
      next.focus();
    });
  });

  // Customize and Feedback open on top of the page.
  document.querySelectorAll<HTMLButtonElement>("button.studio-nav-link[data-dialog]").forEach((button) => {
    const dialog = byId(button.dataset.dialog!) as HTMLDialogElement;
    button.addEventListener("click", () => dialog.showModal());
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close(); // a click on the dimmed backdrop
    });
  });

  const links = document.querySelectorAll<HTMLAnchorElement>("a.studio-nav-link");
  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const id = link.hash.slice(1);
      history.pushState(null, "", link.hash);
      const target = revealSection(id);
      if (link.dataset.openTab) {
        selectPanelTab(link.dataset.openTab as PanelTab);
        setSideCollapsed(false, false);
      }
      links.forEach((l) => {
        l.classList.toggle("active", l === link);
        if (l === link) l.setAttribute("aria-current", "location");
        else l.removeAttribute("aria-current");
      });
      if (narrow.matches) setStudioMenuCollapsed(true, false);
      if (!target) return;
      if (target instanceof HTMLDetailsElement) target.open = true;
      if (narrow.matches || shell()!.dataset.view !== "board") target.scrollIntoView({ block: "start" });
      flashTarget(target);
    });
  });

  // Back, Forward and shared "#section" links land on the matching screen.
  const fromAddress = () => {
    const id = location.hash.slice(1);
    if (!id || id.includes("=")) {
      if (!id) showBoard();
      return;
    }
    showViewFor(id);
  };
  window.addEventListener("popstate", fromAddress);
  if (location.hash) fromAddress();
}

function flashTarget(el: HTMLElement): void {
  el.classList.remove("nav-target-flash");
  void el.offsetWidth; // restart the animation on a repeat click
  el.classList.add("nav-target-flash");
  window.setTimeout(() => el.classList.remove("nav-target-flash"), 1200);
}
