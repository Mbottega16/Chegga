# Chegga — Agent Plan

_For any agent picking up Chegga. Read this first, assess the stage with the checks below, then work the plan. Owner: Michael. Week target set Nov 23, 2026: share-ready v1 by Sun Nov 29, 2026._

## What it is

Chess training site. Live at https://chegga-web.vercel.app, auto-deploys from `main` in `Mbottega16/Chegga`. **Not officially shared yet** — no public audience. Static site today: no backend, no accounts; games and data live in the browser that played them.

## Stage assessment — run these checks before claiming a stage

1. Is `REQUIREMENTS.md` in the repo root? (Written Nov 23, 2026; push was pending owner approval.) If absent, the requirements brief has not landed yet.
2. Run the full test suite (unit + Playwright e2e). Last full Mac run (Nov 10): 140 passed, 5 skipped, 2 failed — the review-picker failed at the practice step on phone screens; a one-file CSS fix was pushed Nov 11 (`f8946a78`). The e2e re-run on the Mac is still owed; until it passes, the stage is "fix shipped, unverified."
3. Does any account/auth code exist? If no, Requirements 1–3 (accounts, sync, player model) are all still at zero — they are design-stage, not build-stage.
4. Is the heat map finished? Check the move-visualization code for a completed heat map view; the owner says it is not finished.

**Current stage (Nov 23, 2026):** polished static v1, unverified e2e, requirements defined, backend not started.

## Week plan (to Sun Nov 29)

1. Land `REQUIREMENTS.md` in the repo (owner approval for the push).
2. Mac e2e re-run green; update the repo `AGENTS.md` handoff with the result.
3. Accounts + sync: produce a design doc (auth choice, data model for games, sync conflict rules, in-browser and out-of-browser review flows) for owner approval before any build.
4. Scope the heat map finish and palette pass as build-ready task lists (no build until design doc is approved).

## How to better it (priority order from REQUIREMENTS.md)

Accounts/sync backend → player model (blunder patterns, targeted drills) → heat map + palette → ads/sponsors + merch last (needs an audience).

## Delegation tiers for this project

- **Opus-tier:** auth/sync architecture, data model, security review, the design doc, final review of anything touching accounts.
- **Sonnet-tier:** implement approved design pieces, write tests, debug e2e failures.
- **Haiku-tier:** run test suites and report exact counts, inventory files, update status docs, check the live site responds.
- **Qwen (local):** first drafts of copy and doc summaries only; never code that ships unreviewed.

## Guardrails

- `main` auto-deploys live — nothing merges without tests green and owner go-ahead.
- Never regress passing tests. Report real numbers, including failures.
- Scope, pricing, or account decisions go back to the owner.
