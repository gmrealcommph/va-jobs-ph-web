# Daily Digest V1 validation — October 3, 2026

Daily Digest is complete as a disabled deployment artifact. No production migration, deployment, live provider send or live preflight was performed.

## Final local checks

- Full suite with the exact supplied Matching V2 SQL loaded into isolated PGlite: **54 pass, 4 fail, 58 total, 0 skipped**. All **14 added tests pass**. All 29 existing notification, Strong Match, database delivery and preference tests pass.
- Baseline reproduced before implementation: **40 pass, 4 fail, 44 total**. Source hashes confirm the tested earlier project matches the corrected V3 release. The same four original frontend assertions fail in the final suite; no new test failure remains.
- Database checks execute migration 003 with the real supplied matcher, not a recreated scoring model. They cover engine order, score preservation, public-view deduplication, fresh-job half-open boundaries, created/collected/posted fallbacks, no Strong Match opt-in dependency, no notification-table dependency, 10 maximum, the intentional top-100 coverage cap, empty selections, durable daily uniqueness, token leases, frozen payloads, accepted finality, entitlement/opt-in/Auth changes, changed public jobs and email, retry expiry, and denied browser access to the ledger/RPCs.
- Runtime tests cover no-network default disable, activation cutoff, independent cron dispatch, email HTML escaping and links, public-key availability checks, send-time rechecks, deterministic key and identical frozen replay after timeout/receipt failure, provider rejection/rate-limit/conflict/server/unknown outcomes, and read-only preflight without address logging.
- Preference tests verify independent controls, authenticated-user targeting, field-only PATCH bodies, same-origin protection, and rejection of combined/duplicate/invalid values.
- Wrangler 4.144.0 deployment packaging dry run passed with `DAILY_DIGEST_MODE=disabled`, `keep_vars=true`, the original Strong Match cron/activation, and the separate digest cron. No actual deployment occurred.
- The local Cloudflare runtime returned 200 for the disabled digest scheduled event and logged `daily_digest_run {"status":"disabled"}` with no production credentials. Logged-out `/email-preferences` returned 303 with the preserved login return path.
- Synthetic email and preference pages rendered in headless Edge at 1100px and 375px widths: scroll width matched viewport width in all four previews. Email desktop/mobile and preference mobile screenshots were visually inspected. Email encoding and labels were corrected during QA. These checks do not establish every email client's compatibility.

## Pre-existing failures, unchanged

1. `search is quoted and pagination/filtering happen in Supabase`
2. `job detail escapes content and rejects script application URLs`
3. `search results are noindex; page two has its own canonical`
4. `numeric job detail keeps the original application link and canonical`

These assertions conflict with the original quoting/markup formatting, legitimate image tags, and existing `/apply/{id}` route. They are retained and reported, rather than repaired within this feature.

## Preservation and remaining production verification

SHA256 equality was checked for the original Strong Match sender, notification module, rendering/data modules, every public asset, both existing migrations, package manifest/lockfile and all original tests except the expanded preference test. Worker changes only add digest cron dispatch; auth adds a field-only digest setter; preferences add an independent digest form. Strong Match batching, collection window, cooldown, provider request and ledger logic are unchanged.

There is **no Matching V2 definition in the release**. The exact supplied SQL was kept outside the artifact and used solely in an isolated test database. Four integration tests take an optional external `MATCHING_V2_SQL` path; without it they explicitly skip. The migration calls the already-existing production matcher.

Migration compatibility with the supplied production contracts is validated locally. Production grants/RLS, preserved dashboard bindings, Auth connectivity, ingestion timestamp stability, selected job IDs/order, actual provider acceptance and inbox delivery still require the steps in `DAILY_DIGEST_DEPLOYMENT.md`. Local tests prove lease fencing and claim serialization behavior in one isolated database; they do not substitute for observing real distributed Worker retries.

The accepted global-top-100 cap, staged delivery after 08:00, limited per-minute capacity and held uncertain sends are explicit V1 behavior. The digest remains disabled until production migration, preference checks and read-only runtime preflight are complete.
