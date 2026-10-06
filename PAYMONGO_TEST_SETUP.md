# VeeAys Pro checkout V1 — TEST implementation and setup

Implemented locally in `C:\Users\gmrea\Documents\GitHub\va-jobs-ph-web`, based on commit `ca3ba5e78d3d9cc55eee0b8dce3e5130388942cf`. No commit, push, deployment, database migration, provider API request, or charge was performed. The running Quick Read batch was not touched.

## Exactly what changed

- `src/pro-checkout.js` (new): authenticated, same-origin POST `/pro/checkout`; test account allowlist; server-only PayMongo Basic authentication; unique UUID reference and Supabase record; ₱499 = 49,900 centavos, PHP, one item, QRPh only, no passed-on fees; hosted checkout redirect. Only `sk_test_` credentials are accepted.
- `src/worker.js`: routes `/pro/checkout`, `/pro/return`, `/webhooks/paymongo` to the payment module; permits `/pro` as a post-login destination; exposes the form only to allowlisted test users. Pro page CSP permits the hosted checkout redirect for those users only. All existing Quick Read and scheduled routes remain intact.
- `src/render.js`: retains existing Pro page markup/classes/illustrations; adds the test checkout/renewal form for allowlisted accounts. Pro page price now says ₱499 for 30 days, one-time purchase, no automatic renewal. Other pages, public assets, styling, and homepage discovery remain unchanged.
- `migrations/005_pro_test_checkout.sql` (new): private TEST payment ledger with checkout/payment IDs, user, amount, currency, status, timestamps and entitlement before/after/outcome. Unique payment and checkout IDs prevent reuse. RLS and grants exclude browser roles. A service-only atomic RPC locks the receipt and existing profile, credits once and updates `profiles.plan`, `plan_status`, and `pro_expires_at`. A profile trigger prevents browser roles from changing entitlement even through an older security-definer RPC; name/onboarding updates remain possible.
- `test/pro-checkout.test.js`, `test/pro-checkout-db.test.js` (new): HTTP/provider mocks and executed PostgreSQL migration tests. `test/pro-discovery.test.js`: adjusts the existing price-copy expectation.
- `wrangler.paymongo-test.jsonc` (new): separate TEST Worker with placeholders, no crons, email schedules disabled and Quick Read generation disabled. Production `wrangler.jsonc` remains unchanged.
- `PAYMONGO_TEST_SETUP.md` (this guide copied into the repo).

## Behavior and security

The browser cannot supply the amount, user, reference, redirect target or entitlement. Checkout records belong to the Supabase-authenticated user. The TEST secret key, webhook secret and Supabase server key remain in Worker secrets and never enter the HTML or browser script.

Webhook verification uses HMAC-SHA256 over `timestamp.rawBody`, the `te` signature, rejects live signatures/events, and enforces a five-minute signature timestamp tolerance. The handler accepts only `checkout_session.payment.paid`. It matches the server-created checkout ID and reference, then retrieves that checkout from PayMongo using the TEST secret. The retrieved resource must be test-mode, contain exactly one paid QRPh payment for PHP 49,900, matching line items, and a valid `paid_at`. Refunded/disputed payments fail validation. A dashboard sample event cannot grant access unless an actual matching paid TEST checkout exists in PayMongo.

The database transaction grants 30 days from the provider's successful-payment timestamp. For active Pro with an expiry later than that timestamp, it extends the existing expiry by 30 days. Duplicate/retried deliveries return the recorded outcome without crediting again. Separate purchases for the same profile serialize through a profile lock. Database failures roll back the entitlement and receipt together. Existing active Pro with NULL expiry means unlimited access in this architecture; it stays unlimited and records `unlimited_preserved` rather than shortening access.

GET `/pro/return?payment=<record UUID>` performs only an ownership-filtered database read. It never contacts PayMongo or writes entitlement. It displays pending/confirmed/creation-failed states with a refresh link and no-store/noindex headers. A cancel return also remains pending unless the webhook has confirmed payment; a browser return is not proof of cancellation or success. Logged-out requests receive 401; another user's record returns 404.

The ledger stores `creating`, `pending`, `creation_failed`, or `confirmed`. Unpaid/expired sessions remain pending; automatic expiry reconciliation, refunds, subscriptions, and live payment support are outside V1. Failed provider creation is not automatically retried because a timed-out request may already have created a session. A customer must start a new checkout explicitly. If a database failure occurs after provider session creation, reconcile that orphan by its reference before testing another payment; there is no automatic fulfilment of unknown/unbound sessions.

## Assumptions and PayMongo contract

Documentation checked 6 October 2026:

- [Hosted Checkout](https://docs.paymongo.com/docs/payment-channels-hosted-checkout): POST `/v2/checkout_sessions`, QRPh, reference_number, checkout_url, and the newer `send.webhook` event envelope.
- [Get checkout session](https://docs.paymongo.com/reference/get_checkout_sessions): GET `/v1/checkout_sessions/{id}`, including newer and legacy resources.
- [Checkout Session Resource](https://docs.paymongo.com/reference/checkout-session-resource): attributes.livemode, reference_number, line_items and payments; payment attributes status, amount, currency, paid_at and source.
- [Webhook signature setup](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management): raw-body HMAC with `t`, `te`, `li` header fields.

Supports both `{data:{id,type:"event",attributes:{type,livemode,data:session}}}` and `{event_type:"send.webhook",data:{type,livemode,data:session}}`. Newer envelopes without an event ID record NULL; idempotency depends on the stored checkout/payment, not an optional event ID. Missing mode or paid_at is rejected rather than guessed. An actual TEST QRPh smoke check must verify the account emits these fields and that v2 resources are retrievable through the documented v1 GET. Retry deliveries are expected to have a current delivery-signature timestamp; if the account reuses an old timestamp, investigate before changing tolerance. No real provider exchange was run here.

The repo contains migrations 001–004 but not the original profile/auth schema. I inspected the existing profile reads, RPC usage, entitlement checks and migration references; I did not inspect the connected live database. Migration tests use the known profile field contract. Confirm the actual staging schema and auth-trigger behavior before deployment; preserve the established schema rather than creating a replacement entitlement system.

## Alfred's manual setup/deployment steps

1. In GitHub Desktop select **va-jobs-ph-web → main**. Review only the files listed above. Commit with **Add PayMongo TEST Pro checkout**, then push when ready. Commit/push alone does not deploy.
2. Create a **separate staging Supabase project** containing the existing VeeAys schema, auth/profile creation triggers, existing RPCs/RLS and migrations 001–004. Copy schema through the established backup/restore process; do not point the TEST Worker at the production project. Create only disposable test accounts/data. This implementation writes real Pro fields in whichever database is configured, so staging is essential to avoid test payments granting production membership.
3. In staging SQL Editor inspect the profile columns, triggers, RLS, policies and browser RPC permissions. The required fields are `profiles.id`, `plan`, `plan_status`, `pro_expires_at`; plan values `free`/`pro`, status `active`, and NULL expiry for unlimited Pro must match the established schema. Suggested read-only inspection:

   ```sql
   select column_name,data_type,udt_name,is_nullable,column_default
   from information_schema.columns where table_schema='public' and table_name='profiles';
   select conname,pg_get_constraintdef(oid) from pg_constraint where conrelid='public.profiles'::regclass;
   select tgname,pg_get_triggerdef(oid) from pg_trigger where tgrelid='public.profiles'::regclass and not tgisinternal;
   select * from pg_policies where schemaname='public' and tablename='profiles';
   select pg_get_functiondef(oid) from pg_proc where pronamespace='public'::regnamespace
     and proname in ('update_my_profile','get_my_job_matches','get_my_match_summary');
   ```

4. Run **`migrations/005_pro_test_checkout.sql` once** in staging SQL Editor. It is transactional and intentionally not an idempotent rerun script. Do not apply it to production for this TEST rollout.
5. Configure `wrangler.paymongo-test.jsonc`:
   - Keep name `veeays-paymongo-test`, distinct from production `va-jobs-ph-web`.
   - Set `SUPABASE_URL` to the staging project URL.
   - Set `SITE_URL` to the exact HTTPS TEST Worker origin, e.g. `https://veeays-paymongo-test.<your-workers-subdomain>.workers.dev` (replace with your actual address; no path).
   - Keep `PAYMONGO_MODE` = `test`; never set it to live.
   - Set `PAYMONGO_TEST_USER_IDS` to one or more staging Auth user UUIDs, comma-separated. Create the account in staging first if needed; use its UUID, not its email.
   - Leave the disabled modes and absence of crons intact.
6. From PowerShell in `C:\Users\gmrea\Documents\GitHub\va-jobs-ph-web`, store secrets **for this config only**, entering values at each prompt:

   ```powershell
   npx wrangler secret put SUPABASE_PUBLISHABLE_KEY --config wrangler.paymongo-test.jsonc
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.paymongo-test.jsonc
   npx wrangler secret put PAYMONGO_TEST_SECRET_KEY --config wrangler.paymongo-test.jsonc
   ```

   Use both Supabase keys from staging, and only PayMongo's `sk_test_...` secret. Modern `sb_secret_...` and legacy service-role JWT server keys are supported. Do not put secret values in this config, source files, screenshots, chat, or commits.
7. Deploy only the separate Worker:

   ```powershell
   npx wrangler deploy --config wrangler.paymongo-test.jsonc
   ```

   Until its webhook secret is configured, checkout returns a safe 503. Do not run `npm run deploy` for this TEST rollout: that targets the existing production Worker.
8. In staging Supabase Authentication → URL Configuration set the staging site URL to the TEST origin and allow `<TEST origin>/auth/callback` for email confirmation. Verify one staging signup, profile creation and onboarding update work with the new profile protection trigger. Add the actual test account UUID to the allowlist and redeploy the test config if necessary.
9. In PayMongo **TEST mode** Developers/Settings → Webhooks, add `<TEST origin>/webhooks/paymongo`, subscribe to `checkout_session.payment.paid`, and enable it. Copy that endpoint's signing secret into the TEST Worker:

   ```powershell
   npx wrangler secret put PAYMONGO_TEST_WEBHOOK_SECRET --config wrangler.paymongo-test.jsonc
   ```

   Ensure PayMongo TEST QRPh is available for this account. If unavailable, stop and resolve TEST onboarding with PayMongo; do not switch keys or pay with a real wallet.
10. Log in at the TEST site with the allowlisted staging account, open `/pro`, and click the TEST purchase button. Verify PayMongo itself shows test mode, PHP 499.00, QRPh and the unique reference. Use only PayMongo's documented sandbox simulator/Test payment controls. **Do not scan/pay with a real banking or wallet app.** If a sandbox QRPh simulator is not offered, stop and ask PayMongo for the supported test workflow.
11. Before completing the sandbox payment, open the return URL from the ledger in another tab: it must show pending and leave the profile Free. After the successful sandbox payment, verify the webhook delivery is 200, the return page confirms, and staging `profiles` expiry is exactly paid_at + 30 days. Start another sandbox purchase while Pro and verify +30 days from the existing expiry. Resend the same real TEST event; expiry must remain unchanged.
12. Inspect staging SQL:

   ```sql
   select id,user_id,checkout_id,payment_id,event_id,status,amount,currency,livemode,
          created_at,paid_at,confirmed_at,entitlement_before,entitlement_expires_at,entitlement_outcome
   from public.pro_test_payments order by created_at desc;
   select id,plan,plan_status,pro_expires_at from public.profiles
   where id = '<TEST_AUTH_USER_UUID>'::uuid;
   ```

   Confirm another user cannot read the return record, non-allowlisted users cannot create checkout, forged signatures fail, and the return page never upgrades by itself. A manually edited/sample dashboard payload should not activate an unpaid checkout.

Do not change the existing production Worker variables, crons, Quick Read keys, batch process, migration 004, or pipeline while setting this up. To stop testing, disable the TEST webhook and set test config `PAYMONGO_MODE` to `disabled` (redeploy the TEST Worker only). Live payments require a separate reviewed implementation; V1 deliberately refuses live credentials and events.

## Validation results

- 36 payment/adjacent regression checks passed, including 17 new payment checks and actual migration execution with PGlite/PostgreSQL semantics.
- Production-config dry-run build passed; separate TEST-config dry-run build passed. These were packaging checks, not deployments.
- Full suite: 219 tests, 210 passed, 4 skipped, 5 failed. All five failures reproduce against unchanged baseline code: digest default-disabled check and four existing job-page assertions (search/pagination, unsafe application-link presentation, page canonical and original application-link expectation). No attempt was made to change those unrelated behaviors.
- Provider traffic was mocked in tests. The migration was executed only against local test databases. No connected Supabase schema changes or real PayMongo calls were made.
- HTML checks verify existing Pro classes, account-gated form, return states, caching and CSP. No new desktop/mobile screenshot review was performed; the required staging smoke check should include narrow-screen Pro/return layout and hosted redirect behavior.
- Overlapping deliveries were tested through queued calls in the embedded database, along with transaction rollback and unique-payment reuse. Real multi-connection concurrency is protected by SQL row locks, but was not stress-tested against hosted Supabase.
