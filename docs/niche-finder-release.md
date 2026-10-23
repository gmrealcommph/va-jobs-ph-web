# Niche Finder — staged, not approved for production

Current production baseline: `gmrealcommph/va-jobs-ph-web`, source `6078a91996c66765914b9ccfb253fb5692f90038`.
Verified production version: `9f6399cc-06cc-47fb-b412-38f7abee3b5a`, 100%, deployed October 23, 2026 at 08:36:37 Manila (00:36:37.956115 UTC). Deployment ID `4ad52de3-6174-42d7-b4fe-52c66db052dd`.
The signup hotfix is incorporated: optional browser analytics and its conflicting response wrapper remain disabled. The live Worker annotation names this source commit. Original feature development used f5e49dc; never promote that older base over the signup fix.
This revision adds the auth-safety workflow on every push/PR and an explicit `npm run test:auth` release gate. GitHub branch protection is not configured by this package; the workflow must be made required in repository rules to enforce merges. Maintenance-page changes remain separate and are not included.

## Behavior

- Free, optional `/niche-finder`, available through Career Tools, member menu and My account.
- Signup verification links default to the finder, preserving explicit return destinations. Existing logins keep their previous destination. Verification resends preserve finder return links.
- Twelve plain-language core questions and two followups selected from the highest-scoring interest groups. The shared browser/server model has fixed integer weights and stable ties. “Not sure yet” has zero weight; no fabricated match percentages or qualifications.
- Server validates the adaptive question set and recomputes the top three. Every initial niche can rank first. Results give explanations, answer-based reasons, a practice step, and up to three jobs per niche.
- Jobs come from the existing `public_jobs` view: active, Philippines eligible, deduplicated, using existing freshness/evergreen/verified-open rules. Specialized niches add title filters. Listings can have employer experience requirements; exploration does not assert applicant qualification or that an external vacancy remains open.
- Results save to `auth.users.raw_user_meta_data.niche_finder` via the existing user-scoped Supabase Auth update API. Fields: version, 14 answer IDs, selected IDs, timestamp. Server ignores arbitrary metadata fields. No service key or new database table, migration, AI request, or new paid API.
- Metadata is descriptive only and is never used for authorization, plan access, payments, or eligibility. Account deletion already deletes this auth record. No separate retained result history is created.
- Selecting roles is explicit and separate from saving discovery results. Existing profiles receive a PATCH containing only `target_roles`; new preference rows explicitly disable both email flags. No implicit onboarding completion or paid access. Remaining matching preferences can be edited through My account.
- Writing and data entry map to the existing matcher’s `Other` role; project coordination maps to `Operations`, lead generation to `Sales`. Exact niche job links remain available. This avoids changing production matching rules.
- Retake does not erase saved results until successful completion. Edit preloads saved answers. Skip leaves saved results intact. No answers in URLs, localStorage, analytics, or external AI.

## Staging and tests

Preview: https://veeays-niche-stage-20261023.gm-realcommph.workers.dev/niche-finder

The staging-only entry uses a labelled sample member with browser-cookie saves. No real user credentials or production account writes are forwarded. It reads eligible public jobs. Authentication, payments, non-finder writes, AI and scheduled work are disabled. No production routes or cron triggers are attached. Do not deploy `src/niche-staging-worker.js` to production.

Automated full suite: 521 passed, 4 skipped, 0 failed (525 total). After final refinements, dedicated auth-safety gate passed (27/27), and the expanded Niche Finder suite passed 10/10. Production-config dry-run bundle succeeds. Whitespace checks pass.

Browser checks at desktop 1440×1000 and mobile 390×844: validation, forward/back with preserved choice, 14-question completion, distinct adaptive branches, neutral and creative results, live jobs, choice save/reload, edit, retake, skip with saved results retained, no horizontal overflow, and readable action contrast. Fixed staging `no-referrer` suppressing form Origin; staging and production finder responses use `same-origin` while mutations still require exact Origin.

## Launch gates

1. Real test-account verification email delivery, resend, user-metadata save/reload across devices, and an existing Pro member need authenticated staging verification in an isolated auth environment. Automated tests cover the request contracts; the public preview deliberately cannot exercise real account writes. Check Supabase production redirect allowlist accepts the existing callback with `return=/niche-finder`.
2. Re-fetch production deployment, settings, bindings and schedules immediately before promotion. If production advanced, reconcile again. The repository's default Wrangler config historically differs from active settings; do not blindly run its deploy command. Preserve all production secrets, bindings, schedules, runtime and paid-feature flags when preparing a candidate from the fresh settings.
3. Obtain explicit user approval before any production upload/promotion/deployment. None is granted by this staging package. Preserve the verified version as rollback target and confirm the candidate uses `src/worker.js`, not the preview entry.

No production database changes, price changes, production deployments, paid API calls, account deletions or payment actions were performed.
