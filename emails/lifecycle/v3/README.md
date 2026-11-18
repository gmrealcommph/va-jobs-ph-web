# VeeAys lifecycle v3

The ten lessons have Free and Pro HTML and plain-text variants. Free members with timely consent for both tips and Pro promotions receive the Free version. Pro members and Free members who consented only to tips receive the education-only Pro version. Resend holds matching drafts. The staging sender uses the checked-in HTML and text so it can freeze the exact provider payload without publishing a draft.

The schedule uses elapsed time from original registration. Days 0, 2, 3, 5, 7, 10, 14, 19, 24 and 30 each have one 24-hour window. Expired windows are never replayed. Day 0 can use consent granted during its open window so that a member can confirm and opt in after registration. Later lessons require consent by the start of the corresponding window. All lessons require current consent and a confirmed email.

The v3 sender drops the legacy 48-hour confirmation delay and sequence-to-sequence gap. It retains active-send and existing alert/digest coordination. The database locks the control row when reserving capacity and checks exact equality with the Worker's daily and monthly caps. It also rechecks eligibility and tier before storing the payload and marking the attempt. The ledger and provider idempotency key use stable member/step delivery IDs. An ambiguous provider outcome is held for manual reconciliation.

On staging, the existing welcome RPC and v3 Day 0 serialize on the welcome delivery record. If the existing welcome RPC prepares first, its attempt blocks v3. If v3 starts first, it atomically marks the simulator account's welcome record skipped so the existing Worker cannot prepare another send. The migration leaves the welcome RPC definition unchanged.

## Local verification

```sh
node scripts/build-lifecycle-v3.mjs --check
node --test emails/lifecycle/v3/schedule.test.mjs test/lifecycle-v3.test.js test/lifecycle-v3-production.test.js
```

After editing templates, regenerate the Worker bundle module with `node scripts/build-lifecycle-v3.mjs`. The integration suite executes the SQL against local Postgres via PGlite with a simulated provider. It uses a fixture schema and does not establish behavior on the hosted service.

## Hosted staging status

`sql/lifecycle-v3-staging.sql` was applied to VeeAys Staging. Rollback-only checks on hosted Supabase verified all ten window boundaries, Day 0 deduplication in both send orders, and Day 2 followed by Day 3 without the legacy 48-hour gap. The staging Worker uses the checked-in v3 sender and template module. One scheduled Day 0 run settled as accepted for `delivered@resend.dev` (Resend receipt `01a1ece2-a4a2-7213-903f-60927d3ebefa`), with the legacy welcome record marked skipped. The staging database is disabled and the Worker is in preview mode with no scheduled triggers.

The Worker requires the exact staging Worker origin and staging Supabase URL, mode `staging-v3`, recipient `delivered@resend.dev`, and caps that match staging control. The hosted results above predate the production-preparation changes.

## Production release and rollback

Both sending gates ship off. The database UTC activation time and Resend billing-cycle bounds start at infinity. Use `sql/lifecycle-v3-production.sql` to install the production RPCs and private welcome ledger. The legacy sequence claim and start are revoked. Keep the separate welcome Worker on staging and retain the existing schedules and cross-sender coordination.

The production queue chooses the earliest open registration-age window. It drains up to three one-recipient requests per minute and serializes DB admission with at least one second between reservations. Each start checks the current recipient, consent, tier, suppression, delivery history, billing window and configured budgets. Members registered before activation can enter their current window. An expired window is never replayed. Accepted and ambiguous attempts debit the budget and the member/step ledger prevents replay. Resend errors are held for reconciliation. Team rate-limit responses pause admission for at least a minute and honor a longer Retry-After up to one day. Other explicit provider failures and first-seen complaints stop the database gate. A reported account usage of 49,000 stops the gate after recording acceptance. Monitor shared usage independently because the account quota header may be absent and other senders can consume capacity between checks.

Resend usage on November 18 reported 700 of 50,000, no daily cap, and 10 requests per second across the team. The reported reset was 2026-12-15T10:18:00Z. Verify the current cycle and usage before enabling or changing budgets, and reserve expected capacity for digests and other traffic. Set identical Worker and database caps and explicitly record the verified billing-cycle start and end in UTC. The queue closes at cycle end until a fresh window is approved. The checked-in first-stage ceiling is 50 per UTC day and 1,500 per billing cycle. Allow 50–100/day after initial review, then 250–500/day after clean delivery and provider checks. For normal operation, size the daily cap against eligible demand and remaining shared allowance after reserves, with a 2,000/day code ceiling. Budget increases require review of accepted counts, provider delivery outcomes, complaint and bounce trends, held attempts and utilization.

Use `sql/lifecycle-v3-monitor.sql` for the control and ledger snapshot. Review structured Worker logs for held or unavailable outcomes, rate and quota pauses, and signed suppression events. Compare accepted attempts with provider delivery outcomes before widening the ramp. Inspect provider and database health after any pause. Resolve uncertain attempts by delivery ID and frozen idempotency key. Keep them held when acceptance cannot be ruled out.

Before activation, restore a current production-shaped snapshot, reconcile accepted receipt IDs and historical welcome evidence, and import confirmed welcome receipts or ambiguous holds privately. Preserve the provider ID, first-attempt timestamp and suppression outcome. Recheck zero outstanding attempts and live leases at the approved UTC cutover. Keep sending off while verifying the live sender footer, signed webhook, GET confirmation and one-click POST with synthetic data. Confirm that member preference UI permits the intended audience to manage consent.

For stop and drain, run `sql/lifecycle-v3-production-rollback.sql`, disable the Worker gate, and let started requests settle. Repeat the SQL after lease expiry to hold unresolved starts. Preserve the unsubscribe and suppression RPCs, history and tokens.

For full application rollback, provision the independently routed, send-free continuity Worker from `wrangler.lifecycle-continuity.jsonc` after migration and before first send. Bind the existing member webhook secret and the production database service credential to the continuity Worker through the normal secret store. Verify the more-specific routes at the public origin and exercise the same synthetic unsubscribe token before and after rollback. Retain those routes through application rollbacks. The old production version `0cc50dcb-cc20-422c-a57b-4c421a019d60` returned HTTP 404 on the unsubscribe URL and must have working continuity routes before any rollback after first send. Up to that point, keep the candidate disabled. No hosted continuity route has been installed as part of this draft.

