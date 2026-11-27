// Chegga Web — the Studio Lab screen: the list of tools, and one tool at a time
//
// Each tile is a link (#open=<card id>), so every tool has its own address:
// Back closes it, and a copied link opens it. Which tool is open lives on the
// lab screen's `data-tool` attribute, which studioMenu.ts's showViewFor() sets
// — every way into a tool (a tile, a deep link, a "Go" button on another card)
// passes through there. This module reacts to that: the bar above the tool,
// the page title, the note shown when a tool has nothing to show yet, and
// where keyboard focus goes.

import {
  LAB_GROUPS,
  LAB_TOOLS,
  hashWithOpen,
  labGroup,
  labToolByCard,
  needsLine,
  needsMessage,
  openFromHash,
  type LabDataState,
  type LabTool,
} from "./labTools";
import { svgIcon } from "./icons";
import { showViewFor } from "./studioMenu";

const BASE_TITLE = "Chegga";
const HUB_ID = "lab-section";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function tileHtml(t: LabTool): string {
  return `
    <li class="lab-tile-item">
      <a class="lab-tile" href="#open=${t.cardId}" data-tool="${t.id}" data-card="${t.cardId}"
        aria-labelledby="lab-tile-name-${t.id}" aria-describedby="lab-tile-blurb-${t.id} lab-tile-status-${t.id}">
        <span class="lab-tile-icon" aria-hidden="true">${svgIcon(t.icon, "lab-tile-svg", 22)}</span>
        <span class="lab-tile-body">
          <span class="lab-tile-name" id="lab-tile-name-${t.id}">${esc(t.name)}</span>
          <span class="lab-tile-blurb" id="lab-tile-blurb-${t.id}">${esc(t.blurb)}</span>
          <span class="lab-tile-status" id="lab-tile-status-${t.id}" data-ready="false"></span>
        </span>
      </a>
    </li>`;
}

/** The tool list, grouped. Statuses fill in once setupLabView() runs. */
export function renderLabHub(): string {
  const groups = LAB_GROUPS.map((g) => {
    const tools = LAB_TOOLS.filter((t) => t.group === g.id);
    return `
      <section class="lab-group" aria-labelledby="lab-group-${g.id}">
        <div class="lab-group-head">
          <h3 id="lab-group-${g.id}">${esc(g.name)}</h3>
          <p>${esc(g.blurb)}</p>
        </div>
        <ul class="lab-tiles" role="list">${tools.map(tileHtml).join("")}</ul>
      </section>`;
  }).join("");
  return `
    <section class="lab-hub" id="${HUB_ID}" aria-labelledby="lab-title">
      <div class="lab-hub-head">
        <h2 id="lab-title">Studio Lab</h2>
        <p class="lab-hub-sub">${LAB_TOOLS.length} tools. Most of them read your own games. Open one to start.</p>
      </div>
      ${groups}
    </section>`;
}

const backIcon = svgIcon(`<path d="M15 18l-6-6 6-6"></path>`, "lab-back-svg", 18);

/** The bar above an open tool, and the note that stands in for a tool with
 * nothing to show yet. Both are hidden while the tool list shows. */
export function renderLabToolbar(): string {
  return `
    <nav class="lab-toolbar" id="lab-toolbar" aria-label="Studio Lab">
      <a href="#${HUB_ID}" class="lab-back" id="lab-back">${backIcon}<span>All tools</span></a>
      <span class="lab-crumb" id="lab-crumb"></span>
    </nav>
    <section class="lab-needs-data" id="lab-needs-data" aria-labelledby="lab-needs-title" hidden>
      <h2 id="lab-needs-title" tabindex="-1"></h2>
      <p class="lab-needs-blurb" id="lab-needs-blurb"></p>
      <p class="lab-needs-text" id="lab-needs-text"></p>
      <div class="lab-needs-actions">
        <button type="button" data-needs-action="connect">Connect your account</button>
        <button type="button" class="btn-quiet" data-needs-action="demo">Try the sample games</button>
        <button type="button" data-needs-action="analyze">Analyze my games</button>
        <button type="button" class="btn-quiet" data-needs-action="games">Open my games</button>
      </div>
    </section>`;
}

export interface LabHooks {
  /** A tool was opened (by any route), for work a tool does only when seen. */
  onOpen?: (tool: LabTool) => void;
  onConnect: () => void;
  onTryDemo: () => void;
  onAnalyze: () => void;
  onShowGames: () => void;
}

let view: HTMLElement | null = null;
let hooks: LabHooks | null = null;
let dataState: LabDataState = { synced: 0, analyzed: 0 };
const notes = new Map<string, string>();
let lastTileId: string | null = null;

const cardOf = (t: LabTool) => document.getElementById(t.cardId);
const hasContent = (card: HTMLElement | null) => !!card && card.style.display !== "none";

function openCardId(): string {
  return view?.dataset.tool ?? "";
}

/** Tile statuses: a count or "Ready" when the tool has something to show,
 * otherwise what it is still waiting for. */
export function refreshLabStatus(): void {
  if (!view) return;
  for (const t of LAB_TOOLS) {
    const el = document.getElementById(`lab-tile-status-${t.id}`);
    if (!el) continue;
    const ready = hasContent(cardOf(t));
    const text = ready ? (notes.get(t.id) ?? "Ready") : needsLine(t.needs, dataState);
    if (el.textContent !== text) el.textContent = text;
    el.dataset.ready = String(ready);
  }
  syncNeedsNote();
}

/** A count or short state for a tool's tile ("35 positions"), or null to go
 * back to plain "Ready". */
export function setLabToolNote(toolId: string, text: string | null): void {
  if (text) notes.set(toolId, text);
  else notes.delete(toolId);
  refreshLabStatus();
}

export function setLabDataState(state: LabDataState): void {
  dataState = state;
  refreshLabStatus();
}

function syncNeedsNote(): void {
  const panel = document.getElementById("lab-needs-data");
  if (!view || !panel) return;
  const tool = labToolByCard(openCardId());
  const card = tool ? cardOf(tool) : null;
  const show = !!tool && !hasContent(card);
  // Focus inside the note (its title, "Try the sample games") would be lost
  // when the note hides because the tool filled in: hand it to the tool.
  const active = document.activeElement;
  const focusWasHere = !panel.hidden && (panel.contains(active) || active === document.body);
  panel.hidden = !show;
  if (!show && focusWasHere && card) {
    const heading = card.querySelector<HTMLElement>("h2");
    if (heading) {
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }
  if (!show || !tool) return;
  const msg = needsMessage(tool, dataState);
  document.getElementById("lab-needs-title")!.textContent = tool.name;
  document.getElementById("lab-needs-blurb")!.textContent = tool.blurb;
  document.getElementById("lab-needs-text")!.textContent = msg.text;
  for (const btn of panel.querySelectorAll<HTMLButtonElement>("[data-needs-action]")) {
    btn.hidden = !msg.actions.includes(btn.dataset.needsAction as (typeof msg.actions)[number]);
  }
}

function syncTitle(): void {
  const grid = document.getElementById("studio-grid");
  const tool = grid?.dataset.view === "lab" ? labToolByCard(openCardId()) : undefined;
  document.title = tool ? `${tool.name} · ${BASE_TITLE}` : grid?.dataset.view === "lab" ? `Studio Lab · ${BASE_TITLE}` : BASE_TITLE;
}

function applyOpenTool(changed: boolean): void {
  if (!view) return;
  const cardId = openCardId();
  const tool = labToolByCard(cardId);
  for (const t of LAB_TOOLS) cardOf(t)?.classList.toggle("lab-open", t.cardId === cardId);
  const crumb = document.getElementById("lab-crumb");
  if (crumb) crumb.textContent = tool ? labGroup(tool.group).name : "";
  syncNeedsNote();
  syncTitle();
  if (!changed) return;
  if (tool) {
    lastTileId = tool.id;
    // A tool opened from elsewhere (a Daily Training "Start", a plan's "Go")
    // still gets its address, so a reload or a copied link lands on it.
    if (openFromHash(location.hash) !== cardId) {
      history.replaceState(history.state, "", hashWithOpen(location.hash, cardId));
    }
    hooks?.onOpen?.(tool);
  }
  // Focus and scroll wait a tick: on Back or Forward the browser handles the
  // address's #fragment after the popstate event, and that would undo both.
  const lab = view;
  const tileId = lastTileId;
  window.setTimeout(() => {
    if (openCardId() !== cardId) return; // another tool opened meanwhile
    if (tool) {
      lab.scrollIntoView({ block: "start" });
      const card = cardOf(tool);
      const heading = hasContent(card)
        ? card!.querySelector<HTMLElement>("h2")
        : document.getElementById("lab-needs-title");
      if (heading) {
        if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    } else if (tileId) {
      const tile = lab.querySelector<HTMLElement>(`.lab-tile[data-tool="${tileId}"]`);
      tile?.focus({ preventScroll: true });
      tile?.scrollIntoView({ block: "center" });
    }
  }, 0);
}

/** Opens a tool by its card id, as its own history entry when `push`. */
export function openLabTool(cardId: string, push = true): void {
  if (!labToolByCard(cardId)) return;
  if (push && openFromHash(location.hash) !== cardId) {
    history.pushState({ labTool: cardId }, "", hashWithOpen(location.hash, cardId) || location.pathname + location.search);
  }
  showViewFor(cardId);
}

/** Back to the tool list. Steps back through history when the tool was
 * opened from the list, so Back and "All tools" agree. */
export function closeLabTool(): void {
  const state = history.state as { labTool?: string } | null;
  if (state?.labTool && state.labTool === openCardId()) {
    history.back(); // the popstate handler below shows the list
    return;
  }
  const next = hashWithOpen(location.hash, undefined);
  history.replaceState(null, "", next || location.pathname + location.search);
  showViewFor(HUB_ID);
}

/** Call once, after the lab screen's markup is in the page. */
export function setupLabView(labHooks: LabHooks): void {
  view = document.querySelector<HTMLElement>('[data-shell-view="lab"]');
  hooks = labHooks;
  if (!view) return;
  const lab = view;

  lab.addEventListener("chegga:tool-change", (e) => {
    applyOpenTool((e as CustomEvent<{ changed: boolean }>).detail.changed);
  });

  lab.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const tile = target.closest<HTMLAnchorElement>("a.lab-tile");
    if (tile) {
      // Let the browser open a new tab or window for a modified click.
      const me = e as MouseEvent;
      if (me.button !== 0 || me.metaKey || me.ctrlKey || me.shiftKey || me.altKey) return;
      e.preventDefault();
      openLabTool(tile.dataset.card!);
      return;
    }
    if (target.closest("#lab-back")) {
      e.preventDefault();
      closeLabTool();
      return;
    }
    const action = target.closest<HTMLButtonElement>("[data-needs-action]")?.dataset.needsAction;
    if (action === "connect") hooks?.onConnect();
    else if (action === "demo") hooks?.onTryDemo();
    else if (action === "analyze") hooks?.onAnalyze();
    else if (action === "games") hooks?.onShowGames();
  });

  // Back and Forward between a tool and the list. studioMenu.ts handles the
  // plain "#section" anchors; this handles "#open=<tool>" and its absence.
  window.addEventListener("popstate", () => {
    const open = openFromHash(location.hash);
    const grid = document.getElementById("studio-grid");
    if (open && labToolByCard(open)) showViewFor(open);
    else if (openCardId() && grid?.dataset.view === "lab") showViewFor(HUB_ID);
  });

  // Cards show and hide themselves as data arrives (their inline display),
  // which is what a tile's status and the "nothing yet" note follow.
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      refreshLabStatus();
    });
  });
  for (const t of LAB_TOOLS) {
    const card = cardOf(t);
    if (card) observer.observe(card, { attributes: true, attributeFilter: ["style"] });
  }
  const grid = document.getElementById("studio-grid");
  if (grid) new MutationObserver(syncTitle).observe(grid, { attributes: true, attributeFilter: ["data-view"] });

  refreshLabStatus();
}
