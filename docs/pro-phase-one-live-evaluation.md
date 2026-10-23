# Phase 1 live-provider evaluation — 23 October 2026

## Recommendation

Do not activate the AI Résumé Optimizer or Cover Letter Generator in production yet. Both API flows completed, but both produced unsupported factual expansions from synthetic source material. The existing tracker/reminders can still be reviewed as a separate non-AI release. Draft PR #45 remains unmerged; no production deployment or production AI activation occurred.

## Authorization and execution scope

The owner explicitly authorized up to US$0.50 total additional provider spending, staging only, with no automatic paid retries. A dedicated test configuration used US$0.10 worst-case reservations, US$0.50 cumulative/daily ceilings, ten requests per 30 days per member, three per UTC day, and a 60-second cooldown. The actual tests used one existing synthetic staging Pro member and the separate staging Supabase project megedmsfdwtjxjejrxaq, including real password sign-in, protected profile entitlement and the synthetic currently eligible job record.

The automatic approval reviewer rejected uploading a provider API credential to Cloudflare staging because explicit authorization for sending that secret to Cloudflare was absent. No provider key was uploaded. A safer local staging run invoked the same proAiEndpoint and ProAiBudget source, using real staging authentication/profile/job records and the existing dedicated VeeAys testing credential directly with OpenAI. The credential stayed on this machine and was never exposed to a browser or included in Git/deliverables. The budget adapter persisted atomic transactions to a task-local journal with an exclusive run lock. This verifies the server/provider integration locally; it does NOT prove the full remote Cloudflare-to-provider integration.

## Actual metered usage and cost

| Case | HTTP / application | Input tokens | Output tokens (includes reasoning) | Provider latency | Usage-based USD cost |
| --- | --- | ---: | ---: | ---: | ---: |
| Résumé optimizer | 200 / 200 | 309 | 528 | 6,654 ms | 0.00113325 |
| Cover letter | 200 / 200 | 268 | 362 | 4,856 ms | 0.00079100 |
| Total | Two completed calls | 577 | 890 | | **0.00192425** |

Both responses identified gpt-5-mini-2025-08-07 and status completed. Input cache hits were zero. Cost is calculated from actual provider-reported token usage at the checked standard GPT-5-mini rates: US$0.25 per million input tokens, US$0.025 cached input tokens, US$2.00 per million output tokens. Reasoning tokens are included in output token totals, not charged again. This is a usage-based cost calculation, not an independently reconciled provider invoice; no account-wide billing/admin key was used.

Pricing source checked before processing: https://developers.openai.com/api/docs/models/gpt-5-mini . The current page also labels this older model deprecated, although its model-access endpoint and both generation requests succeeded. Review the supported model lifecycle before any production launch; no model was silently substituted during this evaluation.

The conservative reserved total is US$0.20, below the US$0.50 authorization. The remaining reservation capacity is US$0.30; unused authorization will not be spent automatically. There were exactly two paid provider requests and zero retries. The planned cases were separated by more than 60 seconds. A completed marker now prevents further executions of this paid test runner.

## Résumé optimizer output quality

The model returned five source-anchored suggestions. Useful edits removed first-person wording, made education formatting concise and improved clarity without introducing numbers. Exact supporting quotes and numeric checks passed.

However, the project source was: Created a shared checklist for a school event.

The model suggested: Created and maintained a shared checklist for a school event.

The source does not establish ongoing maintenance. The response even claimed the addition preserved the original fact. The current quote/numeric validation cannot detect this semantic expansion. This is a production-quality blocker. Another suggestion arbitrarily preferred US spelling while leaving UK spelling elsewhere; this is a lower-priority consistency issue.

## Cover-letter output quality

The letter correctly named the selected role and company, used the volunteer/high-school background and did not fabricate a degree, paid employer, contact details or numerical accomplishment. It was editable, readable and concise.

But it said the school-event checklist was created in that volunteer role even though the project and volunteer experience were listed independently. It also introduced assisted with maintaining clear, concise updates where the source only said the applicant wrote short updates. These unsupported associations/ongoing duties make the letter unsafe to present as faithfully grounded. This is a production-quality blocker even though the API and schema validation succeeded.

The full synthetic outputs and token usage are in pro-phase-one-live-test-results.json. No real member résumé or personally identifying information was sent to the provider.

## Safeguards and tests

- Persisted global reservations were 100,000 micro-USD after the first case and 200,000 after the second. Reservations were not refunded or replaced with the much smaller metered costs.
- The same endpoint enforced actual staging identity and active-Pro lookup, same-origin/content/body constraints, consent, public-job lookup and one bounded provider request. The provider received store:false, no tools, and max_output_tokens:1800. The test wrapper checked the serialized request body was under 64 KB.
- Per-user quota/cooldown/cache behavior remains in the shared budget path. Regression tests verify five US$0.10 reservations exhaust a US$0.50 cap across users and a sixth is refused without a provider request. Quotas, concurrency, expiry, encrypted caching and deletion protections remain covered.
- Added usage receipts record actual input/output/cache counts, model, status and response/request references without résumé content, account IDs or keys. Receipts do not reduce reservations and are idempotent per reservation.
- Final full suite: 543 tests total; **539 passed, four existing skipped, zero failed**. Required auth suite: **28 passed**. Paid-test budget suite: nine passed. Unit tests passing do not negate the observed semantic quality failures.
- The separate Cloudflare test Worker is now explicitly paused: PRO_AI_ENABLED=false, PRO_AI_SPENDING_AUTHORIZED=false, no PRO_AI_KEY binding. Unauthorized paid-route probes return 403. Paused version 7911ca76-52aa-4a2e-8933-6324743e9e58; checked 23 October 2026 6:02:51 PM Manila.
- Production was re-read after testing and remains version ef99f73d-4762-4f18-93a8-dacdb69a06f9, deployment 3b2c715b-0596-4d90-ac3c-329adb6a8f2d, source e3f08a4dc53b477f36bb5c101955c9f9c7779452. Homepage 200, optional analytics absent. No production configuration, schema, payment, entitlement or account changes.

## Remaining blockers and next steps

1. Strengthen factual grounding before another release candidate: preserve the scope of each source statement, forbid new duties and cross-section associations, and require evidence for each factual claim. Add the observed examples as semantic regression/evaluation cases. Numeric and quote checks alone are insufficient. Consider constrained evidence-based sentence assembly for cover letters rather than unconstrained paraphrases.
2. Re-evaluate the fixes on distinct synthetic cases. Do not automatically repeat these paid requests. Preserve the existing US$0.20 reservations and coordinate any future remote budget so local plus remote cumulative reserved exposure cannot exceed the US$0.50 authorization.
3. Full remote Cloudflare-to-provider validation remains unperformed. Before uploading the dedicated VeeAys testing credential as a secret to that isolated Worker, obtain explicit approval for that secret transmission. Keep an allowlisted test account and test-access secret. This approval is separate from production activation.
4. Review the deprecated model's lifecycle and re-verify pricing/cost bounds for the selected supported model before production. Any new model needs quality checks and spending authorization within a defined cap.
5. Production rollout still needs the reviewed additive reminder migration, approved server-only key/cache/budget bindings and normal signup/login/public-route validation. This US$0.50 test allowance is not ongoing production AI spending authorization.

No PR merge, production deployment or production AI activation is recommended or performed by this report.
