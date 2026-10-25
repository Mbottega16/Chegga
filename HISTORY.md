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
