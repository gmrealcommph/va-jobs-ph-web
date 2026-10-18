# Quick Read content quality — draft review only

For the subsequent captured-output regression fixes and current offline validation, see [live-quality follow-up](quick-read-live-quality-followup.md). The cost and test results below describe the original ceff0fd implementation.

Job 25943 currently has roughly 1,130 words of source-like bullets, repeated duties, `8+ years years`, concatenated fields, and a false contractor conflict. The proposed acceptance sample is 174 words in four prose sections. The generator now asks for an explanation of the actual job, normally 150–220 words, with a 250-word ceiling and shorter output allowed for sparse sources.

- [Captured before Quick Read](quick-read-samples/25943-before.html)
- [Proposed after Quick Read](quick-read-samples/25943-after.md)
- Source fixture: `test/fixtures/executive-assistant-25943.txt`
- Run `node scripts/preview-quick-read-quality.mjs` for the offline sample and cost calculation.

The before capture and description were extracted from the saved public page used by the preceding sidebar/redesign review on 18 October 2026. They were not freshly fetched from production in this change. The after sample is hand-authored test data returned by a mocked provider, not a measured live model output. No real summary was generated or replaced.

## Implementation and boundaries

`generateWithProvider` now sends a prose-generation prompt and strict four-section schema. Each paragraph includes private source-unit references. Validation checks schema, bounds, repetition, long verbatim passages, raw fields, malformed repeated “years”, reference validity, numeric support, coverage of material source units, selected consequential terms/negations, explicit pay inconsistencies, employee/contractor inconsistencies, and preferred versus required wording cues. Invalid prose fails closed with the sanitized `summary_quality_rejected` code, without prose diagnostics or an extra provider call.

These deterministic checks are conservative heuristics, not a semantic proof of every paraphrase. An ID citation by itself cannot establish that every sentence is faithful. Review the sample wording against the employer source; actual model quality, completion rate and coverage across larger cohorts remain unmeasured. There is no paid evaluator, repair loop or automatic retry added by this change.

The four paragraphs render only after full stored-payload validation. They use the existing Quick Read container/styles, escaped text and original-description disclosure. The hero, At a Glance, application sidebar, original description, access gates and all other page layout remain unchanged. Existing legacy presentation now recognizes contract/contractor/independent contractor as equivalent exact employment labels; employee disagreements remain visible. Full-time hours and contractor engagement can coexist.

## Persistence and cache inspection

Existing generation uses description fingerprints, serialized claims, leases, finish-time source checks, ready-cache skips and a second validation at read time. These remain intact. The prose is an additive `summary` object with its own `version: 1` inside the existing v2 archive envelope. The source archive still covers all normalized source units exactly once; it is not displayed as the new summary. Legacy source-only payloads remain valid. Formatter, schema and source-rules identities are deliberately unchanged, so ready rows are not invalidated or selected for regeneration.

The checked-in SQL finish/projection functions accept this extension; an embedded Postgres test exercises storing and projecting the actual benchmark payload, ready-row `unchanged`, and source-change invalidation. No SQL migration is included or applied. An older Worker rejects extended rows and falls back to the original description; it does not display the new prose.

The live auto-claim/finish and spending-control RPC implementations are not fully represented in the repository. This change preserves their call signatures and every scheduler/stop condition; it does not claim fresh verification of live database settings or deployed-source parity.

## Cost and safeguards

Zero paid API calls; actual generation spend for this work: **USD 0**. All provider responses in tests and the preview are mocked; no credentials are read by the preview.

The model allowlist remains `gpt-5-mini`; the existing 100,000 input-token conservative byte bound, request timeout, credit-error handling, protected manual endpoint, bounded batch size, database claim/gate behavior and scheduler stop statuses remain in place. New prose generation makes one request with `store: false`, disabled truncation and a **4,096-token output cap**, down from the legacy organizer's 16,000. This cap includes model reasoning, so live generation can still fail incomplete rather than produce a usable summary. It is not a 4,096-token prose allowance.

Using [official GPT-5-mini pricing](https://developers.openai.com/api/docs/models/gpt-5-mini), USD 0.25/M input and USD 2/M output, verified 18 October 2026:

| Benchmark / limit | Tokens or bytes | USD per request |
| --- | ---: | ---: |
| Benchmark serialized request | 20,693 bytes | — |
| Rough benchmark input estimate (4 bytes/token) | 5,174 tokens | 0.00129 input |
| Rough visible sample JSON output (4 bytes/token) | 394 tokens | 0.00079 output |
| Benchmark conservative input bound, including envelope allowance | 24,789 tokens | — |
| Benchmark input bound + full output cap | 24,789 + 4,096 | **0.01439 maximum** |
| Global existing input bound + new output cap | 100,000 + 4,096 | **0.033192 maximum** |
| Previous input bound + legacy output cap | 100,000 + 16,000 | 0.057 maximum |

The roughly USD 0.00208 visible-token scenario excludes reasoning and is not an actual usage measurement. Conservative maxima include the full output cap; account discounts/taxes and future price changes are excluded. Database spending reservations are unchanged, rather than reduced to these estimates.

## Validation and review scope

Offline regressions cover the captured 25943 listing, a sparse design-support role, a night-shift campaign coordinator, genuine conflicting pay, genuine employee/contractor disagreement and equivalent contractor labels. Adversarial checks include missing source IDs, invented salary/benefits/remote terms, repeated content, copied passages, malformed grammar, omitted experience thresholds/equipment, reversed sponsorship restrictions and provider failures. Legacy organizer tests explicitly target the retained organizer; they do not purport to test prose quality.

Build: `npm run build` is a Wrangler **dry run**, not deployment. Focused test results and the inherited logo assertion are reported in the PR. The base is `codex/recovered-production-auth-081b6577` at `626011e`, containing the merged sidebar PR #11. PR #12 remains separate and untouched. No broad branch reconciliation, cache rewrite, production generation, scheduler/configuration change, merge or deployment is included. Review the sample and draft PR before authorizing any later generation experiment or release.
