# Live-source reconciliation — reviewed résumé release

## Authoritative baselines

- Repository: `gmrealcommph/va-jobs-ph-web`, starting commit `f21a20de699ed7e96629cb828f3c9666029647cb`.
- Production Worker: `va-jobs-ph-web`, version `713c64bc-c3a6-41d5-91fc-b3f111d36268`, deployment `caef3b8b-c790-40f2-91f3-977d6835f215`, 100% traffic.
- Approved review Worker: `veeays-ai-guidance-preview-20261024`, version `de50fbe1-7064-4580-9a12-0652cfa98b7a`. It was not uploaded or redesigned during release preparation.
- The existing GitHub Desktop checkout is on `codex/quick-read-validation-citations`, with unrelated local changes. It was inspected read-only and left untouched. This release branch is in a separate checkout of the verified repository.

Git main is **not** assumed to equal production. There are 27 live plain-text variables different from or missing in its old Wrangler configuration. `configuration-drift.json` lists names only. No private variable or secret values are committed.

## Reconciliation strategy

Recover the actual seven deployed modules, verify their SHA-256 hashes, and retain them under `src/production-baseline/20261024`. This is an immutable deployment snapshot, not a claim that the old editable `src/worker.js` reproduces live production. It provides a narrow, auditable bridge until a separate source de-bundling/migration is reviewed.

`scripts/build-resume-release.mjs` creates a code-only multipart candidate:

| Live module | Release treatment |
|---|---|
| `production-entry.js` | Exact bytes retained: guide redirect and existing asset overlays remain. |
| `reviewed-live.js` | Only the `studioBody` import points at the reviewed view. All routing, auth, subscription, Quick Reads, database, email, scheduled and security implementations remain exact. |
| `your-pro.js` | Exact bytes retained, including current approved hero and guide. |
| `application-guide.js` | Exact bytes retained. |
| `pro-tools-ui.js` | Exact bytes retained, including live consent and optional-question controls. |
| `improved-endpoint.js` | Exact bytes retained: provider safeguards, caps, quota/cooldown, grounding, reservations and accounting. |
| `polished-studio.js` | Original module retained as evidence; only the résumé view import is replaced. |

Two new modules provide the reviewed view and seven exact reviewed browser assets. No database/schema, authentication, subscription, pricing, payment or AI-service code is replaced. Browser dependencies are independently hashed from public live URLs; the Word fallback's unversioned `resume-export.js` dependency is included in the offline graph.

All eight view option combinations match the approved view after preserving the current production Pro-panel stylesheet alias. Both stylesheet aliases were fetched and are byte-identical. No visual design was changed.

## Deployment configuration preservation

The candidate metadata uses `keep_assets: true` and retains all existing binding types (`plain_text`, `secret_text`, `durable_object_namespace`, `assets`). It supplies no replacement bindings, secret values, migrations, schedules or routes. The two active Durable Object namespaces and all exported classes remain unchanged. Compatibility date/flags, usage model, placement, logging and tail-consumer settings are retained.

The live asset configuration serves matching assets directly. All seven new versioned paths were checked for conflicting live assets; none conflict. Existing ASSETS contents are retained rather than uploading the older Git checkout's `public/` tree. Asset-routing evidence is in `asset-routing-check.json`.

Four existing cron schedules are fingerprinted. Every binding is represented by name/type/hash, never a secret value. `check-resume-release-live.mjs` is read-only and fails if the live deployment, module set, configuration, schedules or browser dependencies drift before release.

## Automatic deployment risk

Cloudflare Builds is connected to this exact repository and includes only `main`. Its current commands are `pnpm run build` then `npx wrangler deploy`. A push to this review branch does not match that trigger.

The PR deliberately changes the normal build command to a fail-closed review gate, and gates `npm run deploy` as well. **The build-gate failure is intentional.** It prevents a later merge from automatically deploying the older root Wrangler configuration. No Cloudflare trigger/configuration was changed during this task. Do not remove the gate or use the old root deployment command to release these templates.

## Validation

- 23 release tests pass, covering all seven source hashes, the one-line import change, unchanged reviewed assets, preserved handlers/exports, metadata preservation, eight Pro/AI view combinations, response parity on 13 unrelated routes, and deployment guards.
- The export tests include 96 profile/design combinations, source preservation, bounds, generated PDFs/Word files and all 12 draft-recovery identifiers.
- Full repository comparison with external network disabled: baseline 488 tests / 448 pass / 36 fail / 4 skipped; release 512 tests / 472 pass / 36 fail / 4 skipped. The exact 36 failure names match; **zero new failures**. Existing failures concern Quick Reads provider/configuration fixtures and activity timing. See raw logs and `regression-comparison.json`. The entire suite is not green.
- Existing approved-candidate evidence includes actual browser exports for all 12, native Microsoft Word rendering, matching page counts, 36 stress/photo export cases, mobile preview/editing/draft checks, and 28 auth regression checks. The frozen ZIP includes that evidence; no paid test calls occurred.

Remaining release gates: design approval, PR review, explicit production approval, acknowledgement/triage of existing suite failures, and a fresh successful live preflight. No merge or production deployment was performed.
