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
