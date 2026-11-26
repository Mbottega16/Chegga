# Chegga — history

Every session's log, **newest first**. Read on demand, not at startup. The current
snapshot is the Session Handoff at the bottom of `CLAUDE.md`.

**Adding an entry:** at the end of a session, move the old handoff here as a new entry
at the top, then overwrite the handoff. One entry per session, 5–10 lines:

```
## YYYY-MM-DD — <what, in a few words>
*<machine: Mac | PC> · <agent: Claude | Antigravity> · commits `abc1234`*
- **Changed:** what is different now, for the user and in the code.
- **Why:** the ask or the problem, and any decision made (with its reason).
- **Verified:** what was run and what it said; what was NOT checked.
- **Left open:** anything unfinished or waiting on the owner.
```

This repo is public, so private planning notes stay in the owner's vault, not here.

---

## 2026-11-26 — Rebase onto the Mac layout, Desktop launchers, splash logo
*PC · Antigravity · commits `0af4d07`, `0e8b6a5`, `fbb4a48`, `d028319`*
- **Changed:** rebased the PC phone fix for `.review-buttons` (`mobile.css`) onto the Mac's `9eff407` one-screen layout. Added paired Desktop launchers for the default (5174) and playtest (5175) builds, with IPv6 (`::1`) loopback detection. Split Vite's dev `cacheDir` per mode and animated the classic logo bars on the splash.
- **Started, not committed:** review-control icons (`icons.ts`), edge-safe trail curves (`trailGeometry.ts`, `playBoard.ts`), and a two-tab side panel (`studioMenu.ts`). The next session finished them.
- **Verified:** Vitest 371/371 (32 files); `tsc && vite build` clean.
- **Left open:** the UI review list the owner gave (left menu, review buttons, Evaluation Flow, turning points), handed to Claude as a plan in the owner's vault.

## 2026-11-25 / 2026-11-26 — Playtest round, startup splash, and one-screen shell layout
*Mac · Claude · commits `27af3fb`, `2fad757`, `bbdeba0`, `784370d`, `b32e895`, `9eff407`*
- **Changed:** Removed Operating/Playing view toggle (single layout), added Customize/Feedback dialogs, folding right games panel, last-10 list with search, real captured-piece art, new 10-line move heatmap (`renderTrails` in `playBoard.ts`), movetext-based stats load speedup (~4 min -> <5 s), `playtest` seed mode (`npm run dev:playtest`, `fetch-playtest-games.mjs`, `playtestSeed.ts`), `splash.ts` knight startup screen, and `9eff407` one-screen `shell.css` layout commit.
- **Verified (as of `784370d` on Mac):** Vitest 371/371, build clean; `9eff407` committed the 8 remaining working-tree files for handoff to desktop.

## 2026-11-25 — Phone fix for the review buttons; full suite run
*PC · Claude · commit `6ec73bd`*
- **Changed:** `web/src/mobile.css` — `.review-buttons` is a wrapping flex row on phones, not a 4-column grid. "Fix your mistakes" no longer covers "Your worst move".
- **Verified:** Vitest 366/366; build clean; no overlap or overflow at 320/360/390/412 px on Chromium and WebKit; `review-picker` passes on desktop, mobile and WebKit. Full Playwright: 125 passed, 14 failed, 5 skipped.
- **Found, not fixed:** 9 stale `live-verify` tests; `smoke.spec.ts:119` on WebKit; WebKit memory flakes at 2 workers; `sw.js` opens IndexedDB v4 while `db.ts` is v5.

## 2026-11-23 — Front-End Overhaul: Borderless Edge-to-Edge Layout, 2x3 Launchpad, Operating vs. Playing Views & Background Sync
*PC · Antigravity*
- **Changed:** Removed outer card borders and miniature inner borders across Get Connected, Studio Menu, Daily Training Set, and Previously Played Games; expanded `.wrap` to 100% edge-to-edge width; transformed Studio Menu into a 2×3 panel-style launchpad window distinguishing Operating View (`data-orientation="operating"`) from Playing View (`data-orientation="playing"`); simplified Get Connected to heading, `✕`, description, site selector, and username input (removed demo and batch analyze controls); removed redundant Play, Stockfish WASM, and Feedback header buttons; wired while-playing and closed-app Service Worker background sync (`web/src/backgroundSync.ts`, `web/public/sw.js`).
- **Verified:** Vitest 366/366 passed (32 files), `npm run build` clean, Playwright desktop + mobile E2E suites 31/31 passed.

## 2026-11-05 — WAVE Accessibility, Anti-Slop Polish & Studio Menu Fold
*PC · Claude · commits `4d68bc5`, `eeb24d2`, `ee7c593`, `f8946a7`*
- **Changed:** Fixed WAVE errors (empty evict button, SVG `aria-hidden`, redundant titles, lifted `--muted-dim`, 0.75rem font floor, light/OLED dark-repaint fix, dark accent variants for light mode, mobile review grid & 72px board square allowance), removed side-tab stripes and bounce easing off routine controls, and added Studio Menu rail/drawer fold (`studioMenu.ts`).
- **Verified:** Vitest 357 passed, build clean, mobile & desktop review-picker headless flows green.

## 2026-11-04 — 1-Click Graphic Review Card Generator, WCAG 2.1 AA Screen-Reader Live Review & Export Actions

*PC · Antigravity · shareable graphics, accessibility, game review polish*
- **Changed:**
  - Implemented **1-Click Shareable Game Review Card Generator** (`web/src/shareCard.ts`): renders a 1200x675 (16:9) broadcast graphic badge with match metadata, player ratings, opening, large accuracy %, centipawn loss, move quality breakdown, advantage flow curve, and highlighted key turning point.
  - Added Export Card buttons to both `#review-panel` and `#post-game-report` with automated PNG image clipboard copy (`copyReviewCardImage` via `ClipboardItem`) and fallback instant file download (`downloadReviewCardImage`).
  - Added review keyboard shortcut <kbd>G</kbd> for instant review card export alongside <kbd>S</kbd> (text summary), <kbd>C</kbd> (PGN), and <kbd>D</kbd> (download).
  - Added bespoke `iconImage` vector SVG to `web/src/icons.ts`.
  - Implemented **WCAG 2.1 AA Screen-Reader Accessibility** on review steps: enhanced `#review-caption` with `aria-live="polite" aria-atomic="true"`, with dynamic auditory `aria-label` announcing move notation, tactical motif, root cause, and material impact on blunders.
  - Added unit test suite in `web/tests/unit/shareCard.test.ts` (5 tests), expanding unit test count to 357 passing tests (100%).
- **Why:** Delivers 1-click shareable review graphic cards for social sharing / personal save, expands review keyboard accessibility, and completes WCAG 2.1 AA live review compliance for assistive technologies.
- **Verified:** 357 unit tests passing (`npm test`), production build clean in 1.07s (`tsc && vite build`), desktop Playwright smoke suite (12/12) and mobile Playwright smoke suite (12/12) passing.
- **Left open:** Physical device testing for touch responsiveness on real iOS/Android hardware.

## 2026-11-04 — Key Turning Points Storyline Bar, Precomputed Tutorial Evals, Responsive Overflow Fix & E2E Suite Alignment

*PC · Antigravity · review UX, onboarding performance, responsive layout*
- **Changed:**
  - Implemented **Key Turning Points & Storyline Bar** (`computeStorylineMoments` in `web/src/gameReview.ts`, `renderStorylineBar` in `web/src/gameReviewView.ts`, styled in `web/src/style.css`): automatically identifies the decisive game pivot, blunders, brilliancies, and major tactical swings. Renders a chronological chip bar (`.review-storyline-container`, `.storyline-chip`) below the eval graph where clicking any moment jumps the board and timeline directly to that critical move.
  - Built precomputed evaluation and candidate lookup cache (`web/src/tutorialEvalCache.ts`, seeded into `candidateAnalysis.ts`) pre-filling depth-14 candidate lines for onboarding and sample positions, making example game review load instantaneously.
  - Fixed responsive mobile viewport layout blowout: resolved 210px horizontal overflow at `<1040px` viewports in `web/src/style.css` by resetting grid children to `grid-column: 1 !important; grid-row: auto !important;` with `min-width: 0; max-width: 100%`.
  - Fixed HTML strict-mode duplicate ID bug across 5 sample game cards in `web/src/emptyStates.ts`.
  - Updated Playwright E2E smoke tests in `web/tests/e2e/smoke.spec.ts` and `web/tests/e2e/live-verify.spec.ts` for the 3-column studio layout, getting 100% of desktop (26/26) and mobile (24/24) checks green.
  - Configured Vite `chunkSizeWarningLimit: 650` for lazy-loaded Three.js `board3d.ts`.
- **Why:** Full push across Chegga: aligning E2E smoke verification with the recent studio overhaul, resolving mobile scroll overflow, accelerating onboarding, and delivering interactive game turning points for game review.
- **Verified:** 352 unit tests passing (`npm test`), production build clean (`tsc && vite build`), Playwright desktop smoke suite passing (26/26), and Playwright mobile smoke suite passing (24/24).
- **Left open:** Physical device testing for touch responsiveness on real iOS/Android hardware.

## 2026-10-29 — Tactical Motif Engine, Blunder DNA, Punishment Refutation & Habit Mirror

*PC · Antigravity · analytics & cognitive UX*
- **Changed:**
  - Expanded `web/src/blunderTagger.ts` with deterministic tactical motif detection (`fork`, `pin`, `skewer`, `back_rank`, `trapped_piece`) alongside `hung_material`, `missed_mate`, `allowed_mate`, and `missed_capture`.
  - Built the **Blunder DNA** extraction engine delivering a structured breakdown: Motif, Root Cause (Time Rush $\le 2.5$s, Clock Panic $\le 10$s, Tunnel Vision, or Tactical Blindspot), and Centipawn/Piece Damage.
  - Added visual **Blunder DNA Capsule** (`.blunder-dna-capsule`, `.dna-pill`) displayed directly above the review board on mistakes and blunders.
  - Implemented **Interactive Punishment Refutation Trail** (`#review-punishment`): one-click toggle to play the opponent's punishment on the board with refutation trail arrow, source indicator, and instant toggle back to played position.
  - Added **Geometric Threat Radar** (`#review-threat-radar`): toggles high-contrast tactical tension laser arrows from attackers to victims.
  - Built **The Thinking Sweet Spot** (`computeThinkingSweetSpot` in `gamePatterns.ts`) analyzing move accuracy and blunder penalties across 6 time-spent intervals, rendered with an interactive pace chart in `profileView.ts`.
  - Built **The Mirror of Habits & Error Spiral Index** (`computeTiltIndex`, `computeMirrorOfHabits`): aggregates recurring motif leaks, detects tilt blunder streaks, flags most endangered pieces, and provides a 1-click **Train This Leak ⚔️** action that jumps directly into the Leitner trainer focused on that motif.
- **Why:** Owner requested deeper chess insights beyond centipawns and better visual representation of blunders, mistakes, and recurring player habits.
- **Verified:** 349 unit tests passing across 30 files (`npm test`), production build passing cleanly (`tsc && vite build`), and Playwright E2E smoke suite 100% green (24/24 tests across desktop and mobile profiles).
- **Left open:** Real-device mobile validation and high-volume Safari/WebKit IndexedDB batch testing.

## 2026-10-29 — responsive iPhone & desktop overhaul with light, dark, OLED modes and accent customization

*PC · Antigravity · front-end overhaul & design*
- **Changed:**
  - Added theme and color customization engine (`web/src/theme.ts`) supporting **Dark Mode** (default broadcast studio), **Light Mode** (high-contrast daylight paper with crisp borders), **OLED Black** (`#000000` power saver), and **System Auto** mode.
  - Implemented 6 Studio Accent Color themes (`amber` Studio Gold, `emerald`, `sapphire`, `ruby`, `amethyst`, `cyan` Cyber Cyan) with reactive board aura lighting, badge accents, and focus rings.
  - Added one-click `#theme-toggle-btn` in header for instant mode switching, and a dedicated "Appearance & Theme" block with mode selector pills and interactive accent color swatches in the `⚙ Settings` popover (`.studio-settings-popover`).
  - Optimized for mobile/iPhone and small viewports: added `viewport-fit=cover`, safe-area insets (`env(safe-area-inset-top/bottom)`), dynamic chessboard scaling to viewport width (`min(100vw - 24px, 480px)`), 44px touch targets on review steppers and buttons, horizontal swipeable mini-board game picker, floating settings sheet on phones, and increased mobile jump-nav `scroll-margin-top` to 68px.
  - Added anti-flash inline script in `web/index.html` and 6 automated unit tests in `web/tests/unit/theme.test.ts`.
- **Why:** Responsive design pass across all devices (iPhone, iPad, desktop) and complete visual customization requested by owner.
- **Verified:** 338 unit tests passing (`npm test`), production build passing cleanly (`tsc && vite build`), and Playwright E2E smoke tests passing 100% on both mobile and desktop profiles (12/12 mobile, 12/12 desktop).
- **Left open:** Physical device testing for touch responsiveness on real iOS/Android hardware.

## 2026-10-29 — cross-platform pre-push verification git hook wired

*PC · Antigravity · git hooks & tooling*
- **Changed:** Created tracked cross-platform `.githooks/pre-push` gate and updated `.git/hooks/pre-push` to forward to it (with local `git config core.hooksPath .githooks` configured). Added wrapper scripts `scripts/pre-push.sh` and `scripts/pre-push.ps1`, and added `pre-push`, `verify`, and `test:smoke` scripts to root `package.json`. The hook executes `npm test` (332 Vitest unit tests across 27 files) and `npm run build` (`tsc && vite build`), handles POSIX/Windows/macOS PATH resolution, skips branch deletions, and exits with non-zero code on failure. Supports `CHEGGA_SKIP_PRE_PUSH=1` and optional `CHEGGA_RUN_SMOKE=1` desktop Playwright smoke verification.
- **Why:** Prevent pushing regressions or broken builds to GitHub. Closes the longstanding Next Up item in `CLAUDE.md`.
- **Verified:** Tested `git push --dry-run` (both clean pass and intentional assertion failure in `timePressure.test.ts` blocking push with exit code 1), verified `CHEGGA_SKIP_PRE_PUSH=1` escape hatch, and tested `powershell -File scripts/pre-push.ps1`, `npm run pre-push`, `npm test` (332/332 passed in 4.99s), and `npm run build` (built in 1.58s).
- **Left open:** None for this task. Real-device mobile validation and Safari/WebKit high-volume sync remain on the backlog.

## 2026-10-28 — Broadcast Chess Studio front-end overhaul & declutter

*PC · Antigravity · Broadcast Studio UI*
- **Changed:** Overhauled the front end (`main.ts`, `style.css`, `gamePicker.ts`, `gamePickerView.ts`, `gameReviewView.ts`, `emptyStates.ts`, `todayView.ts`, `profileView.ts`) from a narrow `960px` single-column stack of 29 uniform grey panels into a `1360px` **Broadcast Chess Studio** split-stage workspace. Added `heroArt.ts` (animated SVG tactical board showcase with MultiPV Bezier trails and floating classification callouts) and `miniBoardSvg.ts` (8×8 vector mini-board previews with last-move highlights for Game Picker and Saved Positions cards, plus 5-pip Leitner mastery bars). Added reactive board stage aura lighting (`--stage-aura`), glowing SVG evaluation curve with time-trouble heat bands, circular SVG progress ring in `todayView.ts`, radial move-quality donut chart + 2×2 bento layout in `profileView.ts`, compact `⚙ Settings` board drawer, and stripped redundant `.tagline` text walls across all cards.
- **Why:** Owner requested a complete graphic design and visual effects overhaul focused on decluttering the panel-heavy, text-block UI into an intuitive, visual website for both new and experienced players.
- **Verified:** `npm run build` (`tsc && vite build`), `npm test` (27 test files, 332 unit tests passing including `studioVisuals.test.ts`), and Playwright E2E suite (`smoke.spec.ts` + `review-picker.spec.ts`, 28/28 Chromium desktop & mobile tests passing).
- **Left open:** Real-device mobile validation, high-volume Safari/WebKit IndexedDB sync testing, and wiring `pre-push` git hook.

## 2026-10-24 — docs restructured to the uniform standard

*Mac · Claude · docs only, no code touched*
- **Changed:** `CLAUDE.md` now opens with the big picture and follows the standard seven sections; the product's settled decisions moved in. Corrected: the repo is `Mbottega16/Chegga` and public (the old file said `EduSystems-Code/Chegga`, private), and the `pre-push` test hook is not wired yet. This file is new.
- **Why:** one structure across every repo — a short always-read file, and a log read only when needed.
- **Verified:** every line of the old `CLAUDE.md` checked against the new files. No code changed, so `npm test` was not re-run.
- **Left open:** none.

## 2026-10-17 — the state recorded in the old handoff

*From the old `CLAUDE.md`, word for word:*

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

## Before 2026-10-17

See `git log`. Earlier session notes are kept privately in the owner's vault.
