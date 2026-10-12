# Personalized Job Alerts — local implementation and dry run

12 October 2026, Manila. No deployment, production SQL installation, scheduling, email sending, secret change or billing change was performed.

## Verified baseline

The preserved source at commit `f869f02` includes reconciled main/Job Health and the latest deployed Quick Reads credit/backlog fixes. A clean rebuild of that commit exactly matched the production Worker downloaded read-only at 22:53 Manila. Its previously stored dist file was older; the clean rebuild resolved that discrepancy. See production-baseline-check.json. Work is isolated on feature/personalized-job-alerts in this chat's work/repo checkout. The other chats' checkouts were not edited.

Inspected member profiles, actual Pro expiry checks, Auth email confirmation, account deletion preparation and cleanup, public_jobs deduplication/visibility, Job Health observation identity, importer record retention and salary enrichment, current notification queues, sender configuration and connected Resend usage. Job Health's review-only behavior and import dates are preserved. Quick Reads and Telegram implementation/configuration are untouched.

Production currently has the legacy DAILY_DIGEST_MODE and STRONG_MATCH_MODE enabled. This task did not enable or disable them. The candidate release defines JOB_ALERTS_MODE=disabled and suppresses the legacy scheduled email handlers whenever the new mode is defined. Live activation additionally requires both legacy modes to be explicitly disabled. This handoff is deliberate and must be reviewed before deployment; it avoids overlapping senders and keeps instant alerts off in this release.

## Member experience

My Job Alerts at /job-alerts offers actual job categories and employment types, optional minimum recorded USD salary with hourly/monthly/yearly period, inclusion of unknown salaries, explicit opt-in, weekly free delivery and daily active-Pro delivery. Navigation links to it; the old email preferences URL redirects after the new mode is configured. Pro promotion wording no longer promises instant strong-match emails.

No existing profile or legacy email checkbox is treated as new consent. Saving these settings records consent version/time and retires the member's legacy email opt-ins. Matching profile preferences are otherwise unchanged. Pro authorization uses profiles.plan, plan_status and pro_expires_at, never editable Auth metadata. Expired Pro daily settings fall back to weekly, with the page explaining that behavior. Bounced/complained recipients remain suppressed even if they try toggling opt-in again; support review is required.

## Matching policy implemented

- Intersect with public_jobs and recheck through the publishable key before sending; require active and Philippines eligible. Public deduplication remains authoritative.
- Match selected categories and employment types exactly. Any selection is allowed; unknown types are excluded when specific types are selected.
- Salary uses only the importer's recorded USD minimum and exact pay period. No currency conversion or inferred hourly/monthly/yearly conversion. No original salary is invented. Unknown salary inclusion is explicit; a known different period does not satisfy the selected minimum.
- Seven-day first-import lookback, after consent, capped at ten jobs per digest. Daily delivery uses the same seven-day unseen pool so overflow can be picked up on later days. UTC midnight cutoffs correspond to 8 AM Manila. Weekly delivery is Monday. Import timestamps are never represented as employer posting dates.
- Exclude employer/source posting dates older than 45 days and latest matching-source observations that say closed. Hidden/inactive/ineligible/deduplicated jobs disappear on recheck. New imports with unknown employer dates may qualify; that does not claim their employer date is recent.
- Deduplicate per member by normalized employer/title, including across import IDs. First provider attempt reserves those keys, preventing a new digest from repeating an uncertain send. Accepted sends mark the reservation accepted. This deliberately favors avoiding duplicates over resending uncertain jobs. A genuinely reposted role with the same employer/title also stays suppressed for that member until reviewed.
- No alerts for pre-consent imports and no initial historical catch-up. Empty digests send nothing.

## Delivery and privacy

Separate private schema with RLS and explicit function grants; member RPCs use auth.uid and never take a caller-supplied recipient ID. All alert settings/history/reservations/events cascade on Auth deletion. Prepared deletion excludes recipients immediately; a short send barrier prevents completed deletion or confirmed opt-out racing an authorized provider request. If a provider request is already in flight, unsubscribe/save returns a retry response for up to 30 seconds rather than falsely confirming success. An already accepted email cannot be recalled and may arrive later through the provider.

Digest includes text and HTML versions, a visible no-login unsubscribe link, RFC one-click POST headers, and preferences link. GET only shows confirmation, avoiding link-scanner opt-outs. Random account-scoped unsubscribe tokens do not expose email or member IDs. Privacy disclosure covers purpose, Resend, preferences, consent and retention. Settings are off by default. A verified account email is required.

One recipient per batch invocation; serialized database claims and send-time quota checks, lease fencing, stable per-delivery provider idempotency key and immutable retry payload. Four maximum provider attempts, exponential backoff with jitter and a 23-hour retry horizon. Quotas count attempts, including retries. Defaults: 40 attempts/day, 1,000/month; one-second database claim gate. No OpenAI calls are involved. Unknown or expired outcomes are held, with safe error codes and persistent events, and reserved jobs are not automatically sent again. Changes to eligibility or frozen job data hold delivery instead of sending a stale email.

Signed Resend webhook verifies raw-body HMAC and timestamp, handles bounce/complaint/suppression, and retains early events that arrive before the provider receipt is committed. Provider domain suppression remains an additional safeguard. The webhook secret and sender mailing address are mandatory activation gates. Payloads are cleared after settlement; operational events and terminal deliveries are cleaned after 90 days while enabled. Consent and small deduplication records remain with the account; deletion removes them. Provider suppression identifiers without account links expire after 90 days. Notification outages are contained in the separate batch handler and settings endpoints and do not block signup, payment, jobs or Quick Reads.

## Read-only dry run

At 22:49 Manila: 30 accounts, 27 email-confirmed, 2 currently eligible Pro members. At most 25 confirmed free members could enroll weekly and 2 Pro members daily. Existing 9 job-preference rows/9 legacy daily checkboxes are not migrated as consent.

| Scenario | Count |
| --- | ---: |
| Public visible jobs | 2,315 |
| Weekly freshness/visibility pool | 366 |
| Latest daily-window imports in that pool | 29 |
| Weekly candidates with full-time type | 270 |
| Weekly candidates with part-time type | 30 |
| Weekly candidates with recorded monthly USD minimum >=1,000 | 16 |
| Members opted into this new feature | 0 |
| Actual new-feature recipient sends now | 0 |

These are scenario pools without member preferences/consent cutoff. They are not 366 matches for every member. Each digest contains at most ten, and new consent excludes this historical pool. Actual recipient and matching totals must be rerun after voluntary enrollment and immediately before live sending. No recipient addresses or private preference contents appear in this report.

For context, actual visible job data has 1,475 full-time, 200 part-time and 640 unknown employment types. USD salary enrichment exists on 340 jobs: 109 hourly, 159 monthly and 72 yearly. Original salary_min/salary_max fields are empty, so they are not used or fabricated.

## Provider volume and cost

Connected Resend account read at approximately 22:44 Manila: 6/100 daily and 36/3,000 monthly emails; 10 API requests/second. Domain veeays.com verified, sending enabled, open/click tracking off. Production RESEND_API_KEY presence checked without reading its value. The connector account and production key were not compared by secret value; confirm they belong to the same team during activation.

Remaining snapshot capacity: 94 daily, 2,964 monthly. Daily reset shown by provider is 13 October 2026 at 8 AM Manila; monthly reset is 3 November at 9:13 AM Manila. Quotas are shared with other VeeAys email. Maximum current confirmed enrollment is 27 recipients on a weekly delivery day and 2 on other days, assuming all have new matches. A 31-day month with five Mondays gives a conservative ceiling of 187 digest emails (25*5 + 2*31), plus existing account/welcome/other mail and retries. At that scale, incremental sending cost should be $0 within the connected account's included quota. This is a capacity estimate, not a provider invoice or promise about future usage. No plan upgrade or overage setting is changed. The new caps preserve headroom but cannot reserve capacity against other applications using the same team.

Provider references: https://resend.com/pricing and https://resend.com/docs/dashboard/emails/idempotency-keys. Privacy design follows minimization, consent withdrawal and account deletion principles in https://privacy.gov.ph/data-privacy-act/; sender address and retention policy still need business review before rollout.

## Preview and validation

weekly-digest-preview.html and daily-digest-preview.html use three actual eligible public listings, a synthetic recipient, a synthetic unsubscribe token, and an explicitly marked preview mailing address. No email was sent. Matching source salary is unknown for those listings and is omitted. Text previews are also included. Free/Pro settings HTML previews are included; the browser preview service timed out, so visual browser QA remains an activation prerequisite. HTML content, escaping, native form behavior and accessibility structure are covered by tests.

The candidate installation SQL was executed only in isolated local PGlite databases using the inspected schema contracts. It is provided as reviewed candidate SQL in docs/job-alerts-install.sql, not installed in Supabase and not registered in migration history. Generate the final migration with the team's Supabase CLI process after rollout approval. Public RPC/REST exposure and a staged authenticated browser test must be verified in staging before production.

Final validation: 407 tests passed, 4 existing skips, 0 failures (411 total). New tests exercise real candidate SQL in isolated PostgreSQL-compatible databases, matching/salary filtering, leases, deduplication and uncertain outcomes, quota gates, consent, Pro checks, deletion barriers/cascades, access denial, signed-webhook tampering and early suppression, native form validation, provider idempotency, unsubscribe behavior and endpoint routing. The Worker dry build passed. No database integration tests were run against production.

## Decisions and approval gates

1. Confirm the sender's registered physical mailing address and consent/retention wording. Current draft retains operational history 90 days and deduplication records until account deletion.
2. Confirm fresh opt-in instead of migrating the 9 legacy digest checkboxes, and the planned pause/handoff of existing legacy email senders.
3. Confirm 8 AM Manila daily/Monday weekly timing, seven-day unseen lookback, 45-day posting-date exclusion, ten-job digest cap, exact-period USD salary matching and conservative same-employer/title deduplication.
4. Approve staging installation and a single allowlisted test email separately. Confirm actual production Resend team, webhook configuration/capacity and sender address; do not connect another endpoint blindly because the current account plan permits one webhook endpoint.
5. Only after reviewing the refreshed opted-in dry run and delivery test: separately approve production migration/deployment, legacy sender handoff, database control enablement and JOB_ALERTS_MODE=enabled. No new cron is required: the guarded sender uses the existing digest cron slot. Neither gate is enabled by this task.

A business mailing address and webhook secret are intentionally absent from the candidate configuration. No instant sender is introduced. Rollback is to set JOB_ALERTS_MODE=disabled and control.enabled=false; settings and audit history can remain for review. Do not re-enable legacy senders without a separate duplication/consent review.
