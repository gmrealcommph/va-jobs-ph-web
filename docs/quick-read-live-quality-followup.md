# Quick Read quality follow-up to ceff0fd

This change addresses only concision, source-metadata leakage and equivalent punctuation/wording validation. It uses the four saved real GPT-5-mini outputs from the preceding isolated quality test, without new provider requests or repository reinvestigation.

## Changes

- Prompt targets 150–220 total words, gives individual paragraph budgets and requires shortening before returning. Four sections and a hard 250-word validator ceiling remain mandatory. Oversized output is rejected, never truncated or automatically repaired.
- Heading and aggregator metadata units are excluded from the model's summary input and cannot be cited. Original IDs are preserved. Employment and compensation facts remain eligible evidence. The complete source archive, source identity and original-description disclosure remain intact.
- Prose validation rejects the captured metadata paraphrases, source provenance, raw labels and internal fields. The previously accepted bookkeeper output now fails because it leaks timezone/category metadata; an offline edited version with those passages and references removed passes.
- Comparison-only normalization accepts Unicode hyphens, full time/full-time, comma-separated amounts and equivalent clock notation such as 9PM/9:00 PM. Minutes and AM/PM remain part of the complete clock value. Missing plus qualifiers, changed amounts, changed shifts and missing conditions still fail.
- Equivalent negative sponsorship wording and remote/work-from-home wording are recognized. Remote application-process text cannot establish a remote job. Unknown-pay wording cannot suppress an unrelated invented-benefit check.

No scheduler, database, cache identity, deployment, UI or output-token-limit changes. No existing summaries were regenerated or rewritten.

## Regression evidence and validation

`test/fixtures/live-quality-ceff0fd.json` contains the original summary objects for jobs 25943, 41638, 41645 and 37688, copied from the preceding local usage ledger. They are captured model outputs, not newly generated or hand-edited acceptance fixtures. All four are now rejected: three retain real defects, while the former bookkeeper pass is closed by metadata checks. Their rejection does not demonstrate that the revised prompt produces good live summaries.

The separate pre-existing hand-authored 25943 acceptance fixture retains identical prose and gains one employment-fact citation now that employment fields participate in material coverage.

- Summary/offline live-output regression tests: **17/17 passed** (8 new cases).
- Wider final generation, summary, provider-diagnostics and embedded-database checks: **49/50 passed**. The only failure is the inherited `logo load/error/decode failure keeps accessible decorative fallback and never reveals broken image` assertion already documented at ceff0fd; no logo changes included. The broader Quick Read/admin run also encountered only that same known failure.
- Dry-run build: passed, **455.44 KiB / 125.55 KiB gzip**. Logs redirected into the writable test workspace to avoid the earlier default-log-folder permission warning.
- Whitespace check: passed.
- New paid calls: **0**; additional API spend: **USD 0**.

## Remaining uncertainty and recommendation

Another small, separately authorized isolated live test is justified before release: offline assertions can verify rejection and equivalence, but cannot measure revised-prompt compliance or human tone. The original three rejected outputs remain oversized (25943: 441, 41645: 350, 37688: 314 words under the original validator), and the revised prompt has not generated a live replacement.

Validation remains heuristic rather than full semantic entailment. In particular, nuanced agency restrictions and continuing work-authorization wording identified in the original report are not solved by punctuation normalization. Metadata detection is conservative and cannot guarantee detection of every paraphrase. These limits support keeping PR #13 draft and deferring production regeneration/release until a small live test and source-by-source editorial review pass. No additional API calls are authorized by this offline follow-up.
