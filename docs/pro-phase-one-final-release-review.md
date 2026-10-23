# VeeAys Pro Phase 1: final release review

23 October 2026, 9:00 PM Manila. PR #45 remains draft and unmerged. No production deployment, database mutation, checkout, payment or AI activation occurred. No new paid AI requests were made.

## GO / NO-GO

| Stage | Engineering decision | Approval still required |
|---|---|---|
| A — application tracker/reminders | GO for a controlled release after approval. Desktop/mobile, access controls, additive migration and production build passed. | Merge the reviewed PR; apply the corrected additive reminder migration; deploy the Stage A Worker/assets and flags. |
| B — source-preserving résumé suggestions and cover-letter drafts | GO for a separately approved, small production pilot after server-side provisioning. NO-GO for activation under current authorization: production has no dedicated Pro AI binding/secrets/spending approval. | Create the budget Durable Object; provision dedicated production provider/cache secrets; authorize the fixed pilot budget; deploy Stage B paused, then separately activate its two paid flags after checks. |

The single tier remains ₱499/30 days, no automatic renewal. Existing active Pro members qualify through existing server-checked profile fields. No new tier, repurchase, payment route or subscription-record change. Features retain the official logo and “Better Jobs. From Home.” branding.

## Final verification and fixes

Browser testing used the final source locally with isolated staging Supabase. The Stage B interactive run used an explicitly labeled synthetic provider adapter, with no provider key and no paid call; the production-entry Stage A run used the real production entry module and disabled AI. These adapters and staging records are not release artifacts. No staging deployment was made for these checks.

- Desktop: 1280px viewport, document width 1265px including scrollbar; mobile: 390×844, document width 375px. No page overflow. Tracker tabs intentionally scroll horizontally inside their own container. Pro action controls measured at least 47px tall on mobile.
- Stage B: consent required, same-site selected job, source-preserving suggestion rendered, explicit Apply and Undo verified, 60-second cooldown displayed, independent source sections shown, cover letter editable, .txt download completed. Mobile Preview exposed the existing résumé PDF controls and a PDF download completed. Original source remained editable; no employer submission occurred.
- Tracker: open/close editor, save Applied→Interview with private notes, filter down to one card, save/persist a reminder, restore original staging stage/notes/reminder, desktop zero-result filter and return to All. Stage A mobile verified the production entry has reminders and no AI links. Existing calendar export returned 200 for its owner and 404 for other staging accounts. Reminders are in-app/calendar exports; no reminder email delivery is claimed.
- Staging-account access: active Pro AI route returns 503 while paused; free and expired accounts return 403. My Jobs remains usable for all three. One initial free-member HTTP check returned 401; direct auth diagnosis and the repeated full non-paid access run passed. It was not a paid request and no auth bypass was introduced.
- Full suite: **555 tests; 551 passed, 4 existing skips, zero failures**. Authentication gate: **28 passed**. Payment/checkout/webhook signature, amount/currency, idempotency, entitlement and database tests are included in the full suite. No real charge or production webhook was exercised.
- Both stage configurations completed Wrangler **dry-run** builds. Each production bundle plus public assets was scanned (148 files per stage) against QA IDs, credentials, staging project IDs, fixture adapter markers and secret-key patterns: **zero matches**. Both built Worker bundles have SHA-256 `cfa78a352fa5295fe844aa46d993c81f5da73b84a92f6e0bf0e063c58b5cece1`.

Two release blockers were discovered and fixed during review:

1. The inherited tracker inline script was blocked by strict CSP, disabling filters/editors. It is now `/application-tracker.js?v=20261023`, loaded with `defer` from the same origin. CSP was not weakened. A regression verifies external loading and simulated filter/editor interactions, followed by actual browser save/filter checks.
2. Supabase default privileges had given `authenticated` TRUNCATE/REFERENCES/TRIGGER rights on the staging reminder table. TRUNCATE bypasses RLS. The migration now revokes all inherited PUBLIC/anon/authenticated grants first, then grants only SELECT/INSERT/UPDATE/DELETE. Staging excess grants were revoked and verified; a regression recreates permissive defaults and confirms TRUNCATE is denied. Production was untouched.

## Production provenance and binding review

Read-only Cloudflare review at 8:42:17 PM Manila confirmed:

- Worker/environment: `va-jobs-ph-web`, production, 100% traffic.
- Version: `ef99f73d-4762-4f18-93a8-dacdb69a06f9`.
- Deployment: `3b2c715b-0596-4d90-ac3c-329adb6a8f2d`, 23 October 2026 4:54:38.707 PM Manila.
- Source: `e3f08a4dc53b477f36bb5c101955c9f9c7779452`, GitHub `gmrealcommph/va-jobs-ph-web`. PR base remains the live-baseline branch `feature/tool-completion-counters`; do not retarget onto an older main without reconciliation.
- Live source-config plain variables have zero differences. Production Supabase is `nwqmhqiymtqkdihjadrp`; staging is isolated in `megedmsfdwtjxjejrxaq`. No staging project binding in production.
- Existing `ASSETS`, `ACTIVE_VISITORS` and secret bindings reviewed by names/types only. Keep existing auth, payment, digest, scheduler, analytics-disabled behavior and secrets. `keep_vars=true` is retained; re-snapshot live settings immediately before any approved release.
- New production `PRO_AI_BUDGET`, `PRO_AI_KEY` and `PRO_AI_CACHE_KEY` are absent. Existing generic/Quick Read keys are not fallbacks for these Pro features. Legacy `RESUME_AI_ENABLED=false` remains mandatory.
- Public checks passed: /, /signup, /login, /resources, /pro, /privacy, /terms, /jobs, /resume-studio returned 200; protected /niche-finder and /my-jobs redirected to login. Signup/login used strict-origin-when-cross-origin and expected forms. One empty form POST /signup returned 303 validation, no account or email. /pro still displays ₱499/30 days and no automatic renewal. These checks do not prove completed account creation or email delivery.

## Database and RLS review

Read-only production catalog checks confirm the reminder table is absent, application user/job types are UUID/bigint, and `job_applications_user_job_unique` supplies the required UNIQUE(user_id,job_id) target despite the existing separate bigint primary key. The production suspension guard `veeays_admin.member_active()` exists; the migration adds its restrictive policy.

The only Phase 1 schema change is `supabase/migrations/20261023091543_pro_application_reminders.sql`: a new table with composite primary key, FK to the owner's existing application with ON DELETE CASCADE, bounded date/label and RLS. Owners read/delete; only active Pro owners insert/update; reassignment is rejected by WITH CHECK. Account/application deletion cascades to reminders. No existing column, application, note, job, payment or subscription is rewritten. The `(user_id,job_id)` primary key supports owner lookups and cascades.

Production has three active Pro entitlement rows in aggregate; no assumption that these equal three paying customers. No member identity or résumé was fetched for review.

Staging policies, grants and constraints were inspected directly. Local PostgreSQL-compatible tests cover permissive default-grant removal, ownership, missing application, expired Pro, suspension, reassignment, anonymous access and account deletion cascade. After the approved production migration, verify grants/policies/guard and schema cache before turning on the feature; migration application itself is not authorized now.

Supabase security advisors reported no reminder-table finding. Existing project findings include `public_jobs` SECURITY DEFINER view, executable legacy SECURITY DEFINER functions, intentionally policy-less operational tables, and disabled leaked-password protection. They predate this increment and were not silently modified. They remain separate security work, not evidence of a new reminder RLS bypass. References: https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Prepared independent release configurations

Both use `src/worker.js`, production Supabase and existing assets/cron/payment settings. Staging entries, fixtures, test credentials and synthetic provider responses remain only in development/test source, outside the built Worker and public assets. The only demo-related text in shared UI code is an inert labeling branch; both production manifests explicitly set PRO_TOOLS_DEMO=false, and production entry has no synthetic send adapter.

| Setting | Stage A | Stage B staged/paused |
|---|---|---|
| Manifest | wrangler.pro-stage-a.jsonc | wrangler.pro-stage-b.jsonc |
| PRO_TRACKER_ENABLED | true | true, preserving Stage A |
| PRO_TOOLS_ENABLED | false | true |
| PRO_TOOLS_DEMO | false | false |
| PRO_AI_ENABLED | false | false until separate activation |
| PRO_AI_SPENDING_AUTHORIZED | false | false until separate authorization |
| RESUME_AI_ENABLED | false | false |
| New AI binding/migration | none | ProAiBudget / pro-ai-v1 |

Stage A can ship without Stage B. Stage B is enabled separately and does not alter tracker entitlement or payments. Its paused preparation configuration cannot charge even if a legacy generic OpenAI key exists. Activating Stage B requires both paid flags true, valid exact model/caps, dedicated API/cache secrets and budget binding. Do not use either staging manifest as a production deployment command.

## Recommended initial production AI budget — proposal only

Use **US$0.50 daily and US$0.50 fixed cumulative for the initial pilot**, with the existing **US$0.10 conservative reservation per uncached request**. This permits at most five uncached calls total across members and days, rather than replenishing the pilot each day. No scheduled cap increase, refund of failed reservations, ledger deletion, namespace replacement, budget reset or paid retry. Keep 10/member/30 days, 3/day and 60-second cooldown; cached identical requests within 24h consume no new paid request. Exhaustion fails closed and needs owner review/explicit authorization for any later increase.

Observed corrected tests averaged US$0.000587375 per call (new total US$0.00117475), but only two short synthetic résumés were evaluated. The US$0.10 reservation is deliberately far above observed cost and retained for bounded worst-case safety. Five requests may therefore spend far less than US$0.50 in actual token charges. This pilot cap limits availability, so do not promise every member's entire monthly allowance while it is exhausted.

The implementation rotates a UTC daily usage counter; it never resets cumulative spending. Equal daily/cumulative pilot caps ensure a new day cannot restart an exhausted pilot. The UTC day boundary is 8 AM Manila. No production allowance is inherited from the US$0.50 staging authorization, whose US$0.40 reservations remain intact. This proposal applies only to new Pro AI, not existing Quick Read processing. No production spending is approved by this report.

## Approval actions and release order

Stage A approval must explicitly cover: (1) merging PR #45 into the verified production-baseline branch, (2) applying the corrected additive migration to production transactionally, (3) deploying the reviewed Worker/assets with Stage A flags, and (4) performing non-destructive production smoke checks. Snapshot version/flags/bindings first; retain subscription/payment records and settings. Validate signup/login, /resources, saved jobs, stage/notes, reminder save/read/export and active/free/expired access immediately afterward. Obtain a fresh GO check if production changed since this audit.

Stage B requires separate approval for: (1) creating the production ProAiBudget namespace/binding and pro-ai-v1 lifecycle migration, (2) provisioning dedicated encrypted production provider and 256-bit cache keys, (3) the stated production pilot budget, and (4) switching PRO_AI_ENABLED and PRO_AI_SPENDING_AUTHORIZED to true. First deploy it paused and verify server-only bindings, cumulative ledger continuity, Pro access, source-grounded validation, deletion purge and unchanged public/auth/payment behavior. Do not make additional paid test calls under the staging authorization. Keep public descriptions accurate: suggestions and source-based drafts, not guaranteed factual verification or unrestricted rewriting.

## Rollback plan

Triggers: signup/auth regression, cross-account access, payment/entitlement issue, new elevated error rate, fabricated result or budget/encryption verification failure. Stop before further rollout on any trigger.

**Stage A:** turn PRO_TRACKER_ENABLED=false; keep both AI paid flags and UI false. Existing saved jobs/stages/notes continue. If code/assets caused the failure, restore the snapshotted pre-release Worker version `ef99f73d-4762-4f18-93a8-dacdb69a06f9` (or the fresh snapshot if changed), then verify flags and signup/public checks. Stage A has no new Durable Object lifecycle change. Preserve the additive reminders table and rows; do not roll back by dropping it. If a database problem is isolated, disable feature access first, review a corrective forward migration, retain protected backup/export and require explicit approval for any destructive removal.

**Stage B:** immediately set PRO_AI_ENABLED=false and PRO_AI_SPENDING_AUTHORIZED=false; hide PRO_TOOLS_ENABLED if needed. Keep the ProAiBudget class, binding, existing namespace, encryption secret and ledger. `wrangler.pro-stage-b-rollback.jsonc` is the safe disabled configuration preserving lifecycle history and the account-deletion purge path. Do not recreate the namespace or zero reservations. Existing in-flight requests may finish; do not retry them. Keep Stage A operational independently.

A simple rollback to a pre-Stage-B version may be blocked by the new Durable Object lifecycle migration. Prefer the prepared disabled configuration/forward repair using compatible class exports; do not assume version rollback rewinds data. Cloudflare states that connected resources are not reverted and lifecycle changes can prohibit rollback: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/ . Retain cache deletion support even while AI is off; do not abandon encrypted cached résumé data by switching to old code without its purge hook. Provider-key revocation can stop compromised access; cache-key rotation needs an explicit cache-retention/purge plan. Neither is an automatic budget reset.

After either rollback: recheck version/flags, signup/login forms and policy, empty signup validation, /resources, Pro access and existing tracker/drafts/exports. Record the cause, affected version, preserved ledger/rows and recovery evidence. No rollback was executed in production during this review.

## Evidence

See the accompanying final HTTP, configuration and artifact-scan JSON, full/auth test logs and desktop/mobile screenshots. Prior paid-output receipts and costs remain in `pro-phase-one-paid-retests.json`; earlier quality limitations are unchanged. This final review supersedes the earlier pending-browser release gates, without granting production authorization.
