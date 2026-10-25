# Chegga — rules & map (read this first)

A client-side-only Chess.com & Lichess game analyzer and tactical trainer. Stockfish runs in-browser via WebAssembly in a Web Worker, and all user games, evaluations, and spaced-repetition blunder puzzles live in the visitor's own IndexedDB (`chegga` DB) — zero backend, zero server compute cost.

**History:** [`HISTORY.md`](HISTORY.md), newest first — read it when a task touches past work.
**Business side:** the owner's my-brain vault, `projects/chegga/context.md`.
- **Repo:** PC `~/OneDrive/Desktop/Chegga`, Mac `projects/chegga/app` in the vault (GitHub `Mbottega16/Chegga`, **public**)
- **Active App Directory:** `web/` (Vite + TypeScript SPA, no UI framework runtime)
- **Live Site:** https://chegga-web.vercel.app (auto-deploys from `main` via `vercel.json`)

## What this is
- **What:** connect a Chess.com or Lichess username and review your games client-side —
  move classifications with real visual weight, candidate-move heatmaps, an evaluation
  curve, tactical explanations, plus training built on your own games (blunder puzzles
  with Leitner spaced repetition, a ~99k-puzzle CC0 Lichess library, play vs. bot).
- **The pitch (narrowed 2026-09-14):** **the single-game review moment, made more exciting,
  tactile and informative than Chess.com's or Lichess's game review.** The broader
  history/coaching cards are built but parked behind a "Coming soon" gate.
- **For:** any Chess.com or Lichess player who wants a better look at their own games.
- **Platform:** a static web app on Vercel. Free; nothing leaves the visitor's device.
- **What "done" looks like:** a review screen that feels better than the big sites', proven
  on real phones and real large accounts.

## Settled decisions (don't re-argue)
- **Trainer/analyzer first, coach later.** Everything is concrete, computer-visible data. A
  Claude "coach" voice is deferred to a possible phase 2, gated on a real cost decision —
  `ANTHROPIC_API_KEY` stays unset.
- **Browser, not a desktop app:** WASM Stockfish in the visitor's own tab; no server engine.
- **API only, never scrape Chess.com** — serial requests, no bursts.
- **Centipawn-loss thresholds are this project's own tunable convention**, not an imported
  standard. Blunder "why" tags are a heuristic, not a full static-exchange evaluator.
- **The strength estimate is honest about being small-sample** — a Ridge regression frozen into
  a JS constant, labelled a rough estimate with its real cross-validation score shown.
- **Chess piece/board art is original or properly licensed and attributed** — never a copy of
  Chess.com's piece set or board skin.
- **Parked, not cut:** 15 broader cards carry `data-coming-soon="true"`; every deep link into
  them still works because `expandCard()` clears the gate on its target first.
- **Tests before every push** is the intent; the `pre-push` hook is not wired yet (Next Up).

## How it's built

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

The demo dataset is **generated, never hand-edited**: `web/scripts/generate-demo-data.mjs`
writes `web/public/demo-data.json` and refuses to write unless every growth card's data gate
still clears.

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

## Never Read / Noise Zones (Do Not Scan)

To prevent multi-megabyte data blobs and archived legacy apps from slowing down search or eating context tokens, **never read or grep inside**:
- `archive/` — pre-consolidation FastAPI backend + React frontend (archived 2026-08-28), including `archive/backend/data/chegga.db` (265 MB SQLite file).
- `web/public/curated-puzzles.json` — **16.2 MB tracked JSON file** (~99k Lichess CC0 puzzles). Never open or grep this file; inspect `web/src/themedPuzzles.ts` or `curate_puzzles_offline.py` for its schema.
- `web/public/stockfish*` — compiled WASM/JS Stockfish binaries.
- `web/node_modules/`, `web/dist/`, `web/videos/`, `web/playwright-report/`, `web/test-results/`.

## Rules & Gotchas

1. **VS Code Simple Browser HMR Trap:** Vite HMR causes "dead buttons" when previewing inside VS Code's Simple Browser webview. Always use `npm run dev:vscode` (static build + preview) for Simple Browser, or test in a real browser / Playwright.
2. **Zero Server / Zero LLM Spend:** Everything runs client-side. The Anthropic coaching service is mocked/parked by decision (`ANTHROPIC_API_KEY` unset). Move explanations must stay deterministic and rule-based in `moveExplanation.ts`.
3. **Privacy Pitch vs. Third-Party Widgets:** Chegga's core pitch is "nothing leaves your device." Featurebase and Tally feedback embeds live only in the optional feedback card.
4. **Accessibility & Colorblind Safety:** Every move classification must pair color from `classificationColors.ts` with its distinct glyph badge (`!!`, `!`, `✦`, `✓`, `?!`, `?`, `??`, `📖`), and board changes must preserve 64-square ARIA labels and keyboard navigation.
5. **Lazy-Load Heavy Assets:** Both Stockfish WASM and `curated-puzzles.json` (16.2 MB) must remain lazy-loaded on first use so initial page load stays ~76 KB gzipped.
6. **Three different heatmaps — don't conflate them:** the play-vs-bot **square control**
   heatmap (attacked squares), the **move-by-move heatmap** card (a cross-game view), and the
   review's **candidate-move** heatmap (MultiPV per position).
7. **WebKit is ~250x slower at IndexedDB writes** than Chromium (~16 ms per `put`), and
   batching does not help. A Safari user importing a big backup pays that per record.
8. **This repo is public:** keep private business notes in the owner's vault, not here.

## Session Handoff (Last Worked On · Current State · Next Up)

*Overwrite this at the end of every session; move the previous handoff into `HISTORY.md` first.*

- **Last Worked On:** keyboard accessibility and 64-square ARIA navigation on the board
  (`9297dc9`), the offline puzzle curation pipeline (`cf08692`), Leitner 5-box mastery, the
  time-trouble visualizer, eval-curve scrubbing and PWA offline caching (`c98ab4a`). Docs
  restructured 2026-10-24 (no code change).
- **Current State (2026-10-17):**
  - `main` is clean, 230+ unit tests passing, production bundle builds clean and auto-deploys to `https://chegga-web.vercel.app`.
- **Next Up:**
  1. Real-device mobile validation (test touch swipe gestures, 3D board pinch-zoom, and eval-curve scrubbing on physical iOS/Android screens).
  2. High-volume account sync validation on Safari/WebKit IndexedDB (1,000+ game sync batches + background Stockfish queue).
  3. Wire `npm test` into `.git/hooks/pre-push` so unit regressions block pushes automatically.
  4. Optional Vercel project/domain rename from `chegga-web.vercel.app` to `chegga.vercel.app`.
