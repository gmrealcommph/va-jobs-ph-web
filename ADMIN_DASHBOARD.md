# Private VeeAys admin dashboard

Route: `/admin`. Sign in through the existing VeeAys login. The private
`veeays_admin.accounts` allowlist initially contains the existing account
selected by the owner. Email changes do not change authorization: the
allowlist stores the verified immutable Supabase user ID.

Both the HTML route and `/admin/api/analytics` require a server-verified
Supabase session and database authorization. Anonymous callers cannot execute
either public RPC. Members cannot read or edit the allowlist. The dashboard
uses the user's JWT and publishable key, never the service-role key.

Public RPCs are security invokers forwarding to private, fixed-query
functions. The private analytics function validates `auth.uid()` against the
allowlist before reading data. Its fixed search path and fully qualified
relations prevent object substitution. No dynamic SQL or writes are present.
Its maximum query window is 91 inclusive Manila dates and its configured
statement timeout is 8 seconds. Only aggregate totals and bounded operational
rows leave the database; member names, emails and payment identifiers do not.

## Metric definitions

- Registered members: `auth.users` rows, including unconfirmed registrations.
- Active Pro access: active Pro profiles whose expiry is future or unlimited.
- Paid Pro members: active Pro profiles with at least one confirmed live
  payment. This is not a recurring subscription count.
- Revenue: confirmed live `pro_payments`, grouped by currency, divided from
  minor units by 100, filtered by paid date. Test records are excluded.
  PHP has a daily chart. Revenue is gross before provider fees and does not
  establish refund reconciliation.
- Payment events: current checkout-record statuses created in the period;
  this is not an immutable webhook-event history.
- Live jobs: the existing `public_jobs` eligibility/deduplication view.
- New jobs: source rows created in the selected period; the currently live
  subset is shown separately.
  The daily new-jobs chart and its data table exclude the initial bulk import
  on October 2, 2026 (1,855 rows). Summary totals still include that day.
- Quick Read completions: current ready records with generation dates in the
  period. Errors are current failures updated in the period. Current queue
  and cache status counts are snapshots independent of period filters.
- Cost reservations: existing pilot row, unchanged. These are budget holds,
  not actual provider billing.
- Import health: latest collection timestamps and new source-row counts.
  Collection older than 24 hours is flagged for review; no source-specific
  schedule or importer run history is claimed.

Visitor tracking, recurring subscription history, actual OpenAI spend and
dedicated import-run/error logs are not connected. Historical transitions
cannot be reconstructed from current-state tables and are labeled accordingly.

## Deployment and validation

Apply `migrations/admin-dashboard.sql` before deploying the Worker. This is
an additive dashboard migration; it does not mutate Quick Read control/queue
or payment records. It has been applied to the specified production project.
The existing RLS allowlist intentionally has no member policies: denied by
default, with direct grants revoked.

The remote GitHub checkout lagged the deployed Worker. Five source paths were
restored from the already deployed production package before adding admin
routes. The resulting baseline bundle matched the downloaded live Worker
byte-for-byte after line-ending/source-map-comment normalization. Production
Quick Read schedule and activation variables are preserved in configuration.
Existing bindings/secrets remain through `keep_vars: true`.

Dashboard tests: `node --test test/admin.test.js` (10 passing). Production SQL
checks confirmed admin data, non-admin rejection, and denied anonymous RPC and
allowlist privileges. Desktop/mobile UI was checked with a production-data
snapshot: eight cards, four charts, no browser errors or page overflow.
The full suite has 35 existing failures; comparison with the identical
production baseline found no new failures. Four tests are skipped.

Rollback Worker to the version recorded in the release report. The additive
database functions can remain with the Worker rolled back; only the allowlisted
user can call them. Keep Quick Read controls and payment processing untouched.
