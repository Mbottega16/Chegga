# Chegga — Product Requirements & Status

_Written Nov 23, 2026 by Michael (owner) via Rin. This file is the working brief for whoever builds next (Antigravity, while Claude usage is paused)._

## Context

- Chegga is a chess training site, live at https://chegga-web.vercel.app (auto-deploys from `main`).
- It is **not officially shared yet** — no public audience. The current push is to get it share-ready.
- Today it is a static site with **no backend and no accounts**. Games and data live in the browser where they were played (local storage). Per-game review exists; nothing syncs.

## Requirements (owner's list, Nov 23, 2026)

### 1. Accounts across devices and browsers — NOT STARTED
- [ ] Users can create an account and sign in on any device/browser (Safari, Chrome, etc.).
- [ ] This is the foundation: sync, the player model, and data tracking all depend on it.

### 2. Game sync, in and out of the browser — NOT STARTED
- [ ] Games can be synced and reviewed while the app is running in the browser.
- [ ] Games can also be synced/reviewed outside the browser session (i.e. games played elsewhere or earlier are available after sign-in, on any device).
- [ ] The sync process itself should be optimized — fast, reliable, no duplicate or lost games.

### 3. Player model — train against yourself — NOT STARTED
- [ ] Build a model of how the individual user plays from their synced games.
- [ ] Identify their common blunders and recurring mistakes.
- [ ] Provide a way to program/drill improvement in those specific weak areas (targeted training generated from the user's own patterns).

### 4. Move visualization + heat map — IN PROGRESS
- [ ] Better polish on move visualization generally.
- [ ] Finish the heat map graphic showing which decisions are best in a given position. (Current heat map is not finished — owner flagged this directly.)

### 5. Game data tracking — PARTIAL
- [ ] Implement and track data from games (results, mistakes, trends over time).
- [ ] Currently local-only; should move server-side once accounts exist (Requirement 1).

### 6. Ad space and sponsors — NOT STARTED
- [ ] Designated place(s) on the site for ads and sponsor placements. None exist today.
- [ ] Keep placements tasteful and out of the training flow.

### 7. Color design and palette — REOPENED
- [ ] A polished color design/palette. A light-theme / anti-slop pass was done in Nov 2026, but the owner does not feel it looks good yet — treat this as open work, not done.

### 8. Merch — NOT STARTED
- [ ] A place on the site for merch (link-out to a store is acceptable as a first step).

### 9. Other connectors — NOT STARTED / UNSCOPED
- [ ] Potential additional connectors/integrations (e.g. importing games from external chess platforms would fit the sync goal — to be scoped with the owner).

## Suggested build order

1. **Accounts + sync backend** (Requirements 1, 2, 5) — everything else depends on this.
2. **Player model + targeted drills** (Requirement 3) — the core differentiator, needs synced game data.
3. **Heat map finish + palette polish** (Requirements 4, 7) — visible wins, can overlap with 1–2.
4. **Ads/sponsors + merch** (Requirements 6, 8) — last; they need an audience, and the site is not shared yet.

## Working rules

- `main` auto-deploys to the live site — verify changes before merging.
- Run the existing test suite before and after changes; do not regress passing tests.
- Update the Status column notes in this file as items move, so the next builder (human or AI) can see where things stand.
- Scope questions and anything touching accounts/payments go back to the owner before building.
