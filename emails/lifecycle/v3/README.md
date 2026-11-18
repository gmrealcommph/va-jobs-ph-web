# VeeAys lifecycle v3

The ten lessons have Free and Pro HTML and plain-text variants. Free members with timely consent for both tips and Pro promotions receive the Free version. Pro members and Free members who consented only to tips receive the education-only Pro version. Resend holds matching drafts. The staging sender uses the checked-in HTML and text so it can freeze the exact provider payload without publishing a draft.

The schedule uses elapsed time from original registration. Days 0, 2, 3, 5, 7, 10, 14, 19, 24 and 30 each have one 24-hour window. Expired windows are never replayed. Day 0 can use consent granted during its open window so that a member can confirm and opt in after registration. Later lessons require consent by the start of the corresponding window. All lessons require current consent and a confirmed email.

The v3 sender drops the legacy 48-hour confirmation delay and sequence-to-sequence gap. It retains active-send and existing alert/digest coordination. The database locks the control row when reserving capacity and checks exact equality with the Worker's daily and monthly caps. It also rechecks eligibility and tier before storing the payload and marking the attempt. The ledger and provider idempotency key use stable member/step delivery IDs. An ambiguous provider outcome is held for manual reconciliation.

The existing welcome RPC and v3 Day 0 serialize on the welcome delivery record. If the existing welcome RPC prepares first, its attempt blocks v3. If v3 starts first, it atomically marks the simulator account's welcome record skipped so the existing Worker cannot prepare another send. The migration leaves the welcome RPC definition unchanged.

## Local verification

```sh
node scripts/build-lifecycle-v3.mjs --check
node --test emails/lifecycle/v3/schedule.test.mjs test/lifecycle-v3.test.js
```

After editing templates, regenerate the Worker bundle module with `node scripts/build-lifecycle-v3.mjs`. The integration suite executes the SQL against local Postgres via PGlite with a simulated provider. It uses a fixture schema and does not establish behavior on the hosted service.

## Hosted staging status

`sql/lifecycle-v3-staging.sql` was applied to VeeAys Staging. Rollback-only checks on hosted Supabase verified all ten window boundaries, Day 0 deduplication in both send orders, and Day 2 followed by Day 3 without the legacy 48-hour gap. The staging Worker uses the checked-in v3 sender and template module.

The Worker requires the exact staging Worker origin and staging Supabase URL, mode `staging-v3`, recipient `delivered@resend.dev`, and caps that match staging control. Production authorization, production-cap selection and any required sender mailing address remain separate rollout decisions.
