# Quick Read 41645 investigation

Diagnosis: A is the best-supported explanation. A genuine qualification block has an unrecognized exact heading. A local, fully covered selection placing its genuine portfolio qualification under Requirements reproduces `unsupported_requirement` on the untouched baseline. This is a demonstrated false-positive path, not proof of the production selection. B (systematic model/prompt issue) is unproven; C (correct rejection of an unsafe placement) remains possible for the actual failed response.

## Checkout and evidence limits

- Original checkout: `C:\Users\gmrea\Documents\GitHub\va-jobs-ph-web`, clean at `cb0beaf67daac8782460720f77a22347767d1899` (43639 test). Latest section recognition/presentation cleanup is present. Original checkout remains clean and unchanged.
- Work performed in an isolated filesystem copy, excluding Git metadata, secrets, dependencies and build output. Dependencies installed from the frozen lockfile for validation.
- No 41645 source fixture existed in the repo; a search of local Codex text/Markdown/JSON/HTML material found no preserved 41645 source. Genuine source was obtained by a read-only GET of [the public listing](https://veeays.com/jobs/41645), which showed the Original description and unavailable Quick Read.
- Capture: October 4, 2026, Asia/Manila. Fixture is the HTML-decoded contents of `div.qr-original`, retaining whitespace. It is genuine current public description data, not an invented employer listing. SHA-256 of UTF-8 fixture: `24b0bb39e8b87e87fe5365a07adc328b5d4a03f55968aed3a797cd6457b198b8`.
- Exact source revision at the failed attempt is not independently established: no private DB source/hash comparison was performed. The current public source is not proof of historical DB bytes. Failed provider response was not recovered. Current provider requests use `store:false`; validation throws before persistence of a ready payload. No exact offending production ID, model selection, or causal certainty is claimed.
- No deployment, production generation, runtime-setting change, SQL migration, schema/version bump, cache deletion, timestamp editing, cooldown bypass, or acceptance job #4 action was performed. Production settings were not inspected; `QUICK_READ_BATCH_ENABLED=false` remains an operator requirement and no setting was changed here.

## Source analysis and narrow patch

Baseline extraction produces 63 units, all with `unknown` context. Unit 10 is `HAVE WHAT IT TAKES TO BE OUR GRAPHIC DESIGNER / VIDEO EDITOR?`. Units 11–21 are the eleven qualification passages. Unit 11 contains `preferably`; the existing preference rule prohibits upgrading it to Requirements. Units 12–21 contain ten ordinary qualifications without explicit mandatory keywords. Each is rejected as unsupported if selected as a Requirement on baseline despite its source qualification context.

The complete local reproduction assigns unit 12 (the genuine strong-portfolio qualification) to Requirements and every other unit to Other source details. It fails with `unsupported_requirement` on baseline. This is an intentionally mocked local selection, not recovered production output.

Patch recognizes only the exact qualification heading and exact unit 22 duties heading, `DAY IN THE LIFE OF A GRAPHIC DESIGNER / VIDEO EDITOR`, case-insensitively under existing trailing-colon normalization. The second heading is essential: duties must terminate qualification context. There is no fuzzy role-name pattern or broad keyword match. Presentation hides those two exact headings after complete validation; substantive source units and Original description remain intact. Duties subheadings are retained; no additional cosmetic cleanup is necessary for the failure fix.

The validator, prompt, output schema, fingerprint binding and stored validation are unchanged. The existing prompt already requires Requirements to have requirements context or explicit mandatory words, directs unknown headings/text to Other source details, and preserves preference/application/material conditions. The heading omission creates tension with intuitive model qualification selection, but one unavailable response cannot establish systematic prompt noncompliance. No prompt change is justified by current evidence.

The experience passage remains whole in Nice to have under existing preference safeguards; it is not split to invent a hard 2–3-year requirement. Internet allowance and work schedule retain existing material-condition routing. On-site content duties remain visible alongside the remote-work source claim; no contradiction is resolved or omitted. The company/application/aggregator tail cannot become qualification context after the duties boundary.

Exact changed paths (repo-relative):

1. `src/quick-read-generation.js` — two exact context headings.
2. `src/quick-read-presentation.js` — hide the same two exact headings after validation.
3. `test/quick-read-41645.test.js` — genuine fixture assertions, local/mock reproduction, adversarial routing, full coverage, corrupt-stored fallback and presentation/provider tests.
4. `test/fixtures/video-editor-designer-41645.txt` — genuine public Original description capture.

The regression test explicitly labels synthetic heading/preference/mixed/application mutations. Genuine duties, benefits, company prose, preferences, application passages and aggregator metadata are also probed as unsafe Requirements. Preference upgrades, mixed obligations, omitted units, invented references and corrupt stored payloads remain rejected. Context recognition remains heading-based; this patch does not make the validator a semantic classifier for arbitrary unseen prose, and existing explicit mandatory-word rules are unchanged.

## Validation

| Check | Exact baseline | Patched |
|---|---|---|
| Focused `node --test test/quick-read*.test.js` | 47 passed | 51 passed |
| Full `node --test` | 131 tests: 122 passed, 5 failed, 4 skipped | 135 tests: 126 passed, same 5 failed, 4 skipped |
| Wrangler deployment **dry-run** | Passed with broader local file access | Passed with same access |

No new regression. Full suite is not green. Pre-existing failures, unchanged by this patch:

- `default disabled, wrong cron, and before activation never access network` (`test/daily-digest.test.js:71`): checked-in config is enabled, test expects disabled.
- `search is quoted and pagination/filtering happen in Supabase` (`test/worker.test.js:37`): category filter quoting assertion.
- `job detail escapes content and rejects script application URLs` (`test/worker.test.js:45`): rendered application-link expectation.
- `search results are noindex; page two has its own canonical` (`test/worker.test.js`): search rendering expectation.
- `numeric job detail keeps the original application link and canonical` (`test/worker.test.js:114`): test expects direct employer link while current rendering uses `/apply/101`.

Focused tests include 41638's seven qualifications/Skills & Experience, 43639 evidence-only preference/heading/metadata/conflict tests, and TechnologyAdvice 37688 auto-rejection warning, seasonal hours, benefits and presentation tests. Existing hash, coverage, upgrades, material/application conditions, all-or-nothing stored validation, endpoint and database safeguards pass. The 43639 test evidence is excerpts, not a full captured production payload.

Initial sandbox dry-run failed on parent-directory read permissions; both baseline and patched dry-runs then passed with approved broader file access. Test/provider calls are local mocks, with no real OpenAI generation. Test skips are retained from baseline, not newly introduced. Logs and baseline source-unit/reproduction evidence are included in the ZIP.

## Controlled operator deployment and one future retest

These are instructions only; none were executed here.

1. Review the four changed files and patch against the stated baseline. If checkout has advanced, rebase/review and rerun focused tests, full-suite comparison and build dry-run. Resolve the unrelated baseline failures according to your release policy; this report does not label the full suite passing.
2. Deploy through the existing controlled GitHub/Cloudflare process when approved. No SQL migration is needed. Keep the existing model, secrets, manual generation mode, cron and runtime settings. Verify `QUICK_READ_BATCH_ENABLED=false` and leave it false. Do not run batch generation.
3. Read the private 41645 cache status/source binding and its current `retry_after` without editing it. The existing SQL failure cooldown is one hour from recorded failure; use the actual stored deadline, not an assumed timestamp from this report. Wait until that deadline has passed, and check for any newer recorded failure. Preserve the row/hash/timestamps. If status is running, ready, source-changed unexpectedly or otherwise unclear, stop and investigate before issuing a generation request.
4. After confirmed deployment and cooldown, from the repo with the existing authorized operator token available, permit **exactly one** invocation:

```powershell
& "C:\Program Files\nodejs\node.exe" "scripts/generate-quick-read.mjs" --site "https://veeays.com" --job 41645
```

5. Stop after that single invocation. For anything other than `ready` (including failed, unchanged, busy, retry_later, rate_limited, timeout or ambiguous response), preserve output and inspect private status; do not invoke again or automatically retry. Do not clear cache, alter timestamps/hash, force a bypass or proceed to acceptance job #4.
6. If ready, inspect the public result: ten ordinary qualifications under What they're looking for, complete preferably passage under Nice to have, correct schedule/allowances, intact duties including on-site content, all three application passages, metadata/conflicts and complete Original description. Confirm headings are hidden only in Quick Read. Preserve batch-disabled state.

If a future failure persists, additional evidence needed is the failed selection IDs tied to exact source units/hash through an authorized, privacy-reviewed diagnostic mechanism. Do not assume a repeat shares this cause or weaken grounding. This patch does not add production logging or retention.
