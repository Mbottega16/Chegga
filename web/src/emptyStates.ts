// Chegga Web — empty/pre-data state wiring.
//
// Shows purposeful, feature-rich previews for data-dependent panels before a
// visitor syncs an account so panels are filled and balanced rather than
// hollow or 1/4-filled.

import { extractPreviewFromPgn, renderMiniBoardSvg } from "./miniBoardSvg";

export type SkeletonKind = "report" | "bars" | "board" | "chart" | "rows" | "lines";

export interface EmptyStateConfig {
  sectionId: string;
  outputId: string;
  line: string;
  ctaLabel: string;
  skeleton: SkeletonKind;
}

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
 * Show #picker-section and primary cards in purposeful, filled waiting states
 * that draw the eye to the heading, provide clear captions, and invite interaction.
 */
interface SampleGameItem {
  opening: string;
  opponent: string;
  resultBadge: string;
  resultClass: "win" | "loss" | "draw";
  movesText: string;
  orientation: "white" | "black";
  pgn: string;
}

const SAMPLE_GAMES: SampleGameItem[] = [
  {
    opening: "Italian Game",
    opponent: "RookAndRoll (1551)",
    resultBadge: "Win 1-0",
    resultClass: "win",
    movesText: "27 moves · Tactical king hunt",
    orientation: "white",
    pgn: `[Event "Italian Game"]
1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O 7. Nbd2 Qd7 8. g3 Qe7 9. Qe1 Bd7 10. Bb3 Rfd8 11. Qd1 g6 12. g4 Nxg4 13. Qc2 Bxf2+ 14. Kg2 Bc5 15. a3 Na5 16. Bd5 Ne3+ 17. Kf2 Nxd5+ 18. d4 Bxd4+ 19. cxd4 Nf4 20. Qxc7 Nh3+ 21. Ke2 exd4 22. Qxa5 Bb5+ 23. Qxb5 Nf4+ 24. Ke1 Nd3+ 25. Ke2 Nxc1+ 26. Raxc1 h6 27. Nxd4 1-0`,
  },
  {
    opening: "Sicilian Defense: Najdorf",
    opponent: "PawnStorm88 (1569)",
    resultBadge: "Loss 0-1",
    resultClass: "loss",
    movesText: "29 moves · Sharp counterplay",
    orientation: "black",
    pgn: `[Event "Sicilian Defense"]
1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nde2 Nbd7 8. Nb1 Be7 9. Na3 Nxe4 10. g4 Qa5+ 11. b4 Qxa3 12. Rb1 O-O 13. h3 b6 14. h4 Qxa2 15. Rc1 Bxh4 16. Rxh4 b5 17. Rh2 Qb2 18. Rh1 Qxb4+ 19. Nc3 Nxc3 20. Qd3 Nd5+ 21. Bd2 Qxg4 22. Qxd5 Rb8 23. Qxd6 Rb7 24. f3 Qg3+ 25. Kd1 Re8 26. Rh5 Qf2 27. Be2 f5 28. Qxa6 Rc7 29. Qa2+ 1-0`,
  },
  {
    opening: "London System",
    opponent: "KnightOwl_ (1487)",
    resultBadge: "Win 1-0",
    resultClass: "win",
    movesText: "44 moves · Mating attack",
    orientation: "white",
    pgn: `[Event "London System"]
1. d4 Nf6 2. Nf3 e6 3. Bf4 d5 4. e3 c5 5. c3 Nc6 6. Nbd2 Bd6 7. Bg5 cxd4 8. exd4 O-O 9. Bd3 Bxh2 10. Nxh2 Nxd4 11. Bxf6 Qxf6 12. O-O Nc6 13. b3 Rd8 14. Bc2 g5 15. a3 h5 16. Ra2 Qxc3 17. Qxh5 Qc5 18. Qxg5+ Kf8 19. Qh6+ Ke7 20. Qh4+ Kd7 21. Rd1 Rg8 22. b4 Qd6 23. Nb3 a6 24. Qf6 Rf8 25. g3 Na7 26. Qf3 Nc6 27. Nc5+ Kc7 28. Ng4 f5 29. Nh2 Qe5 30. Nxe6+ Qxe6 31. Rxd5 Qxd5 32. Qf4+ Kb6 33. Qe3+ Nd4 34. Qh6+ Kc7 35. Qxf8 Nxc2 36. Rxc2+ Kb8 37. Rxc8+ Ka7 38. Qf6 Qd1+ 39. Nf1 Qb3 40. Rc1 Rg8 41. Qxf5 b6 42. Qh7+ Rg7 43. Qxg7+ Ka8 44. Rc8# 1-0`,
  },
  {
    opening: "French Defense: Tarrasch",
    opponent: "BishopTakes (1467)",
    resultBadge: "Draw ½-½",
    resultClass: "draw",
    movesText: "41 moves · Balanced endgame",
    orientation: "black",
    pgn: `[Event "French Defense"]
1. e4 e6 2. d4 d5 3. Nd2 Nf6 4. e5 Nfd7 5. Bd3 c5 6. c3 Nc6 7. dxc5 Ncxe5 8. Be2 Nxc5 9. Nh3 Be7 10. O-O O-O 11. g4 Ncd7 12. a4 Nc5 13. f4 Nc6 14. Re1 Qd7 15. Rf1 Nxa4 16. Rxa4 Bc5+ 17. Kg2 a5 18. Qe1 g6 19. Qg3 Rb8 20. Bf3 Be7 21. Qe1 Qd6 22. Nb3 f6 23. Qg3 Re8 24. Nf2 h6 25. Qh4 Rd8 26. Qxh6 Bd7 27. Qxg6+ Kf8 28. Qh6+ Kf7 29. Qh5+ Kg7 30. Qh3 b5 31. Ra1 Kg8 32. Nxa5 Nxa5 33. Kg3 Nb3 34. Rb1 Ra8 35. Bxd5 Nxc1 36. Bxa8 Rxa8 37. Rbxc1 Kf8 38. Qh6+ Kg8 39. Ne4 Qd5 40. Nxf6+ Kf7 41. Nxd7 Qd3+ 1/2-1/2`,
  },
  {
    opening: "Queen's Gambit Declined",
    opponent: "QueensideCastle (1540)",
    resultBadge: "Loss 0-1",
    resultClass: "loss",
    movesText: "35 moves · Central clash",
    orientation: "white",
    pgn: `[Event "Queen's Gambit Declined"]
1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 Be7 5. Bf4 O-O 6. e3 c5 7. Bxb8 cxd4 8. exd4 Rxb8 9. Bd3 Bd7 10. cxd5 g5 11. Nxg5 exd5 12. Rb1 Re8 13. a4 Bc5+ 14. Kf1 Bxd4 15. Nxd5 Bxa4 16. Qxa4 Qxd5 17. Bf5 Qxf5 18. Qxd4 Qxb1+ 19. Qd1 Qxb2 20. g4 Nxg4 21. Qxg4 Qa1+ 22. Kg2 Qb2 23. Ne4+ Kf8 24. Nf6 Re7 25. Qh3 Qxf6 26. Qa3 Qc6+ 27. Kg1 Qh6 28. Qb4 Qg7+ 29. Kf1 Qa1+ 30. Kg2 Qg7+ 31. Kh3 Qh6+ 32. Kg2 Qc6+ 33. Kf1 Qa6+ 34. Kg1 Qg6+ 35. Qg4 Qb1+ 0-1`,
  },
];

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

  if (sectionId === "picker-section") {
    section.style.display = "";
    const cardsHtml = SAMPLE_GAMES.map((g) => {
      const preview = extractPreviewFromPgn(g.pgn);
      const safePgn = g.pgn.replace(/"/g, "&quot;");
      return `
        <div class="game-slider-card vertical-game-card" data-pgn="${safePgn}" data-orientation="${g.orientation}" tabindex="0" role="button" aria-label="Review ${g.opening} against ${g.opponent}">
          <div class="game-slider-board-wrapper">
            <div class="game-slider-board-slot">
              ${renderMiniBoardSvg(preview.fen, g.orientation, preview.lastMove)}
            </div>
            <span class="game-slider-move-tag">Hover to play</span>
          </div>
          <div class="game-slider-info">
            <div class="game-card-player">
              <div class="game-card-name-group">
                <span class="game-card-vs">vs</span>
                <strong class="game-card-opponent">${g.opponent}</strong>
              </div>
              <span class="game-slider-badge game-slider-badge-${g.resultClass}">${g.resultBadge}</span>
            </div>
            <div class="game-card-sub">
              <span class="game-card-opening">${g.opening}</span>
              <span class="game-card-meta">${g.movesText}</span>
            </div>
            <button type="button" class="btn btn-primary game-slider-cta" data-empty-cta id="picker-demo-cta-btn" title="Open this game in review">
              Review game
            </button>
          </div>
        </div>
      `;
    }).join("");

    output.innerHTML = `
      <div class="empty-state empty-state-picker-featured">
        <div class="picker-filters-row" role="group" aria-label="Game filters">
          <button type="button" class="picker-filter picker-filter-active" data-picker-filter="all">All <span class="picker-count">5</span></button>
          <button type="button" class="picker-filter" data-picker-filter="win">Wins <span class="picker-count">2</span></button>
          <button type="button" class="picker-filter" data-picker-filter="loss">Losses <span class="picker-count">2</span></button>
          <button type="button" class="picker-filter" data-picker-filter="draw">Draws <span class="picker-count">1</span></button>
          <button type="button" class="picker-filter" data-picker-filter="analyzed">Analyzed <span class="picker-count">5</span></button>
        </div>
        <div class="game-slider-wrap">
          <div class="game-slider-track vertical-slider-track" id="game-slider-track" tabindex="0" role="region" aria-label="Sample games list">
            ${cardsHtml}
          </div>
        </div>
      </div>
    `;
    output.dataset.emptyState = "1";
  } else if (sectionId === "focus-section" || sectionId === "profile-section") {
    section.style.display = "";
    const shortLine =
      sectionId === "focus-section"
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

/** Wire the CTA buttons once: slider arrows, sample game review, jump to sync form. */
export function wireEmptyStateCtas(): void {
  document.addEventListener("click", (e) => {
    const filterBtn = (e.target as HTMLElement).closest<HTMLButtonElement>(".picker-filters-row [data-picker-filter]");
    if (filterBtn) {
      e.stopPropagation();
      const filter = filterBtn.dataset.pickerFilter ?? "all";
      const filterBtns = document.querySelectorAll(".picker-filters-row [data-picker-filter]");
      filterBtns.forEach((btn) => btn.classList.remove("picker-filter-active"));
      filterBtn.classList.add("picker-filter-active");

      const cards = document.querySelectorAll<HTMLElement>("#game-slider-track .vertical-game-card");
      cards.forEach((card) => {
        if (filter === "all" || filter === "analyzed") {
          card.style.display = "";
        } else {
          const badge = card.querySelector(".game-slider-badge");
          const isWin = badge?.classList.contains("game-slider-badge-win");
          const isLoss = badge?.classList.contains("game-slider-badge-loss");
          const isDraw = badge?.classList.contains("game-slider-badge-draw");
          if ((filter === "win" && isWin) || (filter === "loss" && isLoss) || (filter === "draw" && isDraw)) {
            card.style.display = "";
          } else {
            card.style.display = "none";
          }
        }
      });
      return;
    }

    const navBtn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-game-slider-nav]");
    if (navBtn) {
      const dir = Number(navBtn.dataset.gameSliderNav) || 1;
      const track = document.getElementById("game-slider-track");
      if (track) {
        track.scrollBy({ left: dir * 280, behavior: "smooth" });
      }
      return;
    }

    const sampleBtn = (e.target as HTMLElement).closest("#picker-demo-cta-btn, .game-slider-card");
    if (sampleBtn) {
      const demoBtn = document.getElementById("demo-load-btn") as HTMLButtonElement | null;
      if (demoBtn) demoBtn.click();
      return;
    }
    const btn = (e.target as HTMLElement).closest("[data-empty-cta]");
    if (!btn) return;
    document.getElementById("sync-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => document.getElementById("username")?.focus(), 400);
  });
}
