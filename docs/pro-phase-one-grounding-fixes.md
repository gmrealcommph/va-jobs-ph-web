# Phase 1 factual-grounding fixes — 23 October 2026

## Readiness

Ready for a separately approved, limited live-provider staging retest. Not approved or recommended for production activation yet. No new paid generation was performed during this work. PR #45 stays unmerged; production stays unchanged.

## Factual accuracy contract

The previous source-quote and numeric checks allowed the model to add unsupported words. A stronger prompt alone cannot enforce factual fidelity, so the generation contract has changed.

- The optimizer model returns only validated source-section IDs, an editing-operation enum and a review-topic enum. It cannot supply rewritten facts, free-text advice, employers, dates, qualifications or achievements.
- Server code performs bounded edits: clean whitespace, add bullet presentation without changing order, or remove a leading first-person subject before an action verb already present in the source. Every other word, negation, date, employer/position boundary and qualification stays in place. Original and proposed wording remain reviewable with Apply and Undo. No-op edits appear as review prompts instead of fake changes.
- The cover-letter model selects one to three complete, nonempty source sections. Server code composes a neutral introduction/closing and reproduces each section verbatim in its own labeled block. Experience, projects, skills and education are never merged or linked to a position by generated prose. Users can inspect source sections and edit their final draft themselves.
- Invalid/duplicate/empty references, unsupported operations and any extra model-authored claims fail closed before output or caching. The original draft stays intact; no automatic paid retry follows validation failure.
- Cache version increased to 2, isolating all older unconstrained outputs. The cache stores the validated selection plan; current request source is revalidated when rendering a cached plan.
- Results are discarded if the résumé or selected job changes during a request.

This deliberately trades unrestricted creative paraphrasing for enforceable source fidelity. AI can prioritize source material and recommend safe presentation changes; it cannot independently verify whether the member's original statements are true. More fluent free-form rewriting is not claimed as solved or enabled.

## Failed-case regressions

1. Original project: Created a shared checklist for a school event. The old Created and maintained rewrite is rejected. Source-preserving output cannot introduce maintained.
2. The old cover-letter association In that volunteer role I also created ... is rejected. Experience and the school project are reproduced independently with explicit source labels.

Additional regressions cover multiple employers/positions, dates, negation, incomplete qualifications, missing skills, forged references, duplicate IDs, job requirements becoming applicant claims, fabricated metrics/employers and extra free-text fields. End-to-end endpoint tests verify rejection of bad provider output after one reserved attempt, with no retry, no cache write and no exposure of the fabricated claim.

## Secret storage and paused testing

The owner explicitly authorized the dedicated VeeAys staging test API key. It was uploaded only as PRO_AI_KEY, a Cloudflare secret_text binding, to veeays-pro-live-test-20261023. It was not uploaded to production, GitHub, logs or client code and was not exposed in responses. Metadata and response checks confirmed this without printing the secret.

Automatic approval review rejected an initial broader bundle containing cache/test-access secrets. The upload was narrowed to the approved API key only and succeeded. No extra secrets were uploaded. The staging QA endpoints now reuse the existing allowlisted staging test member and same-origin controls, so they require no additional test-access secret. A cache-encryption secret is still absent and remains an additional fail-closed gate before any future paid test; its provisioning needs explicit approval.

PRO_AI_ENABLED=false and PRO_AI_SPENDING_AUTHORIZED=false remain set remotely. The authenticated paid endpoint returned 503 with Paid AI is paused. No provider call was made for this check. Paused QA Worker version: cc433430-7fb0-4052-947d-b10b4a91bb0d. Verification completed 23 October 2026 8:11:45 PM Manila (12:11:45 UTC).

## Spending and quota preservation

The earlier usage-based cost remains US$0.00192425 for exactly two provider requests. It has not been reset or reclassified. The earlier local usage receipts/journal are retained.

The conservative reservation total US$0.20 and member quota count of two, including original window/cooldown timestamps, were carried into the same isolated remote test budget once. The operation rejects reduced values, refuses to overwrite existing unimported spending, only runs while paid processing is disabled, and is idempotent: repeat import cannot reset or double-count subsequent usage. Regression tests cover these properties. Actual remote verification confirmed total=200,000 micro-USD and member count=2 after repeat import. The US$0.50 authorization is unchanged, leaving US$0.30 unreserved capacity. No new budget has been created.

Further paid testing remains disabled and must be approved after this report. A reasonable next step is two one-shot tests across separate staging test accounts, reserving at most US$0.20 from that existing US$0.30 capacity, with no retries. Existing per-member daily limits must not be bypassed or reset. This does not authorize production spending.

## Validation

- Focused grounding/API/carry-forward tests: 18 passed.
- Full regression suite: 552 total, 548 passed, four existing skips, zero failures.
- Required auth suite: 28 passed, zero failures.
- Last small UI change additionally passed syntax and focused checks: discard a response when the selected job changes while it runs.
- Real staging checks: encrypted approved-key binding, both paid flags off, owner-authenticated/idempotent quota carry-forward, rejection of reduced balances, and paused paid route returning 503.
- No Supabase schema or production record changes were needed for the grounding fix.
- Re-read production: version ef99f73d-4762-4f18-93a8-dacdb69a06f9, source e3f08a4dc53b477f36bb5c101955c9f9c7779452, deployment 3b2c715b-0596-4d90-ac3c-329adb6a8f2d. Homepage 200; optional analytics absent. No production deployment or AI activation occurred.

## Remaining launch gates

Approval is required before paid tests resume, including provision of a separate encrypted cache key. Then verify the live model returns usable source-selection plans under the new schema, inspect source fidelity/readability and record metered usage within the original authorization. Review model lifecycle before production. Production still needs its own deployment and ongoing spending approvals; this test authorization grants neither.

Main files: src/pro-grounding.js; src/pro-ai.js; public/pro-tools.js; src/pro-staging-worker.js; src/pro-live-test-worker.js; test/pro-grounding.test.js; test/pro-phase-one.test.js; test/pro-test-carry-forward.test.js.
