# VeeAys lifecycle v3

The ten lessons have Free and Pro HTML and plain-text variants. Free members with timely consent for both tips and Pro promotions receive the Free version. Pro members and Free members who consented only to tips receive the education-only Pro version. Resend holds matching drafts. The staging sender uses the checked-in HTML and text so it can freeze the exact provider payload without publishing a draft.

The schedule uses elapsed time from original registration. Days 0, 2, 3, 5, 7, 10, 14, 19, 24 and 30 each have one 24-hour window. Expired windows are never replayed. Day 0 can use consent granted during its open window so that a member can confirm and opt in after registration. Later lessons require consent by the start of the corresponding window. All lessons require current consent and a confirmed email.

The v3 sender drops the legacy 48-hour confirmation delay and sequence-to-sequence gap. It retains active-send and existing alert/digest coordination. The database locks the control row when reserving capacity and checks exact equality with the Worker's daily and monthly caps. It also rechecks eligibility and tier before storing the payload and marking the attempt. The ledger and provider idempotency key use stable member/step delivery IDs. An ambiguous provider outcome is held for manual reconciliation.

On staging, the existing welcome RPC and v3 Day 0 serialize on the welcome delivery record. If the existing welcome RPC prepares first, its attempt blocks v3. If v3 starts first, it atomically marks the simulator account's welcome record skipped so the existing Worker cannot prepare another send. The migration leaves the welcome RPC definition unchanged.

## Local verification

```sh
node scripts/build-lifecycle-v3.mjs --check
node --test emails/lifecycle/v3/schedule.test.mjs test/lifecycle-v3.test.js
```

After editing templates, regenerate the Worker bundle module with `node scripts/build-lifecycle-v3.mjs`. The integration suite executes the SQL against local Postgres via PGlite with a simulated provider. It uses a fixture schema and does not establish behavior on the hosted service.

## Hosted staging status

`sql/lifecycle-v3-staging.sql` was applied to VeeAys Staging. Rollback-only checks on hosted Supabase verified all ten window boundaries, Day 0 deduplication in both send orders, and Day 2 followed by Day 3 without the legacy 48-hour gap. The staging Worker uses the checked-in v3 sender and template module. One scheduled Day 0 run settled as accepted for `delivered@resend.dev` (Resend receipt `01a1ece2-a4a2-7213-903f-60927d3ebefa`), with the legacy welcome record marked skipped. The staging database is disabled and the Worker is in preview mode with no scheduled triggers.

The Worker requires the exact staging Worker origin and staging Supabase URL, mode `staging-v3`, recipient `delivered@resend.dev`, and caps that match staging control. The hosted results above predate the production-preparation changes.

## Production release and rollback

The production-only migration is `sql/lifecycle-v3-production.sql`. It adds three service-role v3 RPCs, retires the old sequence claim/start RPCs, and sets the existing control caps to 5 per UTC day and 50 per UTC month. The dedicated database gate starts off with a registration cutoff of infinity. The existing coordination control stays available to other senders. The migration preserves every row in the lifecycle delivery ledger, including the nine accepted getting-started receipts observed during preflight.

V3 owns production Day 0. Production has no legacy `welcome_work` RPC and the migration aborts if one exists. The new private welcome ledger retains verified historical receipts or ambiguous holds if any are found. Before activation, reconcile legacy welcome activity by project and import any genuine production receipts or holds while v3 is disabled. Carry forward attempt timestamps, provider IDs and suppression outcomes. Keep the legacy `veeays-welcome` Worker pointed at staging in test mode with its existing five-minute schedule. A production send requires the v3 RPC and is blocked for members with a prior welcome attempt, receipt or hold. The member's Day 0 reservation and the attempt record are committed together before contacting Resend.

The checked-in Worker config sets `LIFECYCLE_V3_ENABLED=false` and the matching caps. Existing Cron Triggers stay in place. If approved later, v3 attaches to the existing `* * * * *` invocation without replacing its normal work. Production sending requires the production Worker mode, an explicit v3 Worker flag, the exact production site and Supabase pair, valid server-side secrets, matching caps, and a separately enabled database gate. The unsubscribe route remains available with the sender off.

Before any approved production release, verify the current Cloudflare bindings and schedules, the migration against a production-shaped restore, and the nine historical receipts before and after. Confirm provider identity, the required sender footer/address, suppression handling, and the live unsubscribe route with a synthetic token. Before a separately approved activation, reconcile legacy welcome evidence, confirm there are no legacy sequence invocations or outstanding attempts, and set `v3_start_at` to the approved cutover time. Keep the cutoff at or after cutover to avoid enrolling accounts registered before the ownership transfer.

For an approved rollback, run `sql/lifecycle-v3-production-rollback.sql` to commit the database stop first. Switch off the Worker v3 flag and let already-started requests settle. Keep the unsubscribe route available for links already sent. If a full code rollback is needed, the pre-release Cloudflare version is `0cc50dcb-cc20-422c-a57b-4c421a019d60`. Preserve the four existing production schedules and confirm or restore unsubscribe routing before using that version after sends have begun. Run the rollback SQL again after leases expire to hold unresolved starts, then reconcile those holds against provider receipts using the stored delivery IDs and idempotency keys. Leave the schema, ledgers, legacy send fence and caps in place. Never replay an ambiguous attempt automatically.

Production fixture check:

```sh
node --test test/lifecycle-v3-production.test.js
```
