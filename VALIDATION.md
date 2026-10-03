# Corrected V3 live-schema patch validation — October 3, 2026

This section supersedes the historical validation below.

- All 29 Strong Match, database, email-preference and manual-regression tests pass locally. Both migrations and their RPCs execute in PGlite; no production database is contacted.
- Notification fixture matches the confirmed NOT NULL fields, integer score and `discovered_at` timestamp, with no notification `created_at`. A new regression proves historical/recent exclusions, discovery-time oldest-five ordering, active/PH-eligible/deduplicated public filters, and preservation/exclusion of acknowledged manual notification #165.
- Whole-project timestamp audit corrects four migration expressions, the notification fixture and recent-match update, and the transition documentation. Remaining `created_at` references are manual-ledger retry timestamps, batch creation/cooldown timestamps, saved-job timestamps, or explanatory documentation. No redundant notification column is added.
- Worker notification age/cutoff logic is delegated to the patched claim RPC; the Worker receives only a clarifying comment.
- Locked dependencies installed successfully. Wrangler 4.144.0 `deploy --dry-run --outdir dist` passes, with `STRONG_MATCH_MODE="disabled"`. Configuration retains `triggers.crons=[]` unchanged.
- Full suite: 40/44 pass. The four frontend failures reproduce in the untouched original V3 archive (11/15 original frontend tests pass); original frontend files/tests remain unchanged.
- Alfred may next apply the corrected migration 002 once to the confirmed schema. Migration 001 already exists; both new batch tables are absent. This is schema compatibility validation, not confirmation of live runtime grants, Auth API connectivity or activation readiness.
- No deployment, production migration, live email or production change occurred. Release excludes dependencies, generated build output, local configuration and logs.

## Historical V2/V3 validation

The final Cloudflare Wrangler 4.144.0 deployment dry run passed. All 15 new notification tests passed (`node --test test/notifications.test.js`), covering preview without writes, authorization/ID/email/confirmation guards, entitlement and opt-out checks, rechecking before send, removed jobs, daily-digest skipping, HTML escaping, successful acknowledgement, rejection, timeouts, receipt/acknowledgement failures, retry cutoff, changed payloads, concurrent reservation and another explicitly allowlisted ID. The PowerShell helper's syntax also parsed successfully.

The combined suite ran: 26/30 passed. The four original frontend tests fail identically in the untouched supplied ZIP. Original tests are retained unchanged. Their assertions expect outdated category quoting, reject legitimate brand image tags, expect unformatted pagination text, and expect a direct external Apply link instead of the existing `/apply/{id}` route.

File hashes confirm `src/auth.js`, `src/data.js`, `src/render.js`, all public assets, original tests, package manifest, lockfile and Wrangler configuration are unchanged. `src/worker.js` adds only the notification-module import and route dispatch. README and this validation note are updated.

The release ZIP excludes live credentials, dependencies, build output, local configuration and logs. The SQL migration has not been executed against the live database. Runtime bindings, permissions, Supabase reads, Resend acceptance and inbox delivery require the documented controlled live test. No real deployment or email send occurred, and no cron or scheduled handler was added.

## Original Saved Jobs + Application Tracker validation

Validated for this build:
- `node --check src/worker.js`
- `node --check src/render.js`
- `node --check src/auth.js`
- `node --check src/data.js`
- Saved/unsaved actions are authenticated POST requests protected by existing same-origin POST check and Supabase RLS.
- Application status is server-allowlisted to applied/interview/offer/hired/rejected/withdrawn.
- Notes are capped at 2,000 characters server-side.
- Logged-out Save preserves a strict local return path and resumes on the job detail page.
- Apply remains separate from application tracking; applications are only tracked when the user explicitly selects Mark as applied.
- Existing Free/Pro match entitlement remains database-enforced.

`npm test` was also run. 11/15 existing tests pass. The 4 failures are pre-existing expectation/fixture mismatches (category filter quoting, literal escaped tag assertions, and Apply-link expectations) and are not runtime syntax failures introduced by this feature.
# Production Strong Match release validation

- Exact baseline: downloaded manual-Resend archive, recorded SHA256 in `PRODUCTION_STRONG_MATCHES.md`.
- 28 delivery/database/preferences/manual-regression tests pass. PostgreSQL RPC tests execute both migrations locally and force acknowledgement failure to prove receipt/notification rollback is atomic.
- Existing frontend tests: 11 pass, four fail identically in baseline and release. The unchanged assertions concern category filter quoting, an HTML tag assertion that also matches the existing brand image, search noindex formatting, and the original external-application-link assertion. No frontend fixes were mixed into this release.
- SHA256 equality confirmed for every public asset, `src/render.js`, `src/data.js` and `test/worker.test.js` against the baseline. Auth/Worker edits are limited to the new preference route/helper/return path and sender integration/retirement.
- Cloudflare deployment packaging dry run passes with mode disabled and no cron. No production credentials were used. No live deployment, migration or email send occurred.
- Synthetic desktop and 375px mobile email previews rendered and visually inspected; no mobile horizontal overflow. Browser preview does not establish compatibility with every email client.
- SQL tests use a representative explicit schema fixture; live schema, PostgREST grants/cache and the active/public view contract must be checked using the documented read-only preflight before activation. Real provider acceptance/inbox delivery was not retested.

The following sections document historical baseline validation and are superseded where they refer to a manual-only sender or the absence of a scheduled handler.
