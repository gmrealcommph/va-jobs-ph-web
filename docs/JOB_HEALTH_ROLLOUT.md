# Job Health — review-only rollout

This branch adds reporting, verification evidence and admin review. **There is no hide/unhide operation.** Job status, public view definitions and current crons are unchanged. No production migration or deployment has been performed.

## Member and admin behavior

`JOB_REPORTS_ENABLED=true` enables the job-detail Report this job link and authenticated reporting form. Default is disabled. Categories: closed/filled, broken link, suspicious, inaccurate. Reporting requires a currently validated session and confirmed account. Strict same-origin POST checks, bounded form bodies, a honeypot, database serialization, one report per job per member per rolling 24 hours, a one-minute spacing limit and five reports per member per rolling 24 hours protect the endpoint. Duplicate submissions return success without adding reports. Reports never hide jobs. Direct REST callers have the same database authorization and limits.

`/admin/job-health` is linked from the existing dashboard's Import Health section. Every read and review checks the current admin allowlist. Metrics distinguish active records from deduplicated member-visible jobs, verified-original-date aging from provisional legacy-date aging, inactive records, unknown/stale verification, missing legacy/original dates and open reports. The queue is paginated by ID, with filters for old listings, reports, missing dates, aging and failures. Report resolution/dismissal and job review/evergreen decisions require reasons, optimistic revisions and audit entries. Evergreen decisions expire within 90 days. These decisions are advisory while hiding remains disabled.

The private schema has RLS and no direct member table grants. Exposed wrappers are security invoker; privileged private functions have fixed search paths, restricted execution and explicit authorization. Account deletion anonymizes report identity, clears member-authored details and retains non-identifying reports and evidence.

## Dates and source evidence

Additive job fields hold a confirmed original employer posting date, its provenance and immutable first-import time. Existing original dates are not backfilled from legacy `posted_at`. Existing import time displays `created_at` where the new field is absent; a trigger preserves it through future upserts. Observation history separates last attempted check, last successful open verification and source last-publication time. Matching source, source ID and original URL are required before evidence is accepted or displayed; changed/reopened identities must be verified again. Reviews live separately from importer records and survive repeat imports.

Lever supplies no original posting date. Greenhouse `updated_at` is an update date; Workable `created_at` is creation rather than proven publication; Himalayas `pubDate` is aggregator publication; Ashby `publishedAt` is **last** publication. None is silently promoted to employer-original time. Ashby last publication is retained separately. Explicit original dates require `employer_original` provenance.

Verification uses exact posting IDs in recognized public employer APIs and checks both stored and current application links. HTTP 200, empty/malformed/truncated boards, missing IDs on one check, anti-bot challenges, unsupported redirects, 403/429/5xx and temporary failures never prove open or closed. Unsupported/custom employer hosts require human verification. URLs are HTTPS-only, allowlisted, credential/port-free; redirects, response sizes, request duration and total scheduled network calls are bounded. A 429 stops further requests to that host for the run. No closed finding was inferred from this sweep.

## Read-only automation

The proposed verifier uses `12,42 * * * *`, eight claimed jobs per run, at most 32 external requests and six-hour claim leases. It prioritizes unverified old/undated records and refreshes evidence after seven days. It records observations only. **The cron is not registered in wrangler configuration** and `JOB_HEALTH_VERIFY_ENABLED` defaults off. Existing Strong Match, digest and Quick Read schedules remain untouched. Failed/partial attempts retain prior successful verification history and cannot modify visibility.

The offline verifier takes a locally saved database snapshot and has no database credentials or writes:

```
node scripts/verify-job-health.mjs input.json verification.json
node scripts/import-job-health-evidence.mjs verification.json
```

The second command is also a dry run by default. Its `--write` mode requires an explicit matching `JOB_HEALTH_TARGET_PROJECT`, `SUPABASE_URL` and service key. It appends evidence idempotently, rejects changed identities and evidence over seven days old, and has no job-update endpoint. No write-mode command has been run.

## Approval and rollout order

1. Review the source-verification snapshot. There are no confirmed-closed findings; rate-limited/aggregator cases remain unresolved. Provider-friendly retries or manual employer checks are needed.
2. Review the companion importer retention PR before migration. Current importer reclassification hard-deletes jobs. The companion change retains the same record as inactive with the existing classification outcome, preserving references. It must be released before reports/observations are written. Do not merge it yet: the importer runs its default branch on a schedule, so merging affects the next production import.
3. Approve a staging migration and acceptance tests with synthetic accounts. Local PostgreSQL tests are not a complete production-database restore test. This migration requires the existing jobs/public_jobs, auth.users and veeays_admin.has_access baseline. It must not be run against an empty database alone.
4. Approve deployment of the review-only UI/database changes and optional evidence import. Deploy with reports/verifier flags off, verify admin access, metrics and existing features, then explicitly enable member reports. Keep Cloudflare automatic builds paused until a deliberate deployment is authorized.
5. Separately approve the verification schedule and provider request budget. Eight per half-hour is an initial bounded proposal, not an enabled schedule or an SLA for verification coverage.
6. Automatic hiding is a later change requiring reviewed source results, reliable original-date rules, outage/repeated-absence safeguards, durable hide/reopen ownership, deduplication impact simulation, a bounded canary, rollback and explicit approval. No visibility-changing code is included here.

## Validation

The Windows admin app 0.1.1 restricts top-level navigation to `/admin`. The dashboard links to `/admin?view=job-health`, an authenticated alias for `/admin/job-health`, so the existing app can open Job Health without expanding its origin or route allowlist. Both paths use the same authorization and review API. Native app visual acceptance is separate from HTTP route validation.

The review-only rollout was approved on October 12. Staging uses its own Worker and Supabase project, synthetic accounts/listings, no cron schedules, and disabled payment/email automation. Production explicitly enables member reports and disables scheduled verification. Automatic hiding remains absent. Roll back application code with the saved Cloudflare version; disable member reports first if necessary. Leave additive database objects and retained reports intact on application rollback. Do not revert the importer to hard deletes once referenced records exist.

Local tests cover anonymous/member/admin authorization; confirmed-account checks; duplicate/minute/day reporting limits; honeypot/body bounds/CSRF; stale review conflicts; evergreen expiry; evidence identity changes; account-deletion anonymization; leases; opt-in scheduler isolation; source matching, HTTP false positives, redirects, outages, rate-limit circuits, date boundaries and unchanged job visibility. The companion importer has offline persistence tests for soft retirement, source isolation and reopen identity. Production acceptance tests remain pending deployment approval.
