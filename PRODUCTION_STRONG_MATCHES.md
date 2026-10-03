# Production Strong Match Alerts

## Corrected V3 transition — October 3, 2026

**Yes: Alfred can run this corrected migration 002 next against the confirmed live schema.** Migration 001's manual ledger exists and both production batch tables are absent. Local PostgreSQL execution of the corrected migration and claim RPC succeeds against a notification fixture with the confirmed column types and no `created_at`. This is approval of schema compatibility for migration 002, not email activation. Nothing has been applied to production here.

Confirmed notifications: `id bigint NOT NULL`, `user_id uuid NOT NULL`, `job_id bigint NOT NULL`, `match_score integer NOT NULL`, `notification_type text NOT NULL`, `discovered_at timestamptz NOT NULL`, `notified_at timestamptz nullable`. Profiles use UUID `id`, text `plan`/`plan_status`, nullable timestamptz `pro_expires_at`; preferences use UUID `user_id` and NOT NULL boolean `email_strong_matches`. Both job IDs are bigint. The confirmed public view filters `status='active'`, `philippines_eligible=true`, and `duplicate_rank=1`.

Notification #165 already has `notified_at`; its manual receipt is `01a0ffb9-6f37-7945-8b53-bae78da5284b` with `accepted_at` populated. The Cloudflare manual allowlist is already empty. Keep those acknowledgements and the manual ledger. No resend is needed.

The patch uses notification `discovered_at` for both cutoff/15-minute checks and both oldest-first orderings. It adds no notification column. `created_at` on the manual ledger, production batches and saved jobs remains valid for their own semantics. The Worker delegates discovery cutoff/age to the claim RPC; its only change is an explanatory comment. Whole-project review includes migrations, Worker, tests, scripts and documentation.

Validation: 29/29 Strong Match/database/preferences/manual tests pass; Wrangler 4.144.0 deployment dry run passes. Full suite: 40/44 pass; the same four frontend failures reproduce in the original V3 archive. Sending remains `disabled`, cron remains `[]`. Auth API access, publishable-key permissions and PostgREST cache must still be checked before any later activation; the supplied schema preflight does not establish those runtime checks.

This release builds on `VeeAys_My_Jobs_V2_Manual_Resend.zip` (SHA256 `39308B20671DB0F94F7CA1FA8F06D14A4185BE31DA4617A7BF42E51ECB339FD0`). No production migration, deployment, cron activation or live email was performed during implementation.

## What changes

The scheduled Worker sends one grouped email with up to five pending `strong_match` notifications for one user. The default is one recipient/five jobs per invocation, keeping external subrequests below the Free plan's 50-request limit. On a suitable paid Worker plan, an operator may explicitly set `STRONG_MATCH_MAX_BATCHES=2` or `3`, capped at three recipients/15 jobs per invocation, sequentially. Check the Worker CPU budget before activation. [Cloudflare subrequest limits](https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/). A 15-minute collection window uses notification `discovered_at` to group arriving matches; a durable 24-hour user cooldown prevents alert floods. Excess matches remain pending for later days. Daily digests are untouched.

At reservation and immediately before sending, the sender checks current active Pro entitlement/expiry, strict boolean opt-in, current confirmed Supabase Auth email, non-deleted/non-banned user, notification identity and job availability. The current email comes from Auth, never a cached profile email. A changed recipient on a frozen retry is held; it is never silently redirected. The Worker checks `public_jobs` with the same publishable key used by the board, plus underlying job data/explicit inactive status. The public view must enforce the site's public/active job availability rules; verify that before enabling.

HTML/text emails use `VeeAys Jobs <jobs@veeays.com>`, the existing logo, compact metadata, Full-time formatting, job cards, supported numeric match-score badges and `/email-preferences`. No match explanations are invented. The preferences page requires login and updates only `email_strong_matches` using the user's existing RLS permissions. Other matching preferences and plan fields are untouched.

## Duplicate safety and failure handling

Private tables reserve each notification once and serialize claims. A five-minute lease with a unique token fences stale workers. Each batch persists an immutable payload and first-attempt time before calling Resend with `veeays-strong-batch-<Supabase hostname>-<batch UUID>` as its idempotency key. Retries use that exact payload/key; they do not regenerate the email from changing job details. Resend acceptance and all `notified_at` writes commit in one database transaction. A failure after acceptance but before commit replays the same provider request within the safe window.

Resend retains keys for 24 hours: [Resend idempotency documentation](https://resend.com/changelog/idempotency-keys). This sender stops automatic replay at 23 hours from the durable attempt boundary. Unknown outcomes after that point are held for operator reconciliation, never retried with a fresh key. Finite provider retention means an indefinitely retrying sender cannot safely guarantee no duplicates. This implementation chooses to stop rather than risk a duplicate.

429, 409, server errors, timeouts, malformed successful responses and database errors retry with exponential backoff (starting at two minutes after the first attempt, capped at six hours). A lost lease naturally expires and is reclaimable. Permanent provider rejection, changed frozen recipient/notification, expired idempotency window or ineligible retry is held. An ineligible/unavailable batch before any provider attempt is skipped; it retains its membership and does not set `notified_at`. Held batches block new emails for that user until resolved. Skipped batches exclude those notifications permanently but only apply the normal cooldown to future matches. Inspect these states; do not delete ledger rows to force retries.

An accepted email is an accepted provider submission, not proof of inbox delivery. Bounce handling and Daily Digest are outside this change.

## Safe transition and disabled deployment

1. Completed live preflight: notification #165 is acknowledged and the manual ledger has populated `accepted_at`. For a later read-only recheck, run `scripts/strong-match-preflight.sql`. Confirm notification #165 has `notified_at` and its manual ledger receipt matches the successful Resend test (`01a0ffb9-6f37-7945-8b53-bae78da5284b`). Keep this record. Check every other manual ledger row, especially rows without receipts.
2. **`MANUAL_STRONG_MATCH_IDS` is already cleared in Cloudflare; keep it empty.** No more manual testing is needed. Keep the ledger for audit; unresolved manual attempts stay excluded from production. Never clear the ledger to make a notification pending again.
3. The schema and public-view filters above are confirmed. Before later activation, separately check Auth admin API access and verify that the publishable key exposes only the intended public jobs. Local SQL tests model the confirmed schema without connecting to Supabase; their simplified view models the three confirmed filters, not the complete ranking implementation.
4. Migration 001 is already present (the acknowledged manual ledger proves this); retain it. Both production batch tables are absent, confirming migration 002 is unapplied. Alfred may next run the corrected `migrations/002_production_strong_matches.sql` once in Supabase SQL Editor against the confirmed schema. Do not run the original V3 migration. It adds two private tables/five service-role-only RPCs; it does not alter discovery or existing policies. SQL errors roll back the migration. Refresh the PostgREST schema cache if required: `NOTIFY pgrst, 'reload schema';`.
5. Upload/extract the ZIP into the existing project; do not nest it in another directory. Retain existing Cloudflare runtime bindings. The supplied `wrangler.jsonc` explicitly has `STRONG_MATCH_MODE="disabled"` and `triggers.crons=[]`. Deployment in this configuration sends nothing even if all secrets remain configured. The manual endpoint returns 410 whenever the production-mode binding is present, including disabled mode.
6. Keep server secrets `RESEND_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in Cloudflare. Keep `SITE_URL=https://veeays.com`, `SUPABASE_URL` and the existing `SUPABASE_PUBLISHABLE_KEY`. Remove `MANUAL_NOTIFICATION_TOKEN` and `STRONG_MATCH_TEST_EMAIL` after disabling the old flow; production does not use them. Do not roll back to the old Worker with a populated manual allowlist.
7. Install dependencies (`pnpm install --frozen-lockfile`), run the new tests (below), and run `pnpm build` (dry run) before `pnpm deploy`. Deploy disabled first. Verify existing login, job board, My Matches and My Jobs, and `/email-preferences` login/opt-out/opt-in. Verify that saving the alert preference leaves other preference columns unchanged. No email test is required for these checks.

## Deliberate activation after review

Activation sends real emails and is a separate operator decision; it was not performed here.

Choose `STRONG_MATCH_START_AT` as an explicit UTC ISO timestamp. Set it to the activation time to exclude the historical pending backlog. If deliberately including older matches, review/count that backlog first and choose an earlier cutoff. The cutoff filters notification `discovered_at` for new reservations; changing it does not reset existing batch memberships or uncertain attempts. Old pending records remain pending but unselected.

Edit the source-controlled Wrangler configuration to set these variables and this trigger only after code/migrations/preferences/availability checks pass:

```json
"triggers": { "crons": ["*/15 * * * *"] },
"vars": {
  "SUPABASE_URL": "<retain existing value>",
  "STRONG_MATCH_MODE": "enabled",
  "STRONG_MATCH_START_AT": "<reviewed activation timestamp in UTC>"
}
```

Preserve other bindings. Deploy the reviewed configuration. Cloudflare cron expressions run in UTC and invoke the native `scheduled` handler; this handler accepts only this exact cron. See [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/). Missing/disabled mode exits before any network call; missing/invalid cutoff refuses sending. Monitor Worker `strong_match_run` aggregate logs and ledger status/errors after activation. Logs do not contain recipients, message bodies or credentials.

To stop future sends, immediately set `STRONG_MATCH_MODE=disabled` and remove the trigger. Allow any already-running invocation to finish, then inspect the ledger. Never remove the new tables while an invocation may be active. Redeploying the supplied disabled ZIP deliberately disables alerts; re-enable only with a reviewed configuration.

## Reconcile held outcomes without sending

Disable the mode/remove cron first and wait at least five minutes for outstanding leases to expire. For each held batch, inspect its frozen payload, membership, first attempt and deterministic idempotency key. Check Resend's dashboard/API/logs for that exact submission/recipient and a verified accepted email ID. Never use absence of a DB receipt as proof that no email was accepted.

If acceptance is verified, acknowledge in one operator SQL transaction without calling Resend. The example below intentionally requires replacing placeholders; verify that the batch identity/receipt correspond before executing:

```sql
begin;
select * from public.strong_match_batches where id='<verified batch UUID>' for update;
update public.strong_match_batches
set status='accepted',resend_id='<verified Resend email ID>',accepted_at=now(),
    lease_token=null,lease_until=null,last_error=null
where id='<verified batch UUID>' and first_attempt_at is not null
  and status in ('held','pending','retry');
update public.job_match_notifications n set notified_at=now()
from public.strong_match_batch_items i, public.strong_match_batches b
where b.id='<verified batch UUID>' and b.status='accepted' and b.resend_id='<verified Resend email ID>'
  and i.batch_id=b.id and n.id::text=i.notification_id and n.user_id=b.user_id
  and n.job_id::text=i.job_id and n.notification_type='strong_match' and n.notified_at is null;
commit;
```

If no acceptance can be established, leave held; do not replay beyond 23 hours, reset the attempt time, change its payload or issue a new key. To abandon a reviewed unresolved attempt without risking another email, an operator may change its status from held to skipped (retaining all membership/payload evidence). This allows future *different* notifications after cooldown and never requeues its notifications. Use the same evidence-based receipt reconciliation for old manual ledger rows; #165 must remain acknowledged.

## Tests and validation

```text
node --test test/strong-matches.test.js test/delivery-db.test.js test/email-preferences.test.js test/notifications.test.js
pnpm build
```

SQL tests execute both migrations and RPCs in local PGlite/PostgreSQL: claims, five-item cap, leases, payload freeze, acceptance rollback on forced acknowledgement failure, cooldown/backoff, expired unknown outcomes, manual/digest/inactive/recent exclusions, and private permissions. JavaScript tests use fake recipients/keys and mocked network requests. No test sends to Resend or connects to production Supabase.

Four frontend assertions already fail in the original archive; they remain unchanged. See `VALIDATION.md` for the comparison. Run `pnpm test` for the entire suite, understanding those pre-existing failures before release. Existing public assets/render/data behavior is preserved.
