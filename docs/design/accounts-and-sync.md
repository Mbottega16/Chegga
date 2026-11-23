# Accounts and cross-device sync — design draft

Status: **v3, build started on `feature/accounts-sync-2026-11-23` (Nov 23, 2026).** Owner chose: option A (sign-in optional, local-only stays default), magic link auth first, Vercel for all backend, server-side import outside the browser, and the Nov 29 target stays. Still to confirm before build: the email sender and the Vercel Postgres provider (see section 11). No accounts, payments, or backend code is built yet. Covers Requirements 1, 2, and 5 in `REQUIREMENTS.md`. Tier: Opus-tier design per `DELEGATION.md`.

## 1. Current state (verified in code)

- The app is a static Vite SPA. `vercel.json` builds `web/dist` and serves it. There is no API.
- All user data lives in the browser's IndexedDB, DB `chegga-web`, schema v5 (`web/src/db.ts`). Stores: `games`, `moveAnalysis`, `syncState`, `skillSnapshots`, `curatedPuzzles`, `rivalSnapshots`, `savedPuzzles`.
- Game keys are global, not per user: `chessComUuid` for Chess.com, and `lichess:<id>` for Lichess (`lichessNormalizer.ts`). A `username` field records which tracked account the game came from.
- Chess.com sync is month-by-month, serial, and resumable (`syncService.ts`, `syncState`). Lichess sync is "newest N, then only newer" (`siteSync.ts`, `lichessClient.ts`).
- Stockfish runs in the browser. Move analysis is computed on the device and stored in `moveAnalysis`.
- Export and import exist as a single JSON file (`exportAllData` / `importAllData` in `db.ts`). This is the only copy of data that a visitor has.
- "Sync" in `syncService.ts`, `siteSync.ts`, and `backgroundSync.ts` means importing games from Chess.com or Lichess into the browser. It is not account sync.

## 2. The main decision: the privacy pitch

`CLAUDE.md` makes three settled decisions that accounts and server sync would reverse:

1. "Nothing leaves your device" is the core pitch.
2. "Zero server, zero LLM spend." Everything runs client-side.
3. Browser only, with no server engine.

Accounts and cross-device sync need a server to hold data. That means the pitch changes to something like "your data is stored on our server, encrypted in transit, and you can delete it." **The owner must decide this before any build.** Options:

- **A. Accounts are optional, and sync is opt-in.** The local-only mode stays the default. Signing in adds sync. This keeps the pitch true for anyone who does not sign in. *(Recommended.)*
- **B. Accounts are required for any saved data.** Simpler, but it reverses the pitch for everyone.
- **C. Keep local-only.** Requirements 1 and 2 are dropped or moved to a later phase.

**Decided: option A.** Sign-in is optional. Local-only stays the default.

## 3. Auth

Requirement: sign in on any device and any browser (Safari, Chrome, and others).

| Option | Pros | Cons |
|---|---|---|
| Email magic link | Works in every browser. No passwords to store. | Depends on email delivery. Needs a mail sender. |
| Google / Apple sign-in (OAuth) | Fast. Little friction. | Adds a provider dependency. Apple sign-in has setup cost. |
| Passkeys | Strong and passwordless. | Weaker fallback story. More browser differences. |

**Decided: magic link first.** Google sign-in comes later. The email sender still needs a choice and a pricing check.

Rules:
- Sessions use an `HttpOnly`, `Secure`, `SameSite=Lax` cookie. The app never stores a token in `localStorage`.
- Accounts store only the email and a user ID. No other personal data.
- Account deletion removes all server data for that user, in one step.

## 4. Backend

**Decided: Vercel for all backend.** The stack is:
- **Vercel functions** (`web/api/`) for auth, sync, and the scheduled import job.
- **Postgres via the Vercel Marketplace, Neon free plan.** Vercel Postgres is discontinued; its databases moved to Neon. Neon's free plan is the default. Check its limits before launch. One open report on the Vercel community forum describes a small unexpected Marketplace charge on a free-tier account (Oct 2026); watch billing.
- **Vercel Cron** for the server-side import job.
- **Login emails via Resend, free plan** (3,000 emails/month, 100/day, 1 domain). Upgrade to Pro ($20/mo) if daily volume passes 100.
- **Magic-link auth built by us.** Hashed single-use tokens, expiring in 15 minutes. Sessions in an `HttpOnly` cookie.

Access control must be enforced in code, since there is no managed row-level layer:
- Every query runs with the signed-in `user_id` from the session. Never from the request body.
- A test proves user A cannot read or write user B's games, for each endpoint.

Vercel config changes needed: `vercel.json` must add the functions directory and the cron schedule. The build command stays. Main auto-deploys, so all of this goes on a feature branch with a preview first.

## 5. Data model (server)

All tables have `user_id`. Every query filters by it.

- **users**: `id`, `email`, `created_at`.
- **linked_accounts**: `user_id`, `site` (`chesscom` | `lichess`), `username`, `linked_at`. A user can link more than one account.
- **games**: `id`, `user_id`, `source_id` (the `chessComUuid` or `lichess:<id>`), `site`, `pgn`, `end_time`, `time_class`, `user_color`, `user_result`, `raw_meta` (JSON). Unique on (`user_id`, `source_id`).
- **move_analysis**: `game_id`, `ply`, `engine_version`, and the same fields as `MoveAnalysisRecord`. Unique on (`game_id`, `ply`, `engine_version`).
- **sync_state**: `user_id`, `site`, `username`, `year_month`, `status`, `updated_at`. Mirrors the IndexedDB store.
- **preferences**: `user_id`, `key`, `value`, `updated_at`.
- **saved_puzzles** and **leitner_state**: `user_id`, item ID, box, `updated_at`, `device_id`.

Games are the largest data. Store the PGN once. Do not store the raw Chess.com JSON unless it is needed later.

## 6. Sync and conflict rules

Principle: **local IndexedDB stays the working copy. The server is the shared copy.** The app works offline. Sync runs when online.

| Data | Rule |
|---|---|
| Games | Immutable after import. The same `source_id` is always the same game. Upsert by (`user_id`, `source_id`). A duplicate is a no-op. |
| Move analysis | Keyed by `engine_version`. Same version and same ply means identical results, so keep the existing row. A new engine version adds rows and does not overwrite. |
| Sync state | Server keeps the "complete" flag per month. A month marked complete on either device is complete. |
| Saved puzzles | Set union by ID. Deletes are tombstones (`deleted_at`) so a delete on one device is not undone by the other. |
| Leitner box | Last write wins per item, using `updated_at`. Ties go to the server. |
| Preferences | Last write wins per key. |
| Skill and rival snapshots | Keep local only. They are per-day, per-device summaries. Revisit in phase 2. |

Sync steps (client):
1. Push local rows newer than the last push cursor. Batch the upload.
2. Pull server rows newer than the last pull cursor.
3. Apply the rules above. Store the new cursors in `syncState`.

The first sign-in uploads all local games. It deduplicates on `source_id`, so re-running it does not duplicate data.

Chess.com rate limits still apply. Server-side fetching, if added, must stay serial and polite, as `CLAUDE.md` requires.

## 7. Review flows

**In the browser (tab open).** The app reads from IndexedDB. Background sync pulls new games from the server and pushes local changes. This matches today's `backgroundSync.ts` timer.

**Outside the browser (tab closed or another device).** **Decided: server-side import job.** A Vercel Cron function fetches new games for each linked account. It runs serially and rate-limits calls to Chess.com and Lichess. The games appear on any signed-in device. The job runs only for linked accounts, and it never scrapes. It uses the public APIs, as `CLAUDE.md` requires.

**Engine analysis outside the browser.** Analysis is still computed on a device, using Stockfish in the browser. A reviewed game has no analysis until some device opens it. The result is stored on the server, so the next device reuses it. Running Stockfish on the server is a separate cost decision and is out of scope for v1.

## 8. Migration

- Existing visitors keep working with no sign-in. Nothing changes for them.
- When a visitor signs in, the app offers to upload local data. It shows the count of games first.
- The existing JSON export stays as a backup path.
- IndexedDB schema bumps to v6 only if new local fields are needed. Use optional fields where possible. Upgrades must not lose data.

## 9. Security and privacy

- Store only the email and user ID for accounts. No payment data in v1.
- All server access goes through row-level rules. Test them.
- Account deletion removes all server rows. Test it end to end.
- Update the privacy copy and the in-app text that says "nothing leaves your device."
- Provide a full data export, reusing `exportAllData`.
- Review by Opus-tier before release, as `DELEGATION.md` requires for account and privacy code.

## 10. Testing and release

- Unit tests (Vitest) for the conflict rules, with exact counts reported.
- Playwright tests for sign-in, sync, and sign-out in Chromium and WebKit.
- Cross-device test: two browser profiles, same account, same games.
- All new work goes on a feature branch with a Vercel preview.
- `main` auto-deploys live. Do not merge until the owner approves.
- The pre-push gate (`npm test` and `npm run build`) must pass.

## 11. Decisions and open items

**Decided (owner, Nov 23, 2026):**
1. Privacy: option A. Sign-in is optional. Local-only stays the default.
2. Auth: magic link first. Google later.
3. Backend: Vercel for everything.
4. Game import outside the browser: yes, server-side import job.
5. Target: Sun Nov 29, 2026. Owner says the scope is doable.

**Provider choices (verified Nov 23, 2026):** Neon free plan via Vercel Marketplace; Resend free plan.

**Still open:**
1. Owner creates the Neon database and Resend account, and gives the API keys through Vercel environment variables. Claude does not handle these secrets.
2. Local-only mode stays the default for signed-in users (owner: "local mode is fine for now").
3. Speed note: local IndexedDB is the fast path. The server adds cross-device sync and backup, not speed.

## 12. Not in scope

- Payments and paid tiers.
- Server-side engine analysis.
- Coaching or LLM features.
- Ads, sponsors, and merch (Requirements 6 and 8).
