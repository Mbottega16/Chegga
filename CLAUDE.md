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
  history/coaching tools live on their own screen, the **Studio Lab** (19 tools, launched
  2026-11-27).
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
- **The Studio Lab is launched (owner, 2026-11-27):** the 15 cards once parked behind "Coming
  soon" are tools again, plus Tactical motifs, Blunder DNA, Time trouble and two cards that
  had no tile (Game patterns, Redeem a loss). No `data-coming-soon` gate remains. The lab shows
  one tool at a time at its own address (`#open=<card id>`); the review stays the front page.
- **Tests before every push** is wired via tracked `.githooks/pre-push` and `.git/hooks/pre-push` (`npm test` + `npm run build`). Escape hatch: `git push --no-verify` or `CHEGGA_SKIP_PRE_PUSH=1`.

## How it's built

Chegga was consolidated on 2026-08-28 so that `web/` is the entire product. On 2026-09-14 the product focus narrowed to making **single-game review** more visually exciting, tactile, and informative than Chess.com or Lichess; the broader history/coaching cards were parked, then launched again on 2026-11-27 as the Studio Lab's tools.

| File / Group | Responsibility |
|---|---|
| `main.ts`, `heroArt.ts` | Broadcast Studio `1360px` split-stage shell, SVG hero tactical showcase (`heroArt.ts`), reactive `--stage-aura` board lighting, `⚙ Settings` popover drawer, and sticky mode dock. |
| `labTools.ts`, `labView.ts`, `lab.css` | The Studio Lab: the tool list (19 tools in four groups, one entry per card: name = the card's `<h2>`, what it needs), and one open tool at a time. `studioMenu.ts`'s `showViewFor()` sets the lab's `data-tool`; every route into a tool passes through it. Tiles are links (`#open=<card id>`), so Back closes a tool. |
| `tacticalMotifs.ts`, `blunderDnaProfile.ts`, `clockLeaks.ts` (+ `*View.ts`, `labFormat.ts`) | The three lab tools that read stored analysis: mistakes sorted by tactic (with Lichess themes to train each), where mistakes cluster (piece, phase, score, clock), and how the clock changes move quality (bands, time spent, games lost on time). Plain counting, no engine calls. |
| `playBoard.ts` | 2D interactive chessboard, drag/tap move input, keyboard arrow/ARIA navigation (`9297dc9`), candidate move heatmaps & flowing trails (`9f20294`), stepped reticles & NAG glyph badges (`7846a03`). |
| `board3d.ts` | Three.js 360° 3D board (`LatheGeometry` Staunton pieces, orbit/pinch zoom, full-screen overlay, shared CSS theme variables). |
| `engine.ts`, `engineAnalysis.ts` | Web Worker Stockfish UCI bridge (depth 14, MultiPV 3 candidate lines, lazy WASM initialization). |
| `gameReview.ts`, `gameReviewView.ts` | Turn-by-turn review timeline, broadcast classification banner, glowing SVG evaluation curve with time-trouble heat bands & scrubbing (`8f5c65b`, `c98ab4a`), PGN + NAG export & shareable summary cards (`f6042de`). |
| `gamePicker.ts`, `gamePickerView.ts`, `miniBoardSvg.ts`, `opponentAvatars.ts` | Visual card picker with 8×8 SVG mini-board position previews (`miniBoardSvg.ts`), result/status badges, 5-pip Leitner mastery meters on Saved Positions, and instant demo dataset (`b540947`). The last-10 list shows each Chess.com opponent's profile picture (`opponentAvatars.ts`), initials otherwise. |
| `todayView.ts`, `profileView.ts`, `emptyStates.ts` | SVG circular daily training ring (`todayView.ts`), radial move-quality donut chart + 2×2 bento analytics (`profileView.ts`), and graphic SVG empty-state illustrations (`emptyStates.ts`). |
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
npm test               # Vitest unit suite (447 tests) — MUST pass before any commit
npm run build          # TypeScript typecheck (tsc) + Vite production build
npm run test:smoke     # Playwright E2E smoke suite (review picker, tutorial, sync, mobile)
npm run pre-push       # Full pre-push gate (npm test && npm run build) — runs automatically on git push
npm run dev            # Standard Vite dev server
npm run dev:vscode     # Safe preview server for VS Code Simple Browser (no HMR webview bug)
npm run dev:playtest   # Playtest build (port 5175), opens with the games in web/playtest/
```

**Playtest site** (`chegga-michael` on Vercel, manual deploy; `web/playtest/` is gitignored):
`node scripts/fetch-playtest-games.mjs <username>` (refreshes games), then
`npx vite build --mode playtest --outDir <tmp>/chegga-michael`, add a `vercel.json` there that sends
`X-Robots-Tag: noindex`, and run `vercel deploy --prod --yes` from that folder.

## Never Read / Noise Zones (Do Not Scan)

To prevent multi-megabyte data blobs and archived legacy apps from slowing down search or eating context tokens, **never read or grep inside**:
- `archive/` — pre-consolidation FastAPI backend + React frontend (archived 2026-08-28), including `archive/backend/data/chegga.db` (265 MB SQLite file).
- `web/public/curated-puzzles.json` — **16.2 MB tracked JSON file** (~99k Lichess CC0 puzzles). Never open or grep this file; inspect `web/src/themedPuzzles.ts` or `curate_puzzles_offline.py` for its schema.
- `web/public/stockfish*` — compiled WASM/JS Stockfish binaries.
- `web/node_modules/`, `web/dist/`, `web/videos/`, `web/playwright-report/`, `web/test-results/`.

## Rules & Gotchas

1. **VS Code Simple Browser HMR Trap:** Vite HMR causes "dead buttons" when previewing inside VS Code's Simple Browser webview. Always use `npm run dev:vscode` (static build + preview) for Simple Browser, or test in a real browser / Playwright.
2. **Zero Server / Zero LLM Spend:** Everything runs client-side. The Anthropic coaching service is mocked/parked by decision (`ANTHROPIC_API_KEY` unset). Move explanations must stay deterministic and rule-based in `moveExplanation.ts`.
3. **Privacy Pitch vs. Third-Party Widgets:** Chegga's core pitch is "nothing leaves your device." Featurebase and Tally feedback embeds live only in the optional feedback card. Opponent pictures are the one image the app loads from another site: Chess.com's own image server, sent with no referrer, looked up one at a time and cached for a week (`opponentAvatars.ts`). Lichess has no pictures.
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

- **Last Worked On (2026-11-27, PC, Claude):** every "Coming soon" feature launched as the **Studio Lab** (owner's ask). Commits `426a8f8`…`8cbee72` say what changed and why.
  - Menu → **Studio Lab** (`#lab-section`): 19 tools in four groups. Tiles are links (`#open=<card id>`) with text and a status; one tool shows at a time under "All tools"; Back works; a tool with nothing to show says what it needs.
  - New: **Tactical motifs**, **Blunder DNA**, **Time trouble** (`tacticalMotifs.ts`, `blunderDnaProfile.ts`, `clockLeaks.ts`). Fixed: tile/card names, Endgame drills off screen, puzzle and vision auto-load, "Review the slip" in Games you didn't convert, stale copy.
- **Current State:** Vitest 447/447; build clean. Full Playwright (3 projects, 2 workers): 175 passed, 2 failed, 9 skipped. Both failures WebKit: `studio-layout.spec.ts:160` passed alone (memory flake, 0.2 GB free); `lichess-history.spec.ts:72` fails on the pre-session build too. After the last fixes, the lab and touched specs: 93 passed, 9 skipped. The old `tutorial:282`, `opening-insight:170` and stale `live-verify` failures are fixed.
  - **Known defect (unchanged):** `web/public/sw.js` opens IndexedDB at version 4 (`db.ts` is 5), and its config key does not fit `syncState`. Closed-app background sync cannot work.
- **Next Up:**
  1. Owner playtest of the Studio Lab on real games (`npm run dev:playtest`, port 5175).
  2. `lichess-history.spec.ts:72` on WebKit: raise its budget or shrink its game count.
  3. Fix the `sw.js` IndexedDB version and config storage.
  4. Real-phone check: heatmap, 3D pinch-zoom, eval-curve scrubbing, large-account sync on Safari.
  5. `REQUIREMENTS.md` work, in the order `PLAN.md` sets (Player model: PARTIAL, this browser only).
