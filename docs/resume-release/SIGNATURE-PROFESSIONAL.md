# VeeAys résumé templates — Signature Professional revision

Review candidate, 25 October 2026. Fictional sample information only. No production deployment, PR merge, database changes or paid AI calls.

## Design revision

Signature Collection now follows the replacement Signature Professional reference: a formal navy masthead, restrained gold finishing rules, readable serif name and role titles, employer/date alignment, and a traditional chronological section order. Body text remains 11 pt on A4. Optional portraits remain optional. Short documents retain natural whitespace; content is never stretched to fill pages.

The other eleven designs, their composed page plans and their PDF/Word sample files match the preserved v4 candidate exactly. References 1–3 remain the benchmarks for those designs. The original v4 review package and staging Worker are retained.

## Validation performed for this revision

- 24 focused automated tests passed. Includes 96 export cases: 12 templates × 8 profiles, A4 bounds, all source facts, editable Word generation, draft recovery, release isolation, route parity and release safeguards.
- All 12 main PDF and native Microsoft Word samples checked: 23 pages per format. No missing source text, out-of-page text or page-count mismatch.
- Signature main realistic sample: 2 pages. Additional short sample: 1 page; long stress sample: 6 pages; optional-photo sample: 1 page. Every new PDF and Word page was rendered and visually reviewed. Additional cases bring the package to 31 pages per format across 15 sample pairs.
- Main Signature PDF and Word downloaded through the staging editor. PDF text/page content matches the canonical sample; all native Word package parts match the canonical Word sample.
- Mobile editor checked at 390 px and 320 px: no horizontal document overflow, both preview pages retained, and fictional draft values preserved through Edit/Preview and Review & Download.
- The original production version remains `713c64bc-c3a6-41d5-91fc-b3f111d36268`. The new staging Worker has zero bindings. It uses fake Pro responses and cannot invoke the paid AI provider.

## Review links

- Gallery: https://veeays-signature-preview-20261025.gm-realcommph.workers.dev/template-review/#signature
- Editor: https://veeays-signature-preview-20261025.gm-realcommph.workers.dev/resume-studio
- Draft PR: https://github.com/gmrealcommph/va-jobs-ph-web/pull/46

## Known limitations

- Word is editable native text. Font substitution and later edits can change line wrapping; the supplied samples match PDF page counts, but are not pixel-identical.
- The existing built-in PDF font supports Latin-script text. Other scripts retain the existing Print / Save as PDF fallback. This revision does not expand font coverage or claim certification by any ATS vendor.
- Existing full-repository comparison previously found the same 36 failures on the GitHub baseline and release candidate (Quick Reads/provider fixtures and activity timing). This revision reran the 24 focused tests, not the entire unrelated suite. Existing full-suite evidence remains in the PR documentation.
- Signed-in production workflows were not exercised. No live member records, authentication, subscription, payment or database integration was changed.
- The six-page sample intentionally repeats content to stress pagination. It is a test fixture, not a writing recommendation.

## Contents and status

All 12 templates: Completed for review. Signature Collection has the new Signature Professional treatment. The ZIP includes 12 principal PDF/Word pairs, three additional Signature validation pairs, all full-page PDF and Word previews, the gallery, screenshots and current revision evidence.

Production release remains gated. PR #46 is unmerged; approval is required before a production release. The source reconciliation and rollback plan in `docs/resume-release/RECONCILIATION.md` and `RELEASE.md` continue to apply.
