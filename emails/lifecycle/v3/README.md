# VeeAys lifecycle v3

The ten lessons have Free and Pro HTML and plain-text variants. Free members with timely consent for both tips and Pro promotions receive the Free version. Pro members and Free members who consented only to tips receive the education-only Pro version. Resend holds matching drafts. The staging sender uses the checked-in HTML and text so it can freeze the exact provider payload without publishing a draft.

The schedule uses elapsed time from original registration. Days 0, 2, 3, 5, 7, 10, 14, 19, 24 and 30 each have one 24-hour window. Expired windows are never replayed. Day 0 can use consent granted during its open window so that a member can confirm and opt in after registration. Later lessons require consent by the start of the corresponding window. All lessons require current consent and a confirmed email.

The v3 sender drops the legacy 48-hour confirmation delay and sequence-to-sequence gap. It retains active-send and existing alert/digest coordination. The database locks the control row when reserving capacity and checks exact equality with the Worker's daily and monthly caps. It also rechecks eligibility and tier before storing the payload and marking the attempt. The ledger and provider idempotency key use stable member/step delivery IDs. An ambiguous provider outcome is held for manual reconciliation.

The separate welcome RPC and v3 Day 0 share the preferences-row lock. The first workflow to prepare a provider attempt claims welcome for that member. Existing welcome attempts and accepted receipts also block Day 0. The staging coordination is scoped to the Resend simulator address.

## Local verification

```sh
node scripts/build-lifecycle-v3.mjs --check
node --test emails/lifecycle/v3/schedule.test.mjs test/lifecycle-v3.test.js
```

After editing templates, regenerate the Worker bundle module with `node scripts/build-lifecycle-v3.mjs`. The integration suite executes the SQL against local Postgres via PGlite with a simulated provider. It uses a fixture schema and does not establish behavior on the hosted service.

## Hosted staging status

The automatic approval review rejected applying `sql/lifecycle-v3-staging.sql` to Supabase because it changes the welcome RPC in a shared schema. The staging database control is disabled, and the existing staging Worker remains in preview mode with no schedules. Hosted staging delivery and welcome-worker concurrency tests are pending migration approval and deployment. Before starting those tests, verify the separate welcome Worker's staging database target and use the simulator address only.

The Worker requires the exact staging Worker origin and staging Supabase URL, mode `staging-v3`, recipient `delivered@resend.dev`, and caps that match staging control. Production authorization, production-cap selection and any required sender mailing address remain separate rollout decisions.
