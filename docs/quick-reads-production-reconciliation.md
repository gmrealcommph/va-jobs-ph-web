# Current release plan

See [quick-reads-release-package.md](quick-reads-release-package.md) for the current disabled-only candidate, fresh containment readback and approval boundary. The historical findings below predate DB/cron containment and the final candidate config.

# Quick Reads production reconciliation — 18 October 2026

**Decision: NO-GO for deployment or generation activation.** The reconciliation is ready for draft review. Production was read only. No settings, schedules, database rows, schema, deployments, or provider requests were changed by this investigation.

## Candidate and verified baseline

PR #16 head was `5f1dff81ec4b5a10c4d37a9f2e7acace9cc40837`, targeting PR #15 (`4d615ce`). Existing PRs remain unchanged. Their four Quick Reads commits were replayed on verified baseline `7d5a6360cb16e9a35420df4e72e90bad4f1c4f33`. The final draft branch retains PR #16 as its parent and applies the reconciliation delta from that verified replay, so the draft diff shows only reconciliation work. Its final tree is checked against the replay tree; neither existing branch is force-pushed. The baseline consists of `626011e`, recovered production behavior (`6c773b4`), then pinned configuration and exact retained assets (`7d5a636`). The baseline alone is an evidence artifact, **not a safe deployment**: its historical generation flags are enabled. Deployable review must use the final branch with the fail-closed patch present.

Replayed commits: `ceff0fd` → `9edc38a`; `96df17e` → `2f8a080`; `4d615ce` → `d723357`; `5f1dff8` → `cf8f664`. The generator, validators, cache identities, service and scheduler are identical to PR #16. The application sidebar is retained. No redesign PR #12 commits or changes were imported. No SQL migration is added or altered.

## Confirmed read-only evidence

Cloudflare GETs before and after comparison show deployment `d742b2ae-e363-4b0d-9b99-c46a69d13fb3`, 100% version `bb53a981-3369-4275-9b8b-20bba39954f0` (369). The enabled `veeays.com` custom domain maps to this Worker in production. Source was downloaded through the script GET endpoint and multipart-decoded. SHA-256: `a69f08256bc6f936db2356683cc6f1ae80efc853bcc9a25939538f885b201376`.

The baseline dry-run bundle matches **all 325 deployed top-level declarations, startup statements and exports**, after removing source positions, literal formatting, shorthand spelling and esbuild `__name` annotations. This is structural code equivalence, not a live behavioral test or a proof against all possible bugs. The candidate has 345 declarations. After two inspected collision aliases (`raw2`, `metadata2`) are normalized, its nine changed existing declarations and twenty additions are confined to Quick Reads generation, validation, presentation, gating and module wiring. All unrelated startup statements and all exports match. The strict comparison script records and asserts those inventories.

Actual differences restored from production:

| Area | Preserved behavior |
| --- | --- |
| `getUser` | With `ADMIN_MEMBER_ACTIONS_ENABLED=true`, calls `veeays_member_active` with the user token; rejects non-true results; throws on guard failure. Rejects infinite/future bans. |
| Refreshed sessions | Revalidates the refreshed token through `getUser` while the member-actions flag is enabled; cannot trust the refresh payload alone. |
| Member management | Restores `/admin/api/members` and its browser script. Preserves admin RPC authorization, same-origin and confirmation-cookie checks, password reauthentication, CAPTCHA handling, protected/MFA account restrictions, throttling, fresh admin recheck, checkout closure and fresh-session logout. |
| Admin policy | Restores the live conditional Turnstile CSP and member script inclusion. |
| Public layout | Restores `styles.css?v=20261018-application-sidebar`. |
| Email coordination | Preserves live `redirect:manual` rather than recovered `error`; both reject non-OK redirects without following them, but exact runtime parity is retained. |
| Assets | Restores `admin-members.js`, omitted `member-emails.css`, and live admin-theme additions. Other differences are line endings. |

The live member-active SQL verifies `auth.uid()`, current ban state, the JWT `session_id` against `auth.sessions`, and session expiry. Its public wrapper is invoker-security; authenticated/service-role execution grants were inspected. Claim auto is service-role/postgres only; direct recovery is postgres only. No member-action RPC or authentication request was executed against production.

All **84 known production asset paths** (the historical 84-file inventory) returned HTTP 200 and match SHA-256 byte-for-byte in the candidate. They have no additional local public paths. Mixed and CRLF line endings are preserved explicitly through `.gitattributes`; that accounts for most of the large asset diff. The raw CSS change is retained live styling, not a redesign. Wrangler reports 88 entries for this tree; the independently enumerated inventory has 84 regular files and four directories. Its displayed count must not be compared directly with the historical 84-asset annotation.

Effective nonsecret vars are pinned to the actual settings, including `ADMIN_MEMBER_ACTIONS_ENABLED=true`, Turnstile configuration, lifecycle gates, and **`JOB_HEALTH_VERIFY_ENABLED=true`**. The live `SIGNUP_RATE_LIMITER` namespace and 60 requests/60 seconds configuration are now explicit; `keep_vars` alone would not represent this non-variable binding. Existing secret binding names/types were recorded, never secret values. Compatibility date `2026-10-01` and empty compatibility flags match. Preserve live assets-serving behavior, observability, domain/routes and secrets in any future upload; settings evidence is not permission to replace them wholesale.

Only intended effective generation differences: master=false (new), auto=false, batch=false, and removal of `0-59 * * * *`. Mode remains manual, but the master switch blocks it. Other three schedules remain unchanged.

## Database and generation state

At **18:34:30 Manila**, SELECT-only evidence showed auto enabled=true, rollout enabled=true and ongoing=true, claims=882, worst-case reserved USD 123.48; `next_claim_at=2026-10-18T05:00:17.888459Z`. Reservation is not provider billing. There were 2,690 ready and 90 failed cache rows, no running cache rows, and queue counts 183 pending / 662 done / 123 stopped, no running queue rows. This snapshot does not establish a durable generation pause.

Downloaded live SQL confirms:

- Auto candidates and claims require enabled auto/rollout controls. Manual generation also calls the auto claim wrapper in this Worker.
- The lower recovery claim does not inspect those enabled booleans, but checks the serialized `quick_read_control.next_claim_at` before creating a claim or clearing a payload. Pausing that timestamp at infinity covers this lower path as well.
- Auto claims and auto finish take the global control lock first. Auto claim then locks rollout/queue/cache; the proposed pause follows this ordering.
- Claims lease for three minutes. Provider code has a 90-second request timeout. A timeout or expired lease alone is not proof that an upstream provider request has stopped.
- Finish validates claim token/lease/source revision. It can settle an existing claim after the pause. Finish may change cooldown/pause_reason, so those fields are **not stop controls**. It does not restore the infinity claim gate or enabled booleans.

Definitions and aggregate snapshots are under `evidence/production-20261018/`. No enqueue, candidate, claim, finish or generation RPC was invoked live; catalog definitions and control/cache aggregates were read with SELECT only.

## Exact future pause and drain procedure — NOT executed

Separate authorization is required because the current task explicitly forbids live changes. Reverify source hashes, active deployment, RPC definitions, control singletons and effective settings at the time of operation; abort on drift.

1. Save a secure current rollback snapshot: version/source, complete asset retention reference, settings/binding names, domain/routes, schedules and all three generation control rows. Identify and stop external generators and operator scripts. Do not expose secret values in reports. Identify existing provider logs/dashboard needed to observe requests without generating a test request.
2. **First apply the separately approved DB pause** in `docs/quick-read-pause-proposal.sql`. It uses one transaction with 5-second lock timeout, 30-second statement timeout; locks control → rollout → auto-control; asserts all singletons exist; sets `next_claim_at='infinity'`, rollout `enabled=false`, auto `enabled=false`; commits. On any error roll back and stop. Read back those three postconditions. Do not modify activation time, reservations, claim counts, cached payloads, leases, retries or queue rows. This serializes after claims already holding the gate; those existing claims still need draining.
3. Through a separately reviewed settings/schedule operation, set **`QUICK_READ_MODE=disabled`, `QUICK_READ_AUTO_ENABLED=false`, `QUICK_READ_BATCH_ENABLED=false`, `QUICK_READ_GENERATION_ENABLED=false`** on the old Worker. Old code ignores the new master switch but rejects manual requests unless mode=manual and scheduled requests unless auto=true. Remove only `0-59 * * * *`; retain `* * * * *`, `*/15 * * * *`, `17 */6 * * *`. Preserve all other vars, secrets, bindings, asset references, domain/routes and health behavior. Read everything back; do not infer effective settings from the file.
4. Record the DB pause commit time and last observed claim/provider request time. Allow pre-pause claims to finish. Inspect running cache leases, running queue rows, reservation/claim counters, latest cache generation/update times and existing invocation/provider request logs. Do not reset leases or tokens to force a clean dashboard. Expired abandoned `running` rows must be classified as stale with corroborating request evidence, not silently cleared.
5. Require no unexpired cache leases, no active queue claims/invocations, no new claim/reservation increments, no new provider request starts, and no active upstream requests. Repeat read-only snapshots at least five minutes apart, both after the latest three-minute lease expiry and confirmed upstream completion. The five-minute window is a minimum observation interval, not a bound on provider work. If invocation/provider evidence is unavailable or external generators cannot be excluded, **zero generation is unconfirmed: stop, NO-GO**. Never use a generation POST as a pause probe on old or unverified code.

Suggested repeatable read-only observation (record timestamps and compare results):

```sql
SELECT now() AS observed_at, next_claim_at FROM public.quick_read_control WHERE id;
SELECT enabled, activated_at FROM public.quick_read_auto_control WHERE id;
SELECT enabled, ongoing, claims, reserved_usd, cooldown_until, pause_reason
FROM public.quick_read_rollout_stop WHERE id;
SELECT status, count(*), max(lease_until), max(updated_at), max(generated_at)
FROM public.job_quick_reads GROUP BY status;
SELECT state, count(*), max(updated_at), max(next_attempt_at)
FROM public.quick_read_auto_queue GROUP BY state;
```

## Future controlled cutover and rollback — NOT authorized or executed

After all pause/drain postconditions and release blockers are cleared, obtain approval for the exact reviewed commit, bundled artifact and retained asset/config manifest. Upload/deploy only that artifact, master=false, auto=false, batch=false, **mode=disabled** as a cutover override, no Quick Reads cron, DB gates still paused. Preserve the pinned auth flag, rate limiter, every secret binding, unrelated schedules and production settings. Do not deploy the historical baseline commit or use an unreviewed plain deployment that drops bindings/settings. No database migration or cache invalidation is needed.

Read back the active version/traffic split, script hash, settings, binding inventory, schedules, domains and retained asset manifest. Confirm old traffic is drained, master=false, old-code-compatible runtime stops and all three DB stops. Only then check disabled single and batch endpoints for 503 `generation_disabled`, with no provider or claim activity. Check cached-summary display, sign-in/session behavior and admin authorization using separately approved safe accounts; do not mutate member records as a smoke test. Repeat the zero-generation observations. This task authorizes none of these live probes or changes.

If cutover fails, keep DB infinity + both disabled booleans and mode=disabled/auto=false/batch=false/master=false throughout. Prefer restoring a reviewed artifact with the fail-closed switch still present. If original bb53 code is necessary, restore its code/assets and unrelated settings **without restoring historical generation vars or Quick Reads cron**; verify old-code-compatible stops before routing traffic. Do not use an automatic rollback command that restores enabled historical configuration. Re-read effective settings, DB gates and request activity after rollback. Never reset the infinity timestamp, re-enable rollout/auto, re-add the Quick Reads cron, clear caches or regenerate as part of rollback. A new activation requires separate explicit approval and budget/quality review.

## Offline validation and remaining limits

- 73 focused auth/member-actions, ban/refresh, gate, scheduler, summary/live-quality-fixture and SQL cache tests passed.
- One additional PGlite test loaded actual downloaded production auto/recovery/finish definitions: claim works before pause; reviewed pause blocks new auto and direct recovery claims; in-flight finish still works; infinity gate and reservations remain intact.
- 14 configuration/assets/health tests passed. The health schedule expectation was updated to preserve the confirmed live true value, while retaining an explicit disabled-path assertion.
- **88 targeted offline tests passed total.** No paid provider requests; provider fixtures are synthetic. Dry-run build passed with the rate-limit binding represented. Baseline structural parity and candidate permitted-difference checks passed. No full-suite rerun: prior PR #16 evidence was 474 passed, one pre-existing logo failure, four skipped. That known failure is unresolved, not counted as a current passing check.

Confirmed: deployed-source equivalence of the reconstructed baseline; retained auth/authorization behavior; all 84 known asset bytes; represented nonsecret config and signup binding; unchanged PR #16 generator/switch logic. Unknown: authoritative enumeration of any additional deployed assets (the script/settings GETs do not supply a complete manifest); secret validity, all infrastructure outside this Worker/custom domain, external generators, real upstream in-flight requests, production smoke behavior, and revised-prompt live quality. Public HTTP asset hashes and historical inventory do not prove there are no unlisted assets. Preserve the existing asset manifest/reference in a future upload until authoritative inventory is secured.

**NO-GO remains explicit** until full asset retention is proven, old code is paused and drained with zero-generation evidence, live-quality acceptance is resolved under separate authorization (or a separately reviewed disabled-only release scope is approved), and the exact deployment/rollback operation is authorized. This draft reduces known parity risks; it grants no deployment or paid-generation approval.
