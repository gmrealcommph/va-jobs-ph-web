# VeeAys Pro Phase 1 — post-fix paid retest and deployment readiness

23 October 2026, 8:27 PM Manila. Draft PR #45, branch feature/pro-phase-one. Production is unchanged; no merge or production AI activation is authorized.

## Decision

Both authorized live-provider retests passed factual fidelity and end-to-end staging processing. The prior hallucination failures are blocked. Recommend a guarded, incremental release after the production configuration/migration review, final candidate browser checks and explicit production deployment/spending authorization below. This is not an unconditional production sign-off or permission to activate paid AI.

Product limitation: this is source-preserving résumé review and an evidence-based cover-letter draft, not unrestricted AI rewriting. Four of five optimizer suggestions were review prompts without a textual change; one added a bullet to existing skills. The cover letter is factual and usable as an editable starting point, but reads like labeled résumé evidence rather than a highly personalized narrative. Do not promise sophisticated rewriting or independently verified qualifications. No further paid testing or budget is requested.

## Exactly two paid retests

The same synthetic source used in the failed evaluation was sent from the isolated Cloudflare Worker to the live provider. It describes a student-group volunteer, separate school-event project, school completion and a short skills list. No real member résumé or contact information was used. Selected job: Remote Customer Support Assistant, Sample employer — staging only, staging job 1.

| Test | Manila time | Result | Input/output tokens | Latency | Usage-based cost |
|---|---|---|---|---|---|
| Résumé Optimizer | 8:24:58–8:25:07 PM | HTTP 200, completed, uncached | 341 / 372 | 7.576 s | US$0.00082925 |
| Cover Letter Generator | 8:25:08–8:25:13 PM | HTTP 200, completed, uncached | 286 / 137 | 4.000 s | US$0.00034550 |

Model returned: gpt-5-mini-2025-08-07. Cached input tokens: zero. Costs calculated from returned provider usage and current published rates: input US$0.25/M, cached US$0.025/M, output US$2/M, including billed reasoning within output. These are usage-based costs, not independently reconciled invoices. Official model/pricing reference: https://developers.openai.com/api/docs/models/gpt-5-mini . The documented model is marked deprecated; access succeeded, and no substitute model was used. Confirm continued availability before activation.

New test cost: **US$0.00117475**. Earlier two-test cost retained: US$0.00192425. Cumulative usage-based cost: **US$0.00309900**.

Reservations are intentionally more conservative than actual usage: historical US$0.20 + new US$0.20 = **US$0.40 reserved** under the original US$0.50 cumulative cap; US$0.10 remains unreserved. No refund, reset or additional budget. Four total historical plus new provider calls, two in this authorization, no retries. Receipts and original journals retained. Each new case has exactly one completed provider receipt and one US$0.10 reservation increment.

## Factual quality

- Optimizer retained all dates, responsibilities, qualifications and the project wording. It did not add “maintained” to “Created a shared checklist for a school event.” All returned quotes match full source sections. The only textual edit was a bullet prefix on the existing skills line.
- Cover letter selected summary, experience and skills and reproduced each completely in its own labeled block. It omitted the independent project rather than attaching it to the volunteer position. No new employer, qualification, metric, achievement or responsibility appeared. The old “In that volunteer role I also…” association did not recur.
- The provider supplies only section references and allowed operation/topic enums. Server validation rejects extra factual prose; the server renders permitted transformations or source blocks. This prevents the tested output inventions but does not establish the truth of member-entered source material. Two retests are limited evidence, not a broad statistical quality evaluation.

## Safeguards and staging cleanup

A securely generated 256-bit cache key was uploaded only as encrypted PRO_AI_CACHE_KEY to veeays-pro-live-test-20261023. Both it and the previously authorized PRO_AI_KEY are secret_text bindings; metadata exposes no secret values. No production/GitHub/client secret upload. Temporary key-upload file was cleared. No extra test-access secret was needed.

Existing per-member quotas (10/30 days, 3/day), 60-second cooldown, atomic reservations, daily/cumulative limits, AES-GCM result encryption, source validation and no automatic retries remain in force. A persistent staging-only guard allows one attempt per tool and expires the authorization window; repeat claims fail even across deployment/restart. Original member now has three consumed requests, preserving the two earlier uses. A second synthetic QA account temporarily received staging Pro access for its one case; it was restored to free afterward. No quota record was reset or deleted.

After completion both PRO_AI_ENABLED and PRO_AI_SPENDING_AUTHORIZED were set false again. Remote verification at **8:26:54 PM Manila** confirmed US$0.40 reserved, original-member count 3, two persistent one-shot markers, encrypted secret bindings and authenticated paid route returning 503 “Paid AI is paused.” That check made no paid provider request. All further paid tests remain disabled.

Staging enabled test version: 522fce84-24c5-4a3a-ae35-5e8d837318d8. Final paused staging version: **61b1220a-8b0f-44cc-953d-b2e2084b04e2**. Isolated URL: https://veeays-pro-live-test-20261023.gm-realcommph.workers.dev/resume-studio . The staging Worker is restricted to assigned QA accounts and read-only outside its test routes; it is not a public AI demo.

## Regression and production evidence

- Full suite: **553 total, 549 passed, 4 existing skips, zero failures**.
- Authentication suite: **28 passed**, zero failures.
- Persistent one-shot/carry-forward unit tests: 3 passed, including repeated claims and expired authorization rejection.
- Previous staging checks already covered active/free/expired Pro access, tracker reminders, calendar export, cross-account denial, draft Apply/Undo and desktop/mobile layout. This retest verified live provider processing and source fidelity. It did not repeat a browser/mobile interaction pass on the final candidate; that remains a release gate.
- Re-read actual production Cloudflare deployment after the tests: version **ef99f73d-4762-4f18-93a8-dacdb69a06f9**, deployment **3b2c715b-0596-4d90-ac3c-329adb6a8f2d**, 100%, timestamp **23 October 2026 4:54:38 PM Manila**, source **e3f08a4dc53b477f36bb5c101955c9f9c7779452**, repository gmrealcommph/va-jobs-ph-web. Homepage returned 200, optional browser analytics absent. Production Supabase and payment/subscription records were untouched.

## Rollout checklist — requires separate production approval

- [ ] Freeze/review PR #45 candidate and compare production again; retain a rollback copy of current Worker version, bindings and flags. Do not deploy staging entries or fixtures.
- [ ] Repeat browser checks on the final candidate at desktop and 390px mobile: login, Resume Studio drafts/export, consent, selected-job changes, review/no-op prompts, Apply/Undo, editable letter, tracker stages/notes/reminders. Use existing staging accounts; do not make more paid calls.
- [ ] Review/apply only the additive reminder migration to production after approval; verify RLS ownership, expired Pro writes, export, account deletion and rollback handling. No destructive migration, payment or tier changes.
- [ ] Provision a production ProAiBudget binding and independently generated server-only provider/cache secrets only with production authorization. Do not copy staging accounts, keys, one-shot controls or testing allowance into production.
- [ ] Obtain explicit production AI spending authorization specifying daily/cumulative limits and conservative request reservation. Missing/invalid authorization must continue to fail closed; keep legacy RESUME_AI_ENABLED=false.
- [ ] Confirm live model availability and current cost bound. Keep one Pro tier, ₱499/30 days without auto-renewal; existing active Pro members qualify automatically. Keep official branding and existing auth/payment settings.
- [ ] Prefer tracker/reminders first, with AI paused. Enable AI separately only after the preceding gates and approval; use accurate source-preserving feature descriptions.
- [ ] After each approved rollout, check public signup/login forms, Referrer-Policy, /resources, one empty validation POST, Pro/free/expired access and error handling. HTTP checks do not prove email delivery or completed account creation.
- [ ] Watch errors/latency/budget rejections and retain the ability to turn off AI flags immediately without losing drafts, jobs or tracker records. Do not use monitoring to trigger paid retries.

Remaining blockers are production authorization/configuration, reviewed additive reminder migration, final candidate browser checks and agreement to ship the deliberately conservative writing quality. Phase 2/3 are not represented as delivered.
