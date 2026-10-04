# 43635 — material-condition routing investigation

The genuine current source demonstrates both correct material-condition rejection and a conservative keyword false-positive path. **B, section selection, is the best-supported operational explanation; the actual production cause remains undetermined.** A source-heading fix does not explain or repair this error: material routing overrides section hints. C is plausible if the model placed the laptop/internet requirement under Requirements. A lexical (not heading) false positive is also plausible if it placed the scheduling duty under Responsibilities. Neither candidate is claimed as the recovered production selection.

## Baseline and evidence

Original checkout is clean at `dba5920` (41645 Quick Read Investigation — Heading Context Fix), including 41638, 43639 presentation cleanup and 41645. Work was performed in `work/43635/repo`, an isolated copy without secrets or Git metadata. No original files were edited. The user's latest deployed-checkout designation was used; no remote deployment identity was independently inspected.

No genuine 43635 fixture was present in the checkout. A read-only GET of [43635's public listing](https://veeays.com/jobs/43635) supplied its Original description on October 5, 2026, Asia/Manila. The saved fixture is HTML-decoded Original description content, retaining whitespace and the concatenated opening passage. Its UTF-8 SHA-256 is `2430d7fe36be3d353521a3ddfc13d48fcdb924da8cecb11930815066b5bd73fc`. Raw page and extracted source units are included as evidence.

This is current public source, not independently verified historical database bytes. The private source hash and failure row were not queried. The exact failed provider selection is unavailable: requests use `store:false`, and the service stores a known error code with null payload after validation fails. All reproduced selections/provider responses are local mocks, not a recovered production response. No real provider generation occurred.

No deployment, production retry, runtime change, cache deletion, timestamp/hash editing, SQL migration, version bump or job 41641 action occurred. `QUICK_READ_BATCH_ENABLED=false` remains required; no runtime settings were inspected or changed.

## Exact detector matches and permitted sections

`sourceUnits` emits 36 whole source units. The material detector is the existing case-insensitive word-boundary regex covering authorization, sponsorship, visa/permit, laptop/PC/computer/equipment, internet/backup, shift/schedule/PHT/timezone prefixes. There are exactly five matches in this fixture, with no preference exemption:

| ID | Genuine source statement / matched text | Meaning | Allowed by material guard |
|---|---|---|---|
| 0 | Concatenated opening containing `Work Schedule: PH Dayshift`, role/setup/headcount and an inbound-lead duty | Mixed source unit containing schedule detail | important_requirements, application_notes, other_details |
| 3 | `Work Schedule: PH Dayshift` | Actual work schedule | Same three sections |
| 9 | `Schedule appointments and demos of eZee Products/Services.` | Ordinary scheduling duty; lexical collision, not a candidate work-schedule condition | Same three sections under current conservative policy |
| 29 | `Personal vehicle, laptop, and good internet connection` | Actual equipment/connectivity condition; whole vehicle clause must remain attached | Same three sections |
| 35 | `Timezone restrictions: 8` | Aggregator metadata, not a supported eight-hour candidate schedule | Same three sections; presentation suppresses the exact metadata line |

Actual schedule/equipment statements are appropriately selected for Important requirements. The mixed opening, ordinary scheduling duty and aggregator timezone are safely retained in Other source details. Application notes is technically allowed by the guard but is not recommended for non-application statements. No matching statement may go into About role, Responsibilities, Requirements, Nice to have, Benefits or Company overview unless a preference exemption applies. Other guards may reject first: unit 9 in Requirements fails `unsupported_requirement`; unit 29 in Requirements reaches `material_condition_misplaced` because its qualification context passes the earlier requirement guard.

`Dayshift` alone is **not** matched by the `shift` word-boundary branch. Unit 1's role-title Dayshift is not a match; units 0 and 3 match `Schedule`. `Work Setup: Remote / Client Visits` and `Occasionally visit local properties...` do not match this detector. They remain source facts; detector non-match does not establish eligibility or absence of conditions.

An additional existing lexical collision occurs at unit 11: the duty containing `CRM application` matches the application detector. It must remain in Other source details or Application notes under current rules. The existing `application_note_ids` already makes that conservative classification explicit. This investigation does not relax it or misrepresent it as a recruitment application condition.

## Heading, schema, prompt and presentation findings

Responsibilities and Requirements headings are recognized. Equipment unit 29 receives requirements context correctly, but that context does not permit equipment in hard Requirements. The material guard is independent of headings and remains fail-closed.

`Key Competencies for the Role:` is currently unrecognized, so its six competency lines retain responsibility context. This is a separate context limitation that could produce `unsupported_requirement` if chosen as hard qualifications, not the reported material error. No speculative competency-heading patch was bundled. The complete safe selection retains those competency passages in Other source details.

The concatenated opening is retained because it is not an exact source duplicate. Splitting/deleting it would change the extractive contract and is unnecessary for this failure. The strict output schema still requires all nine arrays of integer IDs; every unit is assigned exactly once. Presentation still runs only after complete validation, hides recognized headings, handles metadata/conflicts, retains substantive condition/duty text and preserves the complete Original description. No presentation change is needed.

The existing prompt asks to group duties by section and route material words to Important requirements. The scheduling duty's responsibility context and the equipment clause's requirements context provide competing selection cues. The guard provides no deterministic material ID list to the provider, unlike application IDs. This supports a small guidance improvement; it does not prove systematic model noncompliance or guarantee the next generation succeeds.

## Patch

Only provider input/guidance changes in production code:

- `src/quick-read-generation.js`: send `material_condition_ids` computed directly with the unchanged material regex. Explain that these conservative keyword matches override section hints for non-preferred entries; only the same three sections are allowed. Guide ordinary duties/aggregator metadata to Other source details rather than converting them into candidate conditions. Preserve whole mixed units and existing preference/application precedence. IDs flag guard matches, not semantic proof of a mandatory qualification.
- `test/quick-read-43635.test.js`: five regression tests using genuine source, local mocked provider/service calls, exact detector-ID assertions, allowed/forbidden routing, adversarial placements, coverage/corrupt-payload checks, synthetic preference/mixed/application probes and complete Original preservation.
- `test/fixtures/business-development-43635.txt`: genuine current public source fixture.

`sourceUnits`, headings, preference detection, material detection, `validateSelection`, `validateStored`, schema, hash binding, service persistence, presentation and runtime configuration are unchanged. No global relaxation or new exemption. The input ID list includes preferred keyword matches too; guidance explicitly preserves preference/application precedence and tests preserve existing upgrade/mixed-condition rejection.

## Reproduction and validation

On untouched baseline, a fully covered safe selection with only unit 29 moved into Requirements produces `material_condition_misplaced`. Moving only unit 9 into Responsibilities produces the same error. Moving unit 3 into About role reproduces it as well. These same unsafe placements are rejected after the patch; the change improves provider guidance, not validator acceptance.

| Validation | Baseline | Patched |
|---|---|---|
| Focused Quick Read tests | 51 passed | 56 passed |
| Full suite | 135 tests: 126 passed, 5 failed, 4 skipped | 140 tests: 131 passed, same 5 failed, 4 skipped |
| Build / Wrangler deployment dry-run | Passed | Passed |

No new failures. Full suite is not green. The same unrelated baseline failures remain: default-disabled digest config expectation; category query quoting; job-detail application-link expectation; search noindex/canonical rendering; numeric job-detail direct application-link expectation. Logs contain the exact assertions. Four inherited skipped tests remain skipped.

Existing focused tests preserve 37688's application warning/seasonal hours/benefits/presentation, 41638's seven qualifications, 43639's evidence-excerpt preference/heading/metadata/conflict behavior, and 41645's exact headings/duties boundary/preferences. Existing fingerprint, all-unit coverage, source references, preference/requirement upgrades, mixed obligations, material/application routing, stored all-or-nothing validation, service failure handling and DB cooldown safeguards pass. No tests call a real provider or production endpoint.

## Operator-only deployment and one future retry

These steps are instructions, not actions performed here.

1. Review/apply the supplied patch against `dba5920`, or rebase and rerun validation if the checkout has advanced. Review inherited full-suite failures under your release policy; do not represent the suite as green. Deploy through the existing controlled process only when approved. No migration is required.
2. Keep `QUICK_READ_BATCH_ENABLED=false` and existing manual generation mode, model, secrets and runtime settings. Do not invoke batch generation.
3. Read the private 43635 cache status and latest `retry_after` without changing the row. Normal failed-row cooldown is one hour from recorded failure; use the actual current stored deadline and check for any newer failure. Wait until it has elapsed. If the row is running, ready, unexpectedly source-changed or unclear, investigate before generation. Do not delete cache, alter source/hash/timestamps or bypass cooldown.
4. After confirmed deployment and cooldown, with the existing authorized operator token already available, allow exactly one invocation from the repo:

```powershell
& "C:\Program Files\nodejs\node.exe" "scripts/generate-quick-read.mjs" --site "https://veeays.com" --job 43635
```

5. Stop after that invocation. If anything other than `ready` occurs—including failed, unchanged, retry_later, busy, rate_limited, timeout or ambiguous output—preserve output and inspect private status. No second request, automatic retry, forced regeneration or job 41641 progression.
6. If ready, inspect the complete Original and Quick Read. Preserve PH Dayshift, remote/client-visit setup, local visits, complete personal-vehicle/laptop/internet clause, all qualifications and competency passages. Scheduling appointments is an ordinary duty; under unchanged conservative policy it may appear under Other source details. Do not interpret timezone metadata or CRM application prose as new candidate conditions. Confirm no omissions or inferred qualifications.

If failure persists, evidence needed is exact failed selected IDs tied to exact claimed source bytes/hash through an authorized diagnostic mechanism. No such logging/retention was introduced. Investigate the new evidence independently before another retry or rule change.
