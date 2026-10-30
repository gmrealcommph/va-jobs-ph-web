# Operations HQ: staging-only deployment plan

**Never use `npm run deploy` or `wrangler.jsonc` for this.** `wrangler.jsonc` is the PRODUCTION Worker
(`va-jobs-ph-web`, production Supabase `nwqmhqiymtqkdihjadrp`, live PayMongo, four crons).

## Target
- Config: `wrangler.paymongo-test.jsonc` (existing, dedicated TEST Worker)
- Worker: `veeays-paymongo-test`, account `e3383856f0658ad90cee219395f6e91e`, `workers_dev: true`, no routes, `crons: []`
- Origin: `https://veeays-paymongo-test.gm-realcommph.workers.dev`
- Supabase: `https://megedmsfdwtjxjejrxaq.supabase.co` (staging). `PAYMONGO_MODE=test`; digest, strong-match and Quick Read modes disabled.
- Secrets already stored for this config only: `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYMONGO_TEST_SECRET_KEY`. Ops HQ needs only the publishable key and the signed-in admin's session. No new bindings, vars or secrets.
- `ADMIN_API_LIMITER` is not bound in any config; only the in-Worker limit (30 requests/min/user) applies. Optional hardening, not required.

## Preconditions (staging database, run by someone with access; read-only checks)
```sql
select current_database();                       -- and confirm the dashboard URL is project megedmsfdwtjxjejrxaq
select p.proname, pg_get_function_identity_arguments(p.oid) args,
       has_function_privilege('anon', p.oid, 'execute') anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') auth_exec
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('veeays_admin_access','veeays_admin_analytics','veeays_admin_quick_reads',
  'veeays_admin_extended','veeays_admin_registration_snapshot','veeays_admin_payment_snapshot');
-- expect 6 rows, anon_exec = false, auth_exec = true
select count(*) from veeays_admin.accounts;     -- the tester must be listed (admin access)
```
If any RPC is missing, the repo migrations that define them are `migrations/admin-dashboard.sql`, `admin-quick-reads.sql`,
`admin-extended.sql`, `admin-registration-notifications.sql` and `supabase/migrations/20261009012419_admin_payment_notifications.sql`.
Applying them to staging is a separate approval; this PR adds no migration.

## Known staging findings (read-only inspection, Oct 31)
- Project confirmed: dashboard `VeeAys Staging`, ref `megedmsfdwtjxjejrxaq`.
- Present, correct signatures, `SECURITY DEFINER` inner functions with `search_path=''` and statement timeouts (analytics/extended 8 s, quick_reads 5 s, registration 3 s); `anon` cannot execute, `authenticated` can; each denies non-admin sessions (error 42501). Deployed `has_access` additionally requires a live session (`veeays_admin.member_active()`).
- **MISSING on staging: `public.veeays_admin_payment_snapshot` (and `veeays_admin.payment_snapshot`).** The migration `supabase/migrations/20261009012419_admin_payment_notifications.sql` is not applied. Effect without it: Pro "upgrades today" shows a dash, `incomplete: true`, Admin data = Warning. Everything else works. Applying that migration to staging needs separate approval.
- Staging automation and gate are disabled (Reads worker = Unknown, as designed). Staging data is small (16 members, 3.6k jobs, 3.1k reads).

## Deploy (only after explicit approval)
```powershell
git fetch origin; git switch feat/ops-hq-endpoint; git rev-parse HEAD        # expect 2ad5d8a (or later reviewed commit)
npm ci
npm test -- test/ops-hq-client.test.js test/admin-ops-hq.test.js test/admin.test.js
npx wrangler deploy --config wrangler.paymongo-test.jsonc --dry-run --outdir dist-staging   # check name = veeays-paymongo-test
npx wrangler deploy --config wrangler.paymongo-test.jsonc
```

## Validation (staging origin)
1. Signed out: `/admin/ops-hq` -> 303 to `/login?return=%2Fadmin%2Fops-hq`; `/admin/api/ops-hq` -> 401.
2. Signed in as a NON-admin: both -> 403, and the page body contains no scene markup.
3. Admin: `/admin/ops-hq` 200 with a `content-security-policy` header, `cache-control: private, no-store`; `/ops-hq/ops-hq.js`, `three.min.js`, `bg.jpg`, 8 `m_*.bin` all 200.
4. `/admin/api/ops-hq` keys: `events, generated_at, has_more, incomplete, metrics, stale`. Compare intake/jobs/reads/pro numbers with `/admin`.
5. Chief of Staff, delivered/bounced and Jobs "processing" show a dash, never 0. Referral shows real counts (staging: 3 verified signups, 0 live eligible conversions, 0 holds). With the payment RPC still missing, Pro upgrades today shows a dash. Health card reads "Admin data" / "Reads worker".
   Note: staging has no cron, so "Reads worker" can legitimately show Warning/Critical if the staging queue has due items and automation is on in the DB.
6. Live mode: pressing Good/Alert changes no number. Create one staging signup: after the next poll the Intake desk reacts once and the total rises by 1.
7. Leave open 10 minutes: no 429, DevTools console clean, Supabase dashboard (staging) query load flat. Hide the tab: polling stops.
8. Break one RPC on staging only (e.g. revoke execute from `authenticated` on one snapshot RPC, then restore): payload keeps serving last good data, then `stale: true`, database health "warning".
9. MatePad: load time, frame rate, memory.

## Rollback
- Fastest, no data involved: `npx wrangler rollback --config wrangler.paymongo-test.jsonc` (previous version of `veeays-paymongo-test`); list first with `npx wrangler deployments list --config wrangler.paymongo-test.jsonc`.
- Remove the feature without code changes: nothing to toggle; the route is admin-only. To remove the Worker entirely: `npx wrangler delete --config wrangler.paymongo-test.jsonc` (staging Worker only).
- No database change is made by this release, so there is nothing to roll back in Supabase.
- Production is untouched: its Worker name, routes, crons, vars and database are never referenced by the commands above.
