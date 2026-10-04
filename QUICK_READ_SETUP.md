# VeeAys Quick Read production extension

Implementation extends the saved Job Detail Quick Read V1 source from the preceding task. The current GitHub revision was not supplied, so compare the included existing-file changes against your current checkout before applying. Deliverable is a changed-files patch, not a replacement repository. No deployment or live generation has been performed. No credentials were read or added.

Live acceptance URL confirmed October 3, 2026: https://veeays.com/jobs/37688 — TechnologyAdvice / Client Success Operations Coordinator. The supplied /jobs/39665 is Content Editor, Tech and has different salary/experience; do not generate it as the coordinator acceptance test.

## Behavior and deliberate limits

The Cloudflare Worker calls OpenAI's Responses API over server-side fetch, with strict JSON Schema, `store:false`, a configurable model and no SDK dependency. The model organizes source unit IDs; it cannot write new public facts. The Worker reconstructs exact source text, validates full coverage, rejects unsupported requirement upgrades and misplaced preferences/material conditions, and persists only a fully valid result. This conservative extractive first version permits exact duplicate removal and duplicated intro prefixes; it does not freely paraphrase, infer missing data, omit EOE/SEO text, or build responsibility subgroups. Long prose may remain. Existing V1 renderer and disclosure are reused.

The original is never edited. LLM data and structured enrichment remain separate. Salary in Quick Read must already appear in source; only supplied structured local-currency salary fields feed At a glance. No USD conversion, assumed currency/period, or inference from timezone. Schedule displays the existing `schedule_region`; exact seasonal working hours remain in source-based Quick Read. Missing enrichment is omitted.

SHA-256 binds each output to the exact UTF-8 stored description. Formatter/schema versions are stored. Unchanged ready records skip generation. Changed source can regenerate; a concurrent source change blocks persistence and stale records never render. Corrupt records fall back in full to Original. Database lease prevents duplicate concurrent jobs; global gate allows at most one new claim per ten seconds, failed unchanged sources wait one hour, and provider calls have a 90-second timeout. A process crash leaves a three-minute lease that can be reclaimed. Transient retries are manual, not an unattended loop. There is a small window after a process crash/expired lease where a provider call can repeat; no distributed exactly-once external API guarantee is claimed.

Public reads use a dedicated detail RPC projecting only public enrichment and validated-output cache fields, gated by existing `public_jobs` visibility/dedupe plus active/PH-eligible status. Internal job columns and private cache state are not exposed. No homepage query/view, matching/eligibility/classifier/collectors, saved/tracker model, notification sender, cron, wrangler config, or category UI is changed. All public detail actions keep their existing routes. If SQL is not deployed, the original listing/actions continue to work.

## 1. Code deployment (GitHub / Cloudflare)

Copy the changed files into the existing repo at the included paths. Keep your existing assets, secrets, config, and frozen systems. Review the diff, install your existing package dependencies, run `npm test`, then `npm run build`. Deploy through your existing GitHub-connected Cloudflare build, or your established `npm run deploy` flow. Do not change cron configuration. No mass processing runs on deployment, request rendering, or the existing scheduler. Do not upload just this patch as a complete repository.

## 2. Supabase database setup (separate from code deployment)

In Supabase SQL Editor run the PRE-MIGRATION portion of `scripts/quick-read-verification.sql`. Confirm that `public_jobs` is the intended active/eligible/deduplicated public source and that pgcrypto is in `extensions` (or is not yet installed). Mandatory existing columns: jobs.id, description, status, philippines_eligible. Enrichment columns are accessed through a whitelist using JSON projection, so absent optional fields become null. Confirm the coordinator is ID 37688 in YOUR database.

Run `migrations/004_job_quick_read.sql` ONCE in SQL Editor. It is transactional, creates two private tables and four RPCs, and preserves existing tables/view definitions. Do not rerun it blindly if it has already succeeded. Existing pgcrypto in a different schema requires adapting only the digest qualifications before applying. Then run the AFTER-MIGRATION verification queries. Expected: private cache access and claim execution false for anon, public detail RPC execution true. No DB changes are assumed deployed by this patch.

## 3. Cloudflare runtime setup (separate from Supabase)

Cloudflare Dashboard → Workers & Pages → the existing `va-jobs-ph-web` Worker → Settings → Variables and Secrets → Add. Add secrets using the encrypted Secret type; never put values in client JS, GitHub source, wrangler vars or this guide.

Secret names:

- `OPENAI_API_KEY` — NEW, OpenAI project API key with the chosen model enabled.
- `QUICK_READ_ADMIN_TOKEN` — NEW, random operator token at least 32 characters; store securely for the one-job operator command.
- `SUPABASE_SERVICE_ROLE_KEY` — EXISTING server convention; ensure it is already present for this Worker. Supports `sb_secret_` or legacy service-role JWT. Do not duplicate/replace it if already configured.

Existing `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` remain as configured.

Plain runtime variable names and values:

- `QUICK_READ_MODE` = `manual` to enable the protected generation endpoint. Absent/other value disables generation.
- `QUICK_READ_PROVIDER` = `openai` (only implemented adapter; others fail closed).
- `QUICK_READ_MODEL` = `gpt-5-mini` (supported structured-output model; configurable, not hardcoded). Choose a supported Responses/strict-schema model accessible to the project. A future model/schema change can also use a new formatter version to explicitly invalidate stored outputs; a model variable change alone does not regenerate unchanged ready jobs.
- `QUICK_READ_BATCH_ENABLED` = `false` for the acceptance rollout. The batch endpoint is independently disabled unless exactly `true`.

Save/apply runtime settings using your existing Cloudflare deployment flow. Setting secrets does not apply Supabase SQL. Applying SQL does not deploy Worker code.

Current API references: https://developers.openai.com/api/docs/guides/structured-outputs and https://developers.openai.com/api/docs/models/gpt-5-mini . Model access, cost and real generation latency remain to be verified with your OpenAI project.

## 4. Generate ONE real coordinator job, after all three setup steps

From the repo directory in PowerShell, load the operator token through a hidden prompt (do not paste the token in code/chat):

```powershell
$taskToken = Read-Host 'Quick Read admin token' -AsSecureString
$taskCredential = [System.Management.Automation.PSCredential]::new('quick-read', $taskToken)
$env:QUICK_READ_ADMIN_TOKEN = $taskCredential.GetNetworkCredential().Password
node scripts/generate-quick-read.mjs --site https://veeays.com --job 37688
Remove-Item Env:QUICK_READ_ADMIN_TOKEN
```

This issues exactly `POST https://veeays.com/internal/quick-read/37688` using server-side bearer authorization. Expected `status: ready`; a second request should be `unchanged` without an LLM call. `generation_disabled` means mode not enabled; `provider_not_configured` means key/model/provider missing; `quick_read_service_unavailable` warrants checking migration/server Supabase key. Do not retry rapidly: `rate_limited` waits at least ten seconds, `busy` respects the three-minute lease, and `retry_later` respects the recorded cooldown. Failed outputs remain Original; investigate the private error_code, and retry after its cooldown. Provider quota/model permission issues can also produce failure codes. Do not return API bodies/credentials to the browser.

Open https://veeays.com/jobs/37688 and inspect the persisted Quick Read with the untouched Original disclosure. Confirm entry level/full time/Philippines; `9PM to 6AM PHT (Apr - Oct) or 10PM to 7AM PHT (Nov - Mar)`; Salesforce and Google Sheets or Excel qualifiers; laptop/PC/internet/backup; ongoing PH authorization/no employer visa sponsorship; screening; ₱37,500—₱46,000 from source; every benefit; and the AI-generated/incomplete-answer auto-rejection warning. Confirm duplicated intro is condensed, logo loads or shows initials, and Save/Mark as applied/Apply work for signed-in and anonymous flows. Missing structured salary/schedule remain omitted; do not manufacture them.

Run AFTER-MIGRATION SQL verification to inspect original vs payload and status/hash/model/version. Verify private error details stay private. Approve broader backfill only after the real model result passes this review. Local tests use mocked provider responses and an observed public source fixture; they are not evidence that real OpenAI generation or a production DB migration has run.

## 5. Later: bounded backfill / new jobs

Leave batch disabled now. After approval, set `QUICK_READ_BATCH_ENABLED=true`. Operator-only `POST /internal/quick-read/batch` accepts JSON `{"limit":5,"after_id":"0"}` and the same bearer token. Limit must be 1–5. It processes sequentially and can stop earlier at the global ten-second gate. Read `results` and `next_after_id`; resume from that cursor after at least ten seconds. On a rate-limited/busy row, cursor is not advanced over it. Reset cursor to 0 on a later sweep to revisit failed/changed/lower-ID jobs; no internal loop or deployment backfill exists. Keep requests operator-controlled and review failures before increasing volume.

New eligible active jobs can receive Quick Read through the same single-job endpoint after collection/enrichment is complete, invoked by a trusted server operator/orchestrator using the admin token. No collector or frozen cron is changed. Automatic post-collection invocation is not installed because collectors are outside this snapshot; this is an explicit integration point, not a claim that new jobs automatically generate merely by setting a secret.

Emergency disable: set `QUICK_READ_MODE=disabled`; stored valid results can still render. To hide one result while investigating, in Supabase SQL Editor set that private cache record status to `failed` and payload to null. Jobs/original content are never mutated. To roll back code, restore the previous five edited source/asset files; additive SQL can remain private and unused.

## October 4, 2026: job 37688 application-condition correction

The old application detector and prompt classified the standalone word answers as an application condition. In the checked-in TechnologyAdvice fixture, source ID 28 is "Proactive about spotting issues, finding answers, and escalating problems when needed." Its source section is requirements; assigning it there reproducibly throws application_condition_misplaced in the old validator. The existing acceptance test hid this defect by routing every answers occurrence into application_notes. The actual failed provider selection is not stored: generateJob persists only an allowlisted error code and a null payload on failure. Therefore this is a confirmed reproducible defect, not proof of the exact ID selected during the production attempt.

The detector now requires explicit application/apply, screening/pre-employment, auto-rejection, or AI-generated/incomplete-answer context. The prompt distinguishes ordinary finding answers and the provider input supplies application_note_ids from that same detector. The complete source warning (fixture ID 52) and screening (ID 50) are explicitly routed to Application Notes. Model output still undergoes the same integer-reference, uniqueness, complete-coverage, stored-output, source-hash, preference, requirement-upgrade and material-condition checks. No output is silently repaired or partially published. Schema 2 and source-organizer-v2 remain compatible; no migration or cache reset is required. Source and service failure handling are unchanged.

Regression coverage uses the real fixture, keeps finding answers in Requirements, verifies provider routing cues and exact warning/screening text, exercises mocked persistence for job 37688, and rejects misplaced/omitted warnings. Provider calls and database claims in these tests are mocked; no real generation is performed.

Deployment and manual retest:

1. Review the three changed files: src/quick-read-generation.js, test/quick-read-generation.test.js, QUICK_READ_SETUP.md. Deploy through the existing GitHub/Cloudflare flow after local validation. Keep QUICK_READ_BATCH_ENABLED=false, QUICK_READ_MODE=manual and existing model/secrets. No SQL migration or matching/classifier/notification/config changes are needed.
2. Inspect job 37688 in Supabase SQL Editor before requesting generation:

```sql
select job_id, status, error_code, model, formatter_version, schema_version,
       generated_at, retry_after, updated_at
from public.job_quick_reads
where job_id = '37688';
```

3. Respect the current retry_after; do not clear cooldown or edit the cache to force a retry. The supplied record's retry_after was October 4, 2026 at 11:30:52 UTC (7:30:52 PM Asia/Manila). Recheck the row for a newer cooldown. After deployment and cooldown, the operator may manually run the ONE-job command in section 4 above. This patch does not run it.
4. Expect ready, then inspect /jobs/37688: finding answers remains in Requirements; the full AI-generated/incomplete-answer auto-rejection warning and pre-employment screening appear in Application Notes. Verify seasonal hours, equipment/backup, authorization/no sponsorship, benefits and unchanged Original. Inspect the private row for ready, error_code null, model gpt-5-mini, formatter source-organizer-v2 and schema 2. A subsequent operator request should be unchanged. If it fails again, inspect error_code and retry_after before any further request; no automatic retry or batch rollout.

Local validation for this correction: 30/30 focused Quick Read tests pass; full suite has 98 passed, 5 failed and 4 skipped (107 total). All five failures reproduce on the untouched baseline: four existing worker/frontend assertions and daily-digest.test.js expecting disabled while the current checked-in configuration is enabled. Wrangler deployment dry-run passes. No deployment, production database access, real provider request or retry occurred.
