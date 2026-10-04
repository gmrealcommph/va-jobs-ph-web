# Quick Read presentation cleanup

Base: va-jobs-ph-web commit 94a1687f2e5682194a7b91e8f04669a356ef1e72, clean local checkout. Prepared in an isolated workspace; the original checkout was not modified.

Changed paths:
- src/job-detail-read.js
- src/quick-read-presentation.js (new)
- src/render.js
- test/quick-read-generation.test.js
- test/quick-read-presentation.test.js (new)
- QUICK_READ_PRESENTATION.md (new)

## Behavior

A display-only projection runs after complete stored-payload validation. It removes exact standalone source headings; the Himalayas provenance marker; categories/job functions only in the identified Himalayas tail; and numeric-only timezone restrictions. Whole Location/Employment Type/Employment Level/Seniority lines disappear only when their complete normalized value matches a populated At-a-glance field. Missing values and contradictions remain visible. Unknown source taxonomy and substantive label-prefixed prose remain visible.

Known structured values become Full-time, Part-time, Entry Level and Philippines. The specific schedule code philippines becomes Philippines hours, without assigning exact hours. Source seasonal hours remain verbatim in Important requirements.

Explicit monetary source lines in Other source details/About the role move intact to a prominent Salary section. An immediately preceding Monthly Pay Range heading provides the explicit monthly context. No amounts, currencies or periods are inferred; monetary benefits retain their benefit section and qualifiers. Compensation qualifiers remain visible in Other source details. Structured salary formatting is unchanged.

The source-organizer-v2 payload/schema, all validators, source units, source hash binding, storage/service, fail-closed fallback, original disclosure and untouched original description are unchanged. No matching/classifier/collector/notification/config/migration/generation change. Existing valid persisted output renders cleanly without a provider call.

## Verification

Final focused Quick Read tests: 36 passed, 0 failed.
Final full suite: 104 passed, 5 failed, 4 skipped (113 total).
Untouched baseline with dependencies: 98 passed, 5 failed, 4 skipped (107 total).
The same five failures occur in both runs:
- default disabled, wrong cron, and before activation never access network (daily-digest.test.js; current config enables digest)
- search is quoted and pagination/filtering happen in Supabase
- job detail escapes content and rejects script application URLs
- search results are noindex; page two has its own canonical
- numeric job detail keeps the original application link and canonical
The last four are existing worker/frontend assertions. No new failure was introduced. Full-suite approval still requires acknowledging or separately resolving these baseline failures.

Build: package build's exact Wrangler 4.144.0 deploy --dry-run --outdir dist passes. The sandbox initially blocked parent-directory reads; the authorized local dry-run succeeded. Local Node v24.19.0 and existing pinned dependencies were used. Provider/database tests are mocked or local; no production API/DB access, deployment, retry or backfill occurred.

Real source fixture: test/fixtures/technologyadvice-37688.txt, unchanged. Tests cover every benefits/requirements/application line, exact seasonal hours, original roundtrip, payload immutability, missing/conflicting metadata, all-or-nothing rejection including omitted heading units, meaningful timezone restrictions, source taxonomy, currency/period limits, and detail-renderer integration.

Project Manager and Outbound Sales/Customer Service full source fixtures are absent. Accounts Officer has only a short existing unit-test example; it is exercised for payroll/AP/AR/reconciliation, MYOB preferences and source taxonomy preservation, not presented as a real full listing. No representative source descriptions were invented. Obtain actual source fixtures before accepting those three full listings.

## Apply and deploy (operator steps; not performed)

1. From the intended repo checkout, review current changes and compare with the base commit. Apply either the unified patch or the changed-files folder, not both. For the patch, run git apply --check quick-read-presentation.patch, then git apply quick-read-presentation.patch. The archive is a patch, not a repository replacement.
2. Use the pinned dependencies. Run node --test test/quick-read*.test.js, npm test and npm run build. Compare full-suite failures against the baseline list above. Review only the six listed paths.
3. Confirm the existing Worker runtime variable QUICK_READ_BATCH_ENABLED=false and keep it false throughout this retest. Config is deliberately not edited; no production settings were inspected. Keep the existing generation mode/model/secrets and cron settings.
4. Deploy through the existing GitHub/Cloudflare flow only after operator review. No SQL migration, payload rewrite, formatter bump, cache reset or regeneration is needed. Deployment does not authorize a retry or backfill.

## Controlled retest

1. Open https://veeays.com/jobs/37688 using its already-ready stored payload. Refresh after deployment. Do not call the generation endpoint.
2. Confirm no heading-only bullets, Himalayas SEO tail or numeric timezone restriction appears inside Quick Read. They must still be accessible in Original description. Matching location/employment/experience metadata should appear once in At a glance; conflicting or absent structured values remain in source details.
3. Confirm Full-time and Philippines hours when those structured codes are present. Confirm the exact source seasonal hours remain under Important requirements: 9PM to 6AM PHT (Apr - Oct) or 10PM to 7AM PHT (Nov - Mar).
4. Confirm Salary prominently displays Monthly Pay Range: ₱37,500—₱46,000 PHP; any existing compensation line remains source wording. No inferred currency/period or converted salary is added.
5. Check all benefits; laptop/PC, internet and backup; current and continuing PH authorization/no employer sponsorship; Salesforce and Google Sheets/Excel qualifications; screening; and the entire Any AI-generated or incomplete application answers will be auto-rejected. warning under Application notes.
6. Expand Original description and verify the complete original. Check Save/Mark applied/Apply and anonymous sign-in flows. A corrupt/stale payload must still show the original-only fallback. Leave QUICK_READ_BATCH_ENABLED=false. Do not perform a production retry or any backfill as part of this cleanup.

Rollback: restore the prior versions of src/job-detail-read.js and src/render.js and remove the unused new presentation helper. No database rollback or stored-result regeneration is required.
