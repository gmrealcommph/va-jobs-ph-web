# Daily Digest V1 — deployment and verification

Daily Digest is implemented and **disabled in the supplied configuration**. Apply migration 003 and complete the checks below before enabling it. Strong Match remains enabled with its reported production cutoff `2026-10-03T04:15:00Z` and original `*/15 * * * *` cron. Nothing in this delivery has been deployed to production or sent through Resend.

## What V1 sends

For active, unexpired Pro accounts with `job_preferences.daily_digest=true`, the digest calls **the existing** `public._get_job_matches_for_user(user_id,100)`. It preserves the returned order, intersects with the fresh public jobs, and takes at most 10. No matching function is created, copied into runtime code, replaced, or altered. No Strong Match notification row is needed, and an already-alerted Strong Match can appear in the digest. An empty selection creates a skipped daily ledger entry and sends nothing.

**Accepted V1 limitation:** Matching V2 caps its results at the global top 100 active matches. Fresh jobs outside that top 100 cannot appear, even if the user has fewer than 10 fresh jobs in the digest. Public-board deduplication also occurs after that frozen top-100 selection. No fresh-job matching adapter is included.

Freshness is `coalesce(jobs.created_at,jobs.collected_at,jobs.posted_at)`: database first-arrival time, with collection time and then source posting time as fallbacks for rows with missing earlier fields. `updated_at` never makes an existing job new. This intentionally permits an older source posting newly added to VeeAys to appear. Verify your ingestion preserves `created_at` on updates; if it rewrites all first-arrival fields, correct that ingestion contract before activating. `public_jobs` is unchanged and is used only for public availability/deduplication, never enrichment.

For a digest starting **08:00 Manila on October 5**, the fixed window is **October 4 00:00 UTC inclusive through October 5 00:00 UTC exclusive**. Retries keep that window and Manila digest date. Jobs timestamped exactly at the upper boundary belong to the following day's digest.

## Schedule and capacity

The separate digest cron is `* * * * *`. Each minute begins or continues processing the current daily window; a new window starts at **00:00 UTC / 08:00 Asia/Manila**. The durable user/day uniqueness prevents repeated daily sends. This is a daily email with a frequent queue-draining and retry schedule, rather than a single invocation attempting every user at once.

Each invocation claims up to **3 users** by default, one at a time. `DAILY_DIGEST_MAX_USERS` can explicitly be `1`, `2` or `3`. Successful attempts use about 11 external requests per user, keeping three within the Free Worker 50-subrequest budget. Digest and Strong Match run in separate cron invocations, even when they occur in the same minute. New attempts have priority over retries.

Emails begin at 08:00; delivery spreads over subsequent minutes, approximately three users per minute before errors/empty selections. Nominal capacity is 4,320 processed user/day slots, reduced by retries, Worker errors or slow database queries. Empty/ineligible users consume a slot. Monitor pending counts and finish well before the next 08:00 boundary; larger populations need a queue/batching expansion. Prior-day unsent rows are skipped, and prior-day uncertain attempts are held instead of being resent as old roundups.

Cloudflare schedules use UTC and changes may take time to propagate; see [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

## 1. Preserve the live configuration

Before deploying, compare the supplied `wrangler.jsonc` with the currently deployed configuration. The earlier saved ZIP predates activation; this release deliberately restores the activation reported in the production conversation:

```json
"keep_vars": true,
"triggers": { "crons": ["*/15 * * * *", "* * * * *"] },
"STRONG_MATCH_MODE": "enabled",
"STRONG_MATCH_START_AT": "2026-10-03T04:15:00Z",
"DAILY_DIGEST_MODE": "disabled"
```

Retain any additional live cron entries or binding declarations that are absent from the older baseline. Retain the real Worker name, assets binding and `SUPABASE_URL`. Do not paste secrets into project files or replace dashboard-managed values with placeholders. Existing `SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` and `RESEND_API_KEY` are reused; no new secret is required. Keep `MANUAL_STRONG_MATCH_IDS` empty as in the corrected production deployment. This guide does not ask you to reactivate or reset Strong Match.

## 2. Apply the database addition

1. Run the first section of `scripts/daily-digest-verification.sql` in Supabase SQL Editor and retain the matcher, Strong Match RPC and `public_jobs` definition hashes.
2. Confirm the existing `job_preferences.daily_digest` field is boolean and readable/writable for its owner through the existing RLS policy. Migration 003 fails clearly if that existing field or the matcher is absent. It does not alter existing preferences or their defaults.
3. Apply **only** `migrations/003_daily_digest.sql` once. Migrations 001/002 already exist in production; do not rerun them. Migration 003 is transactional and creates the separate ledger plus service-only RPCs. It also reloads the PostgREST schema cache.
4. Rerun the definition hashes: every original matcher, Strong Match RPC and the public view must be unchanged. The new permission checks must return `service_claim=true`, `browser_claim=false`, `browser_ledger=false`.
5. For a specific test user, run the read-only selection below, replacing the example UUID:

```sql
select public.daily_digest_matches(
  'REPLACE_WITH_REAL_TEST_USER_UUID'::uuid,
  date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
);
```

Compare those IDs/order with the exact engine top 100 intersected with the same timestamp window and `public_jobs`. Check one known fresh non-Strong Match and one already-alerted Strong Match if those fixtures exist. An empty result is a valid outcome, not an instruction to change dates or notification state.

## 3. Deploy with Daily Digest disabled

Install locked dependencies using `pnpm install --frozen-lockfile`, then run `pnpm run build` for the dry run. After comparing live configuration, deploy this project through your usual production process with `DAILY_DIGEST_MODE="disabled"` retained. Both crons may be present; disabled digest invocations do not read Supabase, claim rows or call Resend.

Verify the deployed Worker still has its dashboard secrets/bindings and original Strong Match activation. Confirm the regular Strong Match logs and batches continue naturally; do not manufacture notifications or alter its cooldown ledger.

Visit `/email-preferences` while logged out and then logged in. It must redirect logged-out users to login and show independent Strong Match and Daily Job Digest toggle switches with one **Save preferences** action. Both boolean email settings are saved together in one authenticated-user PATCH. Confirm target roles, salary, schedule, employment, experience, skills, industries and entitlement fields remain unchanged. Restore the test user's intended opt-ins. Cross-origin POSTs, missing/non-boolean values, unrelated fields and ambiguous duplicates must be rejected. The native hidden-false/checked-true checkbox pair is an intentional valid representation and works without JavaScript.

## 4. Read-only live runtime preflight

`scripts/daily-digest-preflight.js` checks service-key access, the new matching RPC, current Pro/expiry/opt-in, Auth admin email confirmation/deletion/ban status, and public-view access using the publishable key. It cannot send email or write the ledger. It refuses to run with digest mode enabled. It prints only status, fixed window end and match count, never email addresses, tokens or payloads.

Run it in a trusted local Node 22+ environment with the same dashboard values already supplied via environment variables, using a real opted-in Pro test user's UUID:

```text
node scripts/daily-digest-preflight.js REAL_TEST_USER_UUID
```

Required environment: `SUPABASE_URL`, `SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, and `DAILY_DIGEST_MODE=disabled`. The provider key is checked for presence by the shared runtime configuration; the preflight never contacts Resend. Do not enter credentials as command-line arguments or commit a local secret file.

`ready` means the read-only checks passed with 1–10 matches. `no_new_matches` means matching/Auth/public-view checks passed with no eligible jobs. `recipient_not_eligible` is expected for Free, expired or opted-out test users and exits before the remaining access checks. A failure must be resolved before activation. This is not proof of provider acceptance or inbox delivery.

## 5. Activate only after checks pass

Choose a **future 00:00 UTC** boundary after verification is complete. For example, **October 5, 2026 08:00 Manila** is `2026-10-05T00:00:00Z`.

Set `DAILY_DIGEST_START_AT` to the chosen exact UTC midnight. Change `DAILY_DIGEST_MODE` from `disabled` to `enabled` in the version-controlled deployment configuration, then deploy it while keeping all Strong Match values intact. If activation is managed in the dashboard instead, remove the local `DAILY_DIGEST_MODE` override before deploying or it will reset the dashboard setting. Do not enable the mode early just to test a live send.

At the first approved boundary, check `daily_digest_run` logs and the aggregate ledger queries. Verify a successful row has status `accepted`, a provider ID, `accepted_at`, attempts ≥1 and 1–10 items. Confirm the corresponding Resend acceptance and actual inbox email, rendered links and preference behavior. `accepted` means provider acceptance, not guaranteed delivery. An opted-out/expired/Free account must not receive a digest; a zero-match account should have a skipped row without payload or first attempt. Compare the Strong Match behavior with its existing production records.

## Retry and duplicate safety

- The database unique constraint permanently allows only one ledger row per user/day. Advisory locking serializes digest claims; five-minute token leases fence stale workers. Digest uses its own lock key and table.
- Items and email payload are frozen. Retries reuse the exact provider request and deterministic `veeays-digest-{Supabase hostname}-{user UUID}-{Manila date}` key.
- Before each attempt, Pro/expiry/opt-in, Auth email/confirmation/deletion/ban, current matcher membership and active/public job visibility are rechecked. Public-board checks use the publishable key, while SQL retrieves enriched job data from the existing matching function. A changed frozen item or recipient is held for review.
- A timeout, rate limit, server error, conflict, malformed receipt or failure to commit an accepted receipt retries the same frozen request. The receipt commits to the digest ledger only; it never acknowledges or modifies Strong Match notification rows.
- Resend retains idempotency keys for 24 hours. This sender stops automatic retries after **23 hours from the durable first-attempt boundary**, and also stops when the daily window closes. See [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).
- Uncertain attempts that reach the boundary are held permanently. Reconcile them with provider records; **never delete/reset their row or resend them with a new key**. Prefer missing one uncertain digest over creating a duplicate after provider idempotency expires. Future days remain independent.
- Eligibility can change between the final check and the external provider call; the checks minimize that interval, but the database and provider do not share one atomic transaction.

## Rollback

Set `DAILY_DIGEST_MODE=disabled` in the effective deployment configuration and redeploy. Keep the digest ledger and receipts; do not drop tables or clear daily uniqueness. Keep Strong Match enabled, its cutoff unchanged, and its cron present. You may remove only the new minute cron once disabled, retaining every original cron. An already-running provider request may finish; disabling is not recall of an accepted email. Migration 003 and the preference toggle can remain in place harmlessly.

## Local validation and reproduction

The release validation used the **exact supplied Matching V2 SQL** in isolated PGlite, separate from the project. That SQL is deliberately not shipped or deployed. To reproduce the four optional matcher integration tests, set `MATCHING_V2_SQL` to an external `.sql` file containing those exact production definitions, then run `node --test`. Without that variable, those four tests explicitly skip; all other tests remain runnable. Do not apply that fixture to production.

See `DAILY_DIGEST_VALIDATION.md` for the final results and pre-existing failures. Synthetic email previews demonstrate browser layout only, not every email client's rendering.
