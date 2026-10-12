# Job Freshness findings — October 12, 2026

Read-only source checks started October 12, 2026 at 5:46 PM Manila time. This is a time-bounded observation, not a guarantee that employers will keep applications open. No records were hidden, deleted or changed. All 485 priority records were attempted.

| Priority group | Listings | Exact public employer-source match | Source match plus both links checked successfully | Unresolved combined checks |
|---|---:|---:|---:|---:|
| Provisional over 45 days | 348 | 171 | 166 | 182 |
| Missing legacy posting date | 137 | 137 | 135 | 2 |

“Open” requires the exact posting in a recognized employer ATS API and successful checks of both the stored original link and the current API application URL. HTTP 200 alone is never treated as open evidence. No job was confirmed closed.

Of the 348 provisional older records: 9 Greenhouse, 33 Ashby and 124 Workable listings passed the combined check. Workable failures/rate limits account for 109 unresolved records; all 73 Himalayas records require employer-source investigation because their stored application links point to the aggregator and returned access restrictions. Unsupported employer hosts require manual review; the verifier does not widen its URL allowlist from listing content.

All 137 missing-date listings are from Lever and matched currently published exact IDs. 135 passed both link checks; 2 need a retry. The importer intentionally sets Lever posted_at to null; the public API does not provide employer-original dates. Missing dates are not evidence of closure.

No employer-original posting dates were recovered. Ashby supplied 33 last-publication dates, stored separately. Its documentation explicitly defines publishedAt as last publication. Greenhouse update dates, Workable creation dates and Himalayas aggregator publication dates must also not be treated as original employer posting dates. Import time and last checked/verified time remain distinct.

Earlier preliminary checks had more successful links. The stricter final pass checked both original and current application URLs and encountered source rate limits. This report uses the final conservative snapshot. Unknown is neither closed nor permanently broken. Rate-limited hosts stop receiving further requests during a run; no bypass or CAPTCHA solving was attempted.

Evidence is in evidence/job-health-20261012/verification.json and job-source-verification.csv in the originating chat outputs. No verification evidence was imported into production. The evidence importer was exercised in dry-run mode only: 485 proposed observations, zero visibility changes.

Implementation: gated authenticated member reports; admin Job Health metrics, filters and review queue; reasoned and revision-protected review/report decisions; advisory evergreen expiry; append-only source evidence; preserved import time and successful verification history; an opt-in bounded verifier with no registered cron. Automatic hiding is absent from this release. A companion importer branch replaces hard deletion with retained inactive records, preserving its existing classification outcome.

Deployment decisions: review the source findings; approve the companion importer retention release and additive database migration/staging checks; approve review-only UI deployment and report activation; separately approve any verification schedule/evidence import. Automatic hiding needs a later approved change. Cloudflare builds remain paused. Neither pull request should be merged or deployed as part of this task.
