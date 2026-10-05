# Quick Read operator backfill (Alfred)

This local Windows PowerShell 5.1 script automates the protected production batch endpoint. It requires `QUICK_READ_ADMIN_TOKEN` in the process environment. It makes no changes to the generator, validators, database, or public application. Do not run concurrent backfill operators.

## Overnight production run

In GitHub Desktop, review and commit these three updated files, then push the commit:

- `scripts/quick-read-backfill.ps1`
- `test/quick-read-backfill.tests.ps1`
- `docs/quick-read-backfill.md`

This is a local operator tool; no application redeploy, migration, or production configuration change is required. Open PowerShell at the repository root. Supply the admin token through your existing secure environment setup. Do not paste it into a command that saves it in shell history, commit it, or include it in screenshots.

Recommended first production command (only when Alfred is ready):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\quick-read-backfill.ps1 -AfterId 5438 -UntilExhausted
```

`ExecutionPolicy Bypass` applies only to that child process; it does not change the machine policy. Omit it if your policy already permits local scripts. Organization policy may still prevent execution.

The script reads the inherited `QUICK_READ_ADMIN_TOKEN`; it does not ask for or print the token. The cursor is required. There is no implicit production cursor. Starting at `5438` continues after the latest confirmed production cursor; this runner never calls a single-job endpoint or retries an already completed failed job.

## Bounds and progress

- `-UntilExhausted` is opt-in and requires an explicit `-AfterId`. Do not combine it with `-MaxJobs`. It continues through partial batches, sparse IDs and validation failures until a valid HTTP 200 response has `results: []` and `next_after_id` exactly equal to the requested cursor.
- The signal comes from `src/quick-read-service.js`: it iterates every candidate returned by `quick_read_candidates`, and returns the last completed ID or the supplied cursor when none completed. Empty results therefore mean the candidate query returned no currently eligible jobs above the cursor. This is not a guarantee that leased jobs, delayed retries, changed sources or newly added jobs are finished. A short nonempty batch is never exhaustion.
- Overnight mode has a default emergency cap of 10,000 completed candidates, configurable with `-EmergencyMaxJobs` (multiples of 5, 5 through 100,000). Reaching it stops with exit code 1 and `emergency_job_ceiling_reached`; it does not claim exhaustion. There is also a finite request ceiling of `(candidate cap + 1) * (MaxRetries + 1)`.
- `MaxJobs` defaults to 50 and accepts multiples of 5 from 5 through 500. It counts candidates whose returned status advances the cursor, including validation failures and skipped statuses. `busy` and `rate_limited` are not counted.
- Requests normally use `limit=5`. After a partial batch, the last request may use a smaller limit to enforce the candidate cap. Ten full batches process 50 candidates; gate responses can require more requests.
- Requests run sequentially, with a default 15-second wait between batches. `-WaitSeconds` accepts 10 through 300. The checked-in global gate is 10 seconds; generation latency can still cause the endpoint to return partial batches.
- `busy`, per-job `rate_limited`, and HTTP 429 wait and retry from the returned cursor (or the unchanged cursor for HTTP 429). The default bound is three additional requests per consecutive busy/rate-limited sequence, including partial responses. Backoff starts at 30 seconds, doubles, and caps at 300 seconds. A normal response resets the retry count. `-MaxRetries` accepts 1 through 10.
- HTTP 429 `Retry-After` seconds or dates are respected up to 900 seconds; malformed or longer values stop the run. Confirmed DNS/proxy DNS failures before sending use the same bounded retry/backoff. Other HTTP errors, including 401, 403 and 5xx, and uncertain timeout/connection failures stop immediately. This deliberately preserves the existing infrastructure stop rule: the batch endpoint can commit some jobs and then return 503, and its candidate query excludes active leases. Replaying an uncertain request could advance past unfinished leased jobs. Safely retrying these outcomes would require a server recovery/idempotency protocol; this operator-only change does not guess.
- Responses must contain an array of ordered job results and an exact matching `next_after_id`. Unknown statuses, unsafe error codes, repeated/backward IDs, malformed responses, and unexplained cursor stalls stop without trusting the response. Empty results complete normally only if the returned cursor is unchanged.
- Ordinary validation errors such as `invalid_source_reference` are counted and left alone. Provider HTTP/configuration errors, `generation_failed`, and unexpected claim/source state errors stop after recording the response's valid checkpoint.

Each request prints its batch number, cursors, job IDs/status/error codes, and cumulative counts. `ready` means newly returned `ready`; `unchanged`, `retry_later`, and `ineligible` count as `other`, not new successes. The final summary includes failed counts by code and a completion/stop reason. Normal exit code is 0; early-stop exit code is 1.

Reports default to `%TEMP%\VeeAys-QuickRead\quick-read-<UTC timestamp>-<unique ID>.json`, outside the repository, so no generated reports enter Git. They contain only normalized job fields and counters, never headers, tokens, raw responses, or job descriptions. The report path is printed at startup. Checkpoints are saved after every validated nonempty batch, before each wait and again at exit. Updates write a sibling `.tmp` then atomically replace the JSON, retaining the prior checkpoint as `.previous`. An unwritable report destination stops the runner before further requests. Keep custom report folders outside the repository. To choose a local location outside the repository:

```powershell
.\scripts\quick-read-backfill.ps1 -AfterId 5438 -UntilExhausted -ReportDirectory "$env:TEMP\VeeAys-QuickRead"
Get-Help .\scripts\quick-read-backfill.ps1 -Full
```

After any stop, inspect the summary/report before starting another run. Supply the report's `final_cursor` explicitly for a subsequent bounded run. Do not increment cursors yourself. On malformed responses, interrupted requests, or infrastructure failures, the checkpoint can lag work committed on the server; investigate before resuming. The endpoint's existing cache/gate rules still apply. A process kill or power loss cannot guarantee a final report, but the prior saved checkpoint remains. Do not schedule an automatic restart or automatic retry of failed jobs.

For resumption, substitute the saved `final_cursor` for 5438 in the overnight command. A report with `finished_at: null` and `reason: interrupted` is an in-progress checkpoint, not a completion claim. Preserve it when investigating an interrupted request; do not advance to an ID inferred from console output or sparse IDs. Counts after an uncertain request may undercount server work.

## Keep Windows running overnight

Keep Alfred's PC awake and plugged in, with PowerShell running. Closing ChatGPT or the browser is fine. Closing PowerShell, signing out of Windows, sleeping, restarting or shutting down stops a local run. This script does not change Windows power settings. Check the sleep setting yourself before starting, and do not run concurrent operators.

## Offline verification

From the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\test\quick-read-backfill.tests.ps1
```

The tests dot-source the runner and inject fake responses and waits. They require no network, no real admin token, no external test dependencies, and make no production request. They cover caps, cursor handling, isolated validation failures, partial gate responses, retry exhaustion, HTTP errors, malformed responses, large numeric IDs, configuration checks, and secret-free JSON reports. Test reports also stay in TEMP.

No production backfill was run while preparing this change.

