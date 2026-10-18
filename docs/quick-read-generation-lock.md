# Quick Reads generation lock — release assessment

Assessment: **NO-GO for deployment**. Safety patch is prepared for review; production remains unchanged.

## Scope and implementation

Based on PR #15 head `4d615ce794841f0e5ff0f06cdc90823d30c4ee07`, on a separate branch `codex/quick-reads-generation-lock-20261018`. Target the PR #15 branch so this PR contains only the safety delta. Original release base resolves to `626011e` (PR #11 sidebar merge).

- New `QUICK_READ_GENERATION_ENABLED` requires the exact string `true`; missing, false and malformed values disable generation.
- Gate runs before scheduled queue/candidate RPCs, manual single/batch RPCs, per-job claims, and each provider entry point (including the older organizer). Disabled manual requests return 503 `generation_disabled`.
- Cron additionally requires `QUICK_READ_MODE=auto` and `QUICK_READ_AUTO_ENABLED=true`. Manual mode no longer permits scheduled generation.
- Checked-in master, auto and batch flags are false. Remove only `0-59 * * * *`; preserve digest, strong-match and health schedules.
- Existing provider fixtures explicitly opt in to exercise the same validations. No content assertions were removed. The health schedule assertion reflects the intentional cron removal.
- No cache reads, formatter/schema/source-rule identities, validation rules, SQL migrations or RPC arguments changed. Disabling blocks before claims, so this patch cannot clear cached payloads or write queue/cache state while disabled.

## Read-only production verification, 18 October 2026, approximately 18:21–18:24 Manila

Cloudflare deployment list, GET settings, GET schedules, GET version metadata, and GET deployed script were read. Supabase catalog, aggregate cache counts and control rows were SELECTed; no claim/enqueue/finish function was executed.

- Active Worker version: `bb53a981-3369-4275-9b8b-20bba39954f0`, version number 369, 100% deployment. Created 02:05:52 UTC / 10:05:52 Manila; annotation: approved PR11 application sidebar, current live code and 84 assets retained.
- Effective Worker flags: auto=true, batch=true, mode=manual, model=gpt-5-mini, provider=openai. New master switch absent. OpenAI/admin/service-role secret bindings exist; their values were not retrieved or tested.
- Actual registered schedules: `* * * * *`, `0-59 * * * *`, `*/15 * * * *`, `17 */6 * * *`.
- Downloaded live handler confirms cron checks only cron identity and auto=true, ignoring manual mode. Live manual endpoint requires manual mode but has no master disable gate.
- DB auto control: enabled=true, activated 2026-10-08T09:44:38.96073Z. Rollout: enabled=true, ongoing=true, cooldown=null, pause_reason=null, claims=882, reserved_usd=123.48, worst_request_usd=0.14, budget=null. Reservation counters are NOT actual provider billing. Control next_claim_at was 2026-10-18T05:00:17.888459Z.
- Cache snapshot: 2,690 ready schema-2/source-organizer-v2 rows; 74 failed schema-2 rows; 16 failed rows with null schema. Snapshot is not a promise these counts remain static while the live scheduler runs.
- Live claim/finish/candidate/enqueue signatures match the candidate call arguments. Claim function retains rollout, auto activation, retry, spending/cooldown and recovery checks. Ongoing mode bypasses the initial fixed rollout cap/budget conditions. These DB controls currently do not constitute a generation stop.

## Actual parity result: not established; confirmed substantive drift

Downloaded live module was parsed with Acorn and compared with a fresh dry-run build of release base `626011e`, using the repository comparator's existing normalization. Startup statements match, but 14 declaration keys differ, with additional naming/export inventory differences. This is a diagnostic comparison, not a proof that all 14 differences are semantic (bundler aliases and export wrappers affect inventories).

Two inspected differences ARE semantic:

- Live `getUser` checks `veeays_member_active` when `ADMIN_MEMBER_ACTIONS_ENABLED=true`, rejects `banned_until=infinity` and future bans. Recovered base lacks these checks.
- Live refreshed sessions revalidate through `getUser` when member actions are enabled. Recovered base can accept `data.user` directly.

Both differences predate this safety patch. Do not deploy the entire candidate over production until live protections are preserved and all remaining differences are classified. The candidate dry run reads 86 assets versus the live version annotation of 84; live asset manifest/content parity was not independently downloaded or proven. The sidebar is present in the recovered base, but that alone does not prove production parity.

Effective config also differs: live JOB_HEALTH_VERIFY_ENABLED=true versus checked-in false. Several retained runtime flags/bindings are not in checked-in vars. `keep_vars=true` is retained to avoid unrelated settings deletion; a future operator must verify the effective master switch after rollout and must not assume local vars equal live vars. Admin schedule estimates are static expectations, not evidence that a cron remains registered or enabled.

## Offline validation

- Focused gate/schedule/summary/live-quality-fixture/database tests: **36 passed, 0 failed**. Fixtures use synthetic provider responses; no paid calls.
- Complete final suite: **479 tests; 474 passed, 1 failed, 4 skipped**. Only failure: existing logo fallback assertion. Reproduced on unchanged release base: quick-read-generation suite 16 passed, same 1 failed. Fixture hashes pass in this fresh LF checkout.
- Health schedule suite after intentional schedule assertion update: **12 passed**.
- Wrangler 4.144.0 dry-run build passed. No upload/deploy occurred. Local initial invocation logged a sandbox log-path warning; bundling completed and exited successfully.
- Diff whitespace check passed.

No revised-prompt live quality authorization exists in this task. Offline quality fixtures are not live quality evidence. No provider credentials were validated, summaries generated, caches regenerated, or costs incurred through provider calls by this task.

## Rollout checklist — future authorization required; do not execute now

1. Re-read current production version/settings/schedules and DB gates; record timestamps and secure rollback artifact. Reconcile recovered-base auth/member protections and all other production differences, assets and bindings before proposing the final deployment artifact.
2. Obtain separate deployment approval for that reviewed artifact. Keep revised-prompt paid quality work separately authorized. Stop any external scripts/other Workers that could generate independently; this application switch cannot govern other systems.
3. For a strict zero-generation cutover, obtain explicit approval to pause the existing live generation paths first (old Worker ignores the new switch). Disable current automatic/manual runtime paths and pause DB auto/rollout gates through a separately reviewed change. Account for in-flight calls; an already-issued provider request cannot be cancelled by this patch. Wait for existing invocations/leases to settle and verify no ongoing requests before declaring the zero-generation window.
4. Deploy only the reconciled artifact with master=false, auto=false, batch=false and no Quick Reads cron. Preserve all unrelated settings/secrets/routes/assets. No SQL migration or cache deletion is required. Treat effective configuration as a required postcondition, especially with keep_vars.
5. Read back the active version and effective flags. Verify Quick Reads cron absent and other schedules unchanged. Verify master is exactly false (absence is also fail closed in new code, but explicit false is easier to audit).
6. Only after active code/config verification, safely probe manual single/batch disabled responses (503 generation_disabled), use cached-summary GETs to confirm old summaries still display, and compare read-only cache/queue/provider counters across an observation window. Do not probe a generation POST on the old or unverified Worker.
7. Re-enable only under separate explicit approval: master=true + mode=manual + valid admin/provider configuration permits single generation; batch additionally requires batch=true. Automatic generation requires master=true + mode=auto + auto=true + restored cron + DB gates. These are deliberate enable operations, not part of this release.

## Rollback checklist — future authorization required

1. Keep generation paused; record any in-flight requests. Prefer rolling forward to the previous reviewed artifact WITH the master gate retained and disabled.
2. Do not blindly restore version bb53a981 or its config: that code ignores the new switch and can resume automatic/manual paid generation. If restoring it is necessary, separately approve and verify old-code-compatible runtime AND DB stop controls first; keep Quick Reads cron absent.
3. Restore unrelated settings/assets/routes from the verified snapshot; ensure effective generation stops survive rollback. Never activate all historical schedules as a blanket rollback step.
4. Verify cached-summary reads, active version, effective flags, schedules, and DB gates read-only. Monitor for new claims/provider attempts. Leave cached summaries and DB schema intact; no reverse migration is needed.

## Remaining unknowns / decision

**NO-GO:** production-base drift is confirmed; full code/assets/config parity is incomplete; revised-prompt live quality remains unverified; the existing unrelated logo test fails. The safety patch itself passes focused offline checks and adds no live changes. Production generation risk remains active until a separately authorized live pause or controlled rollout. This patch guarantees no new provider calls through its guarded paths when the effective master switch is not exactly true; it does not retroactively stop old code, in-flight calls or external generators.
