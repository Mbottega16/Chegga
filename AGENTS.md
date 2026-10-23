# Chegga — Project Rules, Architecture & Session Handoff

A client-side-only Chess.com & Lichess game analyzer and tactical trainer. Stockfish runs in-browser via WebAssembly in a Web Worker, and all user games, evaluations, and spaced-repetition blunder puzzles live in the visitor's own IndexedDB (`chegga` DB) — zero backend, zero server compute cost.
- **Repo:** `~/OneDrive/Desktop/Chegga` (`EduSystems-Code/Chegga`, private)
- **Active App Directory:** `web/` (Vite + TypeScript SPA, no UI framework runtime)
- **Live Site:** https://chegga-web.vercel.app (auto-deploys from `main` via `vercel.json`)
- **Vault Context & History:** `~/OneDrive/Desktop/AI Projects/my-brain/projects/chegga/context.md` (and `history.md` for older session logs)

---

## Never Read / Noise Zones (Do Not Scan)

To prevent multi-megabyte data blobs and archived legacy apps from slowing down search or eating context tokens, **never read or grep inside**:
- `archive/` — pre-consolidation FastAPI backend + React frontend (archived 2026-08-28), including `archive/backend/data/chegga.db` (265 MB SQLite file).
- `web/public/curated-puzzles.json` — **16.2 MB tracked JSON file** (~99k Lichess CC0 puzzles). Never open or grep this file; inspect `web/src/themedPuzzles.ts` or `curate_puzzles_offline.py` for its schema.
- `web/public/stockfish*` — compiled WASM/JS Stockfish binaries.
- `web/node_modules/`, `web/dist/`, `web/videos/`, `web/playwright-report/`, `web/test-results/`.

---

## Architecture & Module Map (`web/src/`)

Chegga was consolidated on 2026-08-28 so that `web/` is the entire product. On 2026-09-14 the product focus narrowed to making **single-game review** more visually exciting, tactile, and informative than Chess.com or Lichess, while parking 15 broader history/coaching cards behind a `data-coming-soon="true"` gate (still reachable via deep links and `expandCard()`).

| File / Group | Responsibility |
|---|---|
| `main.ts` | App shell, card visibility, `data-coming-soon` folding, event wiring, jump nav. |
| `playBoard.ts` | 2D interactive chessboard, drag/tap move input, keyboard arrow/ARIA navigation (`9297dc9`), candidate move heatmaps & flowing trails (`9f20294`), stepped reticles & NAG glyph badges (`7846a03`). |
| `board3d.ts` | Three.js 360° 3D board (`LatheGeometry` Staunton pieces, orbit/pinch zoom, full-screen overlay, shared CSS theme variables). |
| `engine.ts`, `engineAnalysis.ts` | Web Worker Stockfish UCI bridge (depth 14, MultiPV 3 candidate lines, lazy WASM initialization). |
| `gameReview.ts`, `gameReviewView.ts` | Turn-by-turn review timeline, interactive SVG evaluation curve with scrubbing (`8f5c65b`), clock usage & time-trouble panic visualizer (`c98ab4a`), PGN + NAG export & shareable summary cards (`f6042de`). |
| `gamePicker.ts`, `gamePickerView.ts` | Visual card picker for selecting synced games to review, with instant demo dataset (`b540947`). |
| `moveExplanation.ts`, `classificationColors.ts` | Rule-based tactical explanations (forks, pins, hanging pieces — no LLM API cost) and colorblind-safe move classification palette (Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, Miss, Blunder). |
| `juice.ts`, `soundEffects.ts` | Particle bursts, celebration overlays, and synthesized Web Audio tactile clicks/chimes. |
| `siteSync.ts`, `syncService.ts`, `lichessClient.ts` | Incremental, rate-limited game fetchers for Chess.com Published-Data API and Lichess API. |
| `savedPuzzles.ts`, `puzzleTrainer.ts`, `db.ts` | IndexedDB persistence (`db.ts`, full JSON import/export), blunder-to-puzzle extraction, and Leitner 5-box spaced-repetition mastery (`c98ab4a`). |

---

## Hard Constraints & Traps

1. **VS Code Simple Browser HMR Trap:** Vite HMR causes "dead buttons" when previewing inside VS Code's Simple Browser webview. Always use `npm run dev:vscode` (static build + preview) for Simple Browser, or test in a real browser / Playwright.
2. **Zero Server / Zero LLM Spend:** Everything runs client-side. The Anthropic coaching service is mocked/parked by decision (`ANTHROPIC_API_KEY` unset). Move explanations must stay deterministic and rule-based in `moveExplanation.ts`.
3. **Privacy Pitch vs. Third-Party Widgets:** Chegga's core pitch is "nothing leaves your device." Featurebase and Tally feedback embeds live only in the optional feedback card (`tools-detail.md`).
4. **Accessibility & Colorblind Safety:** Every move classification must pair color from `classificationColors.ts` with its distinct glyph badge (`!!`, `!`, `✦`, `✓`, `?!`, `?`, `??`, `📖`), and board changes must preserve 64-square ARIA labels and keyboard navigation.
5. **Lazy-Load Heavy Assets:** Both Stockfish WASM and `curated-puzzles.json` (16.2 MB) must remain lazy-loaded on first use so initial page load stays ~76 KB gzipped.

---

## Commands & Verification

Run from `web/` (or use root `npm test` / `npm run build` which proxy to `web/`):

```powershell
cd web
npm test               # Vitest unit suite (230+ tests) — MUST pass before any commit
npm run build          # TypeScript typecheck (tsc) + Vite production build
npm run test:smoke     # Playwright E2E smoke suite (review picker, tutorial, sync, mobile)
npm run dev            # Standard Vite dev server
npm run dev:vscode     # Safe preview server for VS Code Simple Browser (no HMR webview bug)
```

---

## Session Handoff (Last Worked On · Current State · Next Up)

- **Last Worked On:**
  - Keyboard accessibility & 64-square ARIA navigation on the chessboard (`9297dc9`).
  - Offline puzzle curation pipeline (`cf08692`, `curate_puzzles_offline.py`).
  - Leitner 5-box spaced-repetition blunder mastery, time-trouble clock panic visualizer, eval curve scrubbing, and PWA service worker offline caching (`c98ab4a`).
  - Interactive opening line drill in Play vs. Bot, review keyboard shortcuts cheat-sheet, PGN/NAG export suite, and candidate-move flowing trails (`f96f5d5`, `f6042de`, `9f20294`).
- **Current State (2026-10-17):**
  - `main` is clean, 230+ unit tests passing, production bundle builds clean and auto-deploys to `https://chegga-web.vercel.app`.
- **What Needs To Be Worked On Next:**
  1. Real-device mobile validation (test touch swipe gestures, 3D board pinch-zoom, and eval-curve scrubbing on physical iOS/Android screens).
  2. High-volume account sync validation on Safari/WebKit IndexedDB (1,000+ game sync batches + background Stockfish queue).
  3. Wire `npm test` into `.git/hooks/pre-push` so unit regressions block pushes automatically.
  4. Optional Vercel project/domain rename from `chegga-web.vercel.app` to `chegga.vercel.app`.
