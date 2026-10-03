# VeeAys Saved Jobs + Application Tracker validation

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
