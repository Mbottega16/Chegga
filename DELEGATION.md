# Delegation Plan — Opus down to Haiku

_How work on Michael's projects flows from large agents to small ones. Applies to Chegga, EduSystem, and Notice (see the per-project plans in this folder), and as the default pattern for other projects. Set Nov 23, 2026._

## The ladder

### Tier 1 — Opus-tier (largest models: Opus, frontier equivalents)
Owns judgment.
- Architecture and design decisions (e.g. Chegga's auth/sync design doc).
- Scoping: turning the owner's goals into build-ready task lists.
- Risky reviews: security, privacy, money, anything touching accounts or children's data (Notice sync/roles).
- Merge/release decisions prep and final verification of other tiers' work.
- Keep/fix/drop calls on unknown-state work (e.g. EduSystem's stopped branch).

### Tier 2 — Sonnet-tier (mid models)
Owns implementation.
- Build features from an approved design, in the order the design sets.
- Write and fix tests; debug failures to root cause.
- Refactors that don't change architecture.

### Tier 3 — Haiku-tier (small, fast models)
Owns the mechanical and the measurable.
- Run test suites and report exact counts — never summaries like "mostly passing."
- Inventories: file lists, diffs, branch contents, doc-vs-code drift checks.
- Status checks: live site responds, version matches README, checklist verification.
- Doc updates, formatting, search and retrieval for the upper tiers.

### Tier 0 — Qwen (local, free)
Owns first drafts.
- Summaries, tagging, first-pass drafts of copy and docs.
- Drafts only, into a drafts area; a higher tier reviews before anything ships. Qwen never gets final judgment and never receives work as anything but files.

## Flow rules

1. **Work flows down, questions flow up.** Opus scopes → Sonnet builds → Haiku verifies. When a lower tier hits ambiguity, a design choice, or the same failure twice, it stops and escalates with the evidence, not a guess.
2. **Every handoff is a file.** The receiving agent gets: the task, the relevant plan file, the exact checks to run, and what "done" looks like. No handoff lives only in chat.
3. **Verify at the tier below the builder.** Whoever built it doesn't grade it: Haiku runs the counts, Sonnet reviews Haiku's findings, Opus reviews anything risky.
4. **One proof before a batch.** For repeated similar items, the assigned tier builds one, Opus-tier (or the owner) approves it, then the batch runs.
5. **Owner gates stay owner gates.** Merges to a live branch, public sharing, purchases, and scope changes need Michael's explicit go-ahead regardless of tier. A spoken yes counts; a timed-out approval card means stop, not retry-spam.
6. **Report like the owner likes:** decision-first, real numbers including losses, what was checked, what was excluded and why, what's pending, and the next decision.

## Per-project assignment (week of Nov 23, 2026)

| Project | Opus-tier | Sonnet-tier | Haiku-tier |
|---|---|---|---|
| Chegga | Accounts/sync design doc; security review | Implement approved pieces; fix e2e | Run suites, report counts; live-site checks |
| EduSystem | Branch keep/fix/drop judgment | Phase implementation in Godot | Suite runs; diff inventories |
| Notice | Privacy review of sync/roles; release call | Fix check failures and sharing breaks | Check-suite runs; README/code drift inventory |

Antigravity note: Antigravity agents slot into this ladder by task, not by brand — give an Antigravity agent a tier's task list and the same plan file, and hold it to the same checks and escalation rules.
