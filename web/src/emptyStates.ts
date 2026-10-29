// Chegga Web — designed empty / pre-data states for the data-dependent cards.
//
// Redesign note #5: cards that are `display:none` until data land leave a
// new visitor looking at a stub page, and cards shown blank look broken.
// This gives every can-be-empty card the same shape while it waits:
//   - one line on what it will show
//   - a faded skeleton of the populated version (aria-hidden, decorative)
//   - the action that fills it
//
// It's pure string-building plus one delegated click handler. `emptyFor`
// is called from main.ts wherever the old code set a section to
// `display:none`; `showEmptyStates` seeds every card for a fresh visitor
// with no synced account at all.

type SkeletonKind = "report" | "bars" | "board" | "chart" | "rows" | "lines";

interface EmptyStateConfig {
  /** `<section>` id, still carrying the inline `display:none`. */
  sectionId: string;
  /** the `<div>` inside it whose innerHTML the real render replaces. */
  outputId: string;
  line: string;
  ctaLabel: string;
  skeleton: SkeletonKind;
}

// Order mirrors the DOM so the seeded page reads top-to-bottom sensibly.
const EMPTY_STATES: EmptyStateConfig[] = [
  {
    sectionId: "picker-section",
    outputId: "picker-output",
    line: "Connect an account to review past games and evaluate key moves.",
    ctaLabel: "Sync your games",
    skeleton: "rows",
  },
  {
    sectionId: "focus-section",
    outputId: "focus-output",
    line: "Pinpoints your weakest tactical areas and generates focused drills.",
    ctaLabel: "Sync your games",
    skeleton: "bars",
  },
  {
    sectionId: "profile-section",
    outputId: "profile-output",
    line: "Accuracy curves, opening repertoire, blunder patterns, and rating estimate.",
    ctaLabel: "Sync your games",
    skeleton: "report",
  },
  {
    sectionId: "puzzle-section",
    outputId: "puzzle-output-empty",
    line: "Personalized puzzles generated directly from your own game mistakes.",
    ctaLabel: "Sync your games",
    skeleton: "board",
  },
  {
    sectionId: "redemption-section",
    outputId: "redemption-output",
    line: "Replay critical blunder positions and convert them against the bot.",
    ctaLabel: "Sync your games",
    skeleton: "rows",
  },
  {
    sectionId: "insights-section",
    outputId: "insights-output",
    line: "Key tactical stats: accuracy, recurring leaks, and phase breakdowns.",
    ctaLabel: "Sync your games",
    skeleton: "lines",
  },
  {
    sectionId: "patterns-section",
    outputId: "patterns-output",
    line: "Game outcomes, rating curves, and performance vs opponent tiers.",
    ctaLabel: "Sync your games",
    skeleton: "chart",
  },
  {
    sectionId: "rivals-section",
    outputId: "rivals-output",
    line: "Head-to-head records and statistics against recurring rivals.",
    ctaLabel: "Sync your games",
    skeleton: "rows",
  },
  {
    sectionId: "opening-section",
    outputId: "opening-output",
    line: "Interactive visual tree of your opening lines and win rates.",
    ctaLabel: "Sync to build opening map",
    skeleton: "board",
  },
  {
    sectionId: "depth-section",
    outputId: "depth-output",
    line: "Explore move frequencies and branching paths across your library.",
    ctaLabel: "Sync your games",
    skeleton: "board",
  },
  {
    sectionId: "vision-section",
    outputId: "vision-output-empty",
    line: "Rapid-fire board vision drills to identify hanging pieces instantly.",
    ctaLabel: "Sync your games",
    skeleton: "board",
  },
];

const byId = new Map(EMPTY_STATES.map((c) => [c.sectionId, c]));

function skeletonHtml(kind: SkeletonKind): string {
  switch (kind) {
    case "report":
      return `
        <div class="sk-line sk-lead"></div>
        <div class="sk-bars">${'<div class="sk-bar"></div>'.repeat(5)}</div>
        <div class="sk-line sk-w70"></div>
        <div class="sk-line sk-w45"></div>`;
    case "bars":
      return `<div class="sk-scorebars">${
        Array.from({ length: 4 }, (_, i) => `<div class="sk-scorebar"><span style="width:${[62, 44, 78, 33][i]}%"></span></div>`).join("")
      }</div>`;
    case "board":
      return `<div class="sk-board">${'<span></span>'.repeat(64)}</div>`;
    case "chart":
      return `<svg class="sk-chart" viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="0,60 30,52 60,58 90,40 120,44 150,28 200,32" />
      </svg>`;
    case "rows":
      return `<div class="sk-rows">${'<div class="sk-row"></div>'.repeat(4)}</div>`;
    case "lines":
      return `<div class="sk-lines">${['sk-w90', 'sk-w70', 'sk-w80', 'sk-w55'].map((w) => `<div class="sk-line ${w}"></div>`).join('')}</div>`;
  }
}

function emptyStateHtml(cfg: EmptyStateConfig): string {
  return `<div class="empty-state">
    <div class="empty-state-skeleton" aria-hidden="true">${skeletonHtml(cfg.skeleton)}</div>
    <p class="empty-state-line">${cfg.line}</p>
    <button type="button" class="empty-state-cta" data-empty-cta>${cfg.ctaLabel}</button>
  </div>`;
}

/**
 * Show #picker-section in its compact graphic waiting state so the right-hand
 * Studio Command Deck invites the visitor to connect, while keeping secondary
 * data-dependent panels hidden until games are actually synced (no wall of
 * empty skeleton panels).
 */
export function emptyFor(sectionId: string): boolean {
  const cfg = byId.get(sectionId);
  if (!cfg) return false;
  const section = document.getElementById(cfg.sectionId);
  let output = document.getElementById(cfg.outputId);
  if (!output && section) {
    output = document.createElement("div");
    output.id = cfg.outputId;
    section.appendChild(output);
  }
  if (!section || !output) return false;
  if (sectionId === "picker-section" || sectionId === "focus-section" || sectionId === "profile-section") {
    section.style.display = "";
    const shortLine =
      sectionId === "picker-section"
        ? "Sync your username above or try the sample dataset to step through your games."
        : sectionId === "focus-section"
          ? "Connect your games to unlock your personalized weakness prescription."
          : "Connect your games to unlock move-quality rings, phase metrics, and opening diagnostics.";
    output.innerHTML = `<div class="empty-state">
      <div class="empty-state-graphic" aria-hidden="true">
        <svg viewBox="0 0 120 48" width="110" height="44" fill="none">
          <rect x="4" y="4" width="40" height="40" rx="6" fill="#141b27" stroke="#2a3548" stroke-width="1.4"/>
          <circle cx="24" cy="24" r="12" stroke="#22d3ee" stroke-width="3" stroke-dasharray="48 28" stroke-linecap="round"/>
          <rect x="54" y="10" width="56" height="7" rx="3.5" fill="#232c3d"/>
          <rect x="54" y="22" width="40" height="6" rx="3" fill="#1b2230"/>
          <rect x="54" y="33" width="48" height="6" rx="3" fill="#1b2230"/>
        </svg>
      </div>
      <p class="empty-state-line">${shortLine}</p>
      <button type="button" class="empty-state-cta" data-empty-cta>${cfg.ctaLabel}</button>
    </div>`;
    output.dataset.emptyState = "1";
  } else {
    section.style.display = "none";
    output.innerHTML = emptyStateHtml(cfg);
    output.dataset.emptyState = "1";
  }
  return true;
}

/** Clear a card's empty state once real content is about to be rendered. */
export function clearEmptyFor(sectionId: string): void {
  const cfg = byId.get(sectionId);
  if (!cfg) return;
  const output = document.getElementById(cfg.outputId);
  if (output?.dataset.emptyState) {
    output.innerHTML = "";
    delete output.dataset.emptyState;
  }
}

/** Seed waiting state for a visitor with no synced account. */
export function showEmptyStates(): void {
  for (const cfg of EMPTY_STATES) emptyFor(cfg.sectionId);
}

/** Wire the CTA buttons once: jump to the sync form and focus the input. */
export function wireEmptyStateCtas(): void {
  document.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("[data-empty-cta]");
    if (!btn) return;
    document.getElementById("sync-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => document.getElementById("username")?.focus(), 400);
  });
}
