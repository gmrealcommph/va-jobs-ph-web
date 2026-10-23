# VeeAys Pro Phase 1 — staging release report

Production remains unchanged. No production database mutation, payment action, customer email or paid AI request was performed.

## Verified baseline

- Repository: https://github.com/gmrealcommph/va-jobs-ph-web
- Production Worker: va-jobs-ph-web, environment production, version ef99f73d-4762-4f18-93a8-dacdb69a06f9 at 100%.
- Deployment: 3b2c715b-0596-4d90-ac3c-329adb6a8f2d, 23 October 2026 4:54:38 PM Manila (08:54:38 UTC).
- Exact source: e3f08a4dc53b477f36bb5c101955c9f9c7779452. This work branches from that live source rather than the older main branch f21a20de699ed7e96629cb828f3c9666029647cb.
- Re-read Cloudflare provenance after implementation: production version/source unchanged; homepage 200; browser analytics remain absent.
- Production Supabase: nwqmhqiymtqkdihjadrp. Read-only schema, constraints, policies, matching RPCs and aggregate payment checks completed.
- Current ledger: two distinct paying members / two confirmed live purchase records, PHP 49,900 centavos each. Three active Pro profiles including existing grants. No recipient or payment identifiers exported.
- Entitlement remains profiles.plan=pro, plan_status=active and future pro_expires_at (or existing indefinite grant). Existing server payment acceptance protects these fields. Single PHP 499, 30-day, one-time product; no new tier or auto-renewal.

## Already implemented before this work

- Resume Studio: free editor, 12 layouts, local drafts, optional recovery, PDF/Word exports and local checks.
- Disabled older AI review endpoint and global ResumeBudget class. It was never activated by this work.
- Saved jobs and My Jobs application stages (Applied, Interview, Offer, Rejected, Hired, Withdrawn) with private notes.
- Five saved Pro searches, ranked matching and filters. Both the production matching RPC and current /matches caller already support up to 100 Pro matches; free remains three.
- Existing opt-in digest/alert systems. Their modes and schedules were not changed.

## Phase 1 implemented

1. Resume review/optimizer integrated into Review & Download. Source-anchored suggested edits with editable wording, explicit Apply, Undo, stale-result protection and existing live PDF preview. No whole-draft overwrite.
2. Editable cover-letter drafting using supplied resume sections and a currently available VeeAys job loaded server-side. Job handoff from My Jobs, manual current-job link input, editable output and .txt download. No employer submission.
3. Existing tracker extended with Pro follow-up dates and next-step labels, retained existing saved jobs/stages/notes, in-app overdue/today indicators and calendar export. No automatic reminder emails. Expired members can still read/export/clear retained reminders; free stages/notes remain free.

## Cost, privacy and security

- Paid processing requires explicit server-side spending authorization, enabled flag, dedicated provider key, reviewed model, encryption key and durable budget binding. Missing settings fail closed. Production has not received these settings.
- One serializing Durable Object reserves a conservative worst-case cost before each single bounded provider request. No automatic retries. Separate daily and cumulative global ceilings, 10 member attempts per 30-day window, three per UTC day, 60-second cooldown and duplicate in-flight protection.
- Per-member, input/job/model-version keyed encrypted result cache: 24-hour TTL, no extra request/quota on a cache hit. Submitted resume text is not stored server-side. The cache stores encrypted generated output; hashed quota records expire after 30 days. Aggregate spending reservations remain.
- Provider payload includes summary, experience, education, skills and projects only. It excludes name/contact/photo fields; members must remove sensitive text from remaining fields. Explicit consent before each sharing workflow. Provider request uses store:false; provider retention policies still apply.
- Strict structured output, exact source-quote checks, numeric-claim checks for rewrites, escaped/text-only rendering, authentication and active-Pro checks, same-origin enforcement and body limits. AI accuracy cannot be guaranteed; suggestions always require member review.
- Account deletion purges individual AI cache/quota records even while AI is disabled; a hashed tombstone prevents late requests restoring deleted content. Aggregate spending records are preserved. The existing password/MFA/deletion/payment rules are unchanged.
- Additive reminder table only; owner RLS and active-Pro write checks, restrictive production suspension guard when present, FK cascade from existing applications. No existing column or record is removed.

## Staging and validation

- Preview: https://veeays-pro-phase1-stage-20261023.gm-realcommph.workers.dev/resume-studio
- Tracker: https://veeays-pro-phase1-stage-20261023.gm-realcommph.workers.dev/my-jobs
- Isolated Worker version: 048a7d90-7f66-4785-b1c4-0dfb36502d2b.
- Separate staging Supabase: megedmsfdwtjxjejrxaq. Additive migration 20261023091543_pro_application_reminders.sql applied here only.
- Three new synthetic staging accounts (active Pro, free, expired Pro), pre-confirmed without sending email; synthetic job/application fixtures. Private test credentials stay outside Git under work/pro-phase1 and are not included in deliverables.
- The staging Worker hardcodes a synthetic provider response in its own entry module, labels responses as demonstrations, has no real provider key and never contacts OpenAI. Payment, webhook, internal automation, account-deletion and new-signup actions are blocked; schedules are empty. Production entry remains src/worker.js.
- Real staging password sign-in: all three account types 303 with sessions. Pro optimizer 200; free/expired 403. Cooldown observed 429. Repeated identical review/letter requests reuse cached results. Cover-letter fixture flow 200.
- Reminder save 303, Pro UI persistence confirmed, free save denied 403, calendar export 200, cross-account export denied 404. Database tests cover owner reassignment, expired writes, suspension and account cascade.
- Browser: source edits, explicit Apply, Undo, editable cover letter, consent guard, selected-job handoff and native reminder save verified. Desktop 970px and mobile 390px checked, no horizontal overflow; action targets >=44px. Existing drafts/exports remain covered by regression tests.
- Final full suite: 541 total, 537 passed, 4 existing skips, zero failures. Required auth suite: 28 passed, zero failures. New targeted Phase 1 / database tests: eight passed.
- Supabase security advisor returned no findings for the new reminder table. Existing staging advisories remain on older objects (including one security-definer view and executable legacy functions); they were not expanded or silently changed. See https://supabase.com/docs/guides/database/database-linter for advisor definitions.

## Deployment readiness and blockers

Tracker/reminders can be reviewed as an incremental release with PRO_TRACKER_ENABLED=true and both Pro AI UI/processing kept disabled. Before any production release: approve deployment, apply the reviewed additive reminder migration to production, snapshot current live bindings/settings and rerun the release/auth/public-route checks. Keep payment/auth/analytics/scheduler settings unchanged.

The AI portion is NOT ready for public activation yet. Needed: explicit spending authorization (global daily/cumulative caps and a conservative per-request bound), dedicated server-only provider and encryption secrets, a ProAiBudget binding/migration, and an authorized small live-provider quality/cost evaluation. Verify current GPT-5-mini pricing against the bounded input/output request before setting the cost bound. Synthetic responses prove integration and access controls, not model quality or actual billing. The old RESUME_AI_ENABLED flag must stay false so requests cannot bypass the new common budget.

Do not deploy src/pro-staging-worker.js or its fixture flags as production. Do not advertise AI availability on /pro before activation and live validation. Existing members automatically qualify through the existing active-Pro profile; no purchase or tier change is needed.

Phase 2/3 remain outside this increment. Existing 100-match support and digest infrastructure should be reused. Interview coaching, skills-gap analysis, portfolios, weekly coaching and new safety insights have not been claimed as delivered.

## Primary implementation files

- src/pro-ai.js, src/pro-ai-budget.js: bounded, entitled AI API and durable cost/quota/cache control.
- src/pro-tools-ui.js, public/pro-tools.js, public/pro-tools.css: integrated review/edit/cover-letter UI.
- src/application-reminders.js, src/render.js, src/worker.js: existing tracker extension and routing.
- src/resume-studio.js, public/resume-studio-input-stable-v6.js: Resume Studio integration and local privacy cleanup.
- src/account-deletion.js, src/legal-pages.js: cache deletion and consent/retention disclosure.
- supabase/migrations/20261023091543_pro_application_reminders.sql: additive reminder schema and RLS.
- src/pro-staging-worker.js, wrangler.pro-phase1-staging.json: isolated demo only.
- test/pro-phase-one.test.js, test/pro-reminders-db.test.js: new security, budget and database tests.

API reference checked: https://developers.openai.com/api/docs/guides/structured-outputs . Supabase ownership policy reference: https://supabase.com/docs/guides/database/postgres/row-level-security .
