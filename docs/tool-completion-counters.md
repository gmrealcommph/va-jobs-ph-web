# Completed career tool counters — staging handoff

Production baseline verified: a1533d26-caae-4936-80bf-f5f7a3c11396, source d36ead7c5892471b32ab4c8ca8454f38f6433958. No production deployment has been made for these counters.

Preview: https://veeays-completion-stage-20261023.gm-realcommph.workers.dev/__qa/completion-dashboard
Staging version: 2dab015f-a469-451b-8a76-30df41e6b12d. Its storage is isolated from production.

## What counts

- Niche Finder: one completed form after its authenticated results save succeeds. Page views, saved-result refreshes, skipped/incomplete questionnaires, failed saves and matching-preference edits do not count.
- Resume Studio: one per in-memory draft when a valid form reaches Review & download. First successful PDF/Word export also qualifies if the user bypasses the final step; further review/export clicks for that draft do not count. The existing form rules still apply (name required; other sections optional).
- Totals count completed forms, not unique people. A new retake/edited questionnaire or a new/restored browser draft may be another completed form. No historical usage is reconstructed; production totals begin when this version is deployed.

## Privacy and reliability

The existing Cloudflare Durable Object namespace hosts a separate named counter object. No new production binding, Durable Object class migration, Supabase migration, paid API or third-party analytics is needed. Counts never include names, emails, account IDs, IPs, questionnaire answers or resume contents. The resume request omits credentials and sends only a random per-draft identifier. Niche Finder reporting happens server-side after saving; it sends only the random form identifier and tool type.

Identifiers prevent duplicates for 24 hours, then an alarm deletes them. Anonymous aggregate totals persist. Browser Do Not Track / Global Privacy Control are respected. Reporting is best effort: blocked requests, provider outages, or abrupt tab closure may undercount. Counter failure does not block the tools or authentication. Resume completion is a browser-reported action, not a server inspection of resume contents.

Only the authenticated, existing admin-authorized analytics endpoint returns production totals. There is no public production totals endpoint. The existing admin dashboard gets a Completed career tools section; unavailable storage is shown as Unavailable, never a false zero. The date picker does not filter these lifetime totals, which are explicitly labelled since counting began.

## Verification

- Full suite: 527 passed, 4 existing skips, 0 failed.
- Auth release gate: 28 passed.
- Durable real-SQLite tests: duplicate suppression, atomic rollback/retry, object restart, receipt expiry with totals preserved, anonymous payload, rejected forged tools/content, admin authorization and failure isolation.
- Native staging browser: initial totals 0/0; completed Niche Finder becomes 1/0; reopening results and empty resume review stay 1/0; completing a valid sample resume becomes 1/1; repeated review stays 1/1.
- Dashboard checked at desktop and 390px phone width, no horizontal overflow.
- No production accounts, payments or profiles were changed by these tests.

## Release

Requires production approval. Recheck the active version and source immediately before deploying; preserve all bindings, runtime, secrets, schedules, pricing, payments, verification and signup security. Use production src/worker.js, never the staging entry. Retain a1533d26-caae-4936-80bf-f5f7a3c11396 as the current rollback candidate, subject to the fresh audit.

Dashboard placement update: completion totals replace the Live Visitors tile in the existing admin overview, using its theme and responsive grid. No separate counter section or member-facing counter. Dashboard/counter tests: 15 passed. Auth safety: 28 passed. Mobile preview: 390px, no horizontal overflow. Staging version: 7f028032-9ce3-4650-8cd3-3d2a46d9fcb3. Production not deployed.

Graph update: dashboard tile uses purple Niche Finder and pink Resume Studio lines, daily Manila dates on X and completed form count on Y, last 30 days. Legend totals remain all time. New daily aggregate table is additive, preserves totals and dedupe, contains no identities or form content. Earlier dates have no history and are blank. Tests: 16 dashboard/counting and 28 auth passed. Staging only; production approval remains required.

Final visual revision: white dashboard tile, side-by-side black split-flap counters, labels Niches and Resumes underneath. Uses existing 30-second admin refresh; animates at request start and after updated render, respecting reduced motion. 17 dashboard/counting tests and 28 auth tests pass. Mobile 390px verified side-by-side, white background, no overflow. Staging only.
