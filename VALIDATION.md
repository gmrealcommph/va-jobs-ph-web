# VeeAys manual Resend validation — October 3, 2026

The final Cloudflare Wrangler 4.144.0 deployment dry run passed. All 15 new notification tests passed (`node --test test/notifications.test.js`), covering preview without writes, authorization/ID/email/confirmation guards, entitlement and opt-out checks, rechecking before send, removed jobs, daily-digest skipping, HTML escaping, successful acknowledgement, rejection, timeouts, receipt/acknowledgement failures, retry cutoff, changed payloads, concurrent reservation and another explicitly allowlisted ID. The PowerShell helper's syntax also parsed successfully.

The combined suite ran: 26/30 passed. The four original frontend tests fail identically in the untouched supplied ZIP. Original tests are retained unchanged. Their assertions expect outdated category quoting, reject legitimate brand image tags, expect unformatted pagination text, and expect a direct external Apply link instead of the existing `/apply/{id}` route.

File hashes confirm `src/auth.js`, `src/data.js`, `src/render.js`, all public assets, original tests, package manifest, lockfile and Wrangler configuration are unchanged. `src/worker.js` adds only the notification-module import and route dispatch. README and this validation note are updated.

The release ZIP excludes live credentials, dependencies, build output, local configuration and logs. The SQL migration has not been executed against the live database. Runtime bindings, permissions, Supabase reads, Resend acceptance and inbox delivery require the documented controlled live test. No real deployment or email send occurred, and no cron or scheduled handler was added.

## Original Saved Jobs + Application Tracker validation

Validated for this build:
- `node --check src/worker.js`
- `node --check src/render.js`
- `node --check src/auth.js`
- `node --check src/data.js`
- Saved/unsaved actions are authenticated POST requests protected by existing same-origin POST check and Supabase RLS.
- Application status is server-allowlisted to applied/interview/offer/hired/rejected/withdrawn.
- Notes are capped at 2,000 characters server-side.
- Logged-out Save preserves a strict local return path and resumes on the job detail page.
- Apply remains separate from application tracking; applications are only tracked when the user explicitly selects Mark as applied.
- Existing Free/Pro match entitlement remains database-enforced.

`npm test` was also run. 11/15 existing tests pass. The 4 failures are pre-existing expectation/fixture mismatches (category filter quoting, literal escaped tag assertions, and Apply-link expectations) and are not runtime syntax failures introduced by this feature.
