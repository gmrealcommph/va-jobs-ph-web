#requires -Version 5.1
<#
.SYNOPSIS
Bounded operator-only Quick Read backfill with global recovery checks. Each unchanged failure is attempted at most once per run.
.EXAMPLE
.\scripts\quick-read-backfill.ps1 -AfterId 444 -MaxJobs 50
Uses QUICK_READ_ADMIN_TOKEN from this process environment. Reports go to TEMP.
.EXAMPLE
Get-Help .\scripts\quick-read-backfill.ps1 -Full
#>
[CmdletBinding()]
param(
    [string]$AfterId,
    [ValidateRange(5,500)][int]$MaxJobs = 50,
    [switch]$UntilExhausted,
    [ValidateRange(5,100000)][int]$EmergencyMaxJobs = 10000,
    [ValidateRange(1,720)][int]$MaxRunMinutes = 180,
    [ValidateRange(2,100)][int]$MaxSweeps = 5,
    [ValidateRange(10,300)][int]$WaitSeconds = 15,
    [ValidateRange(1,10)][int]$MaxRetries = 3,
    [string]$ReportDirectory = (Join-Path ([IO.Path]::GetTempPath()) 'VeeAys-QuickRead')
)

function Invoke-QuickReadHttp {
    param([string]$Cursor, [int]$Limit, [string]$RunStartedAt, [string]$Mode)
    # Fixed origin, no redirects and no raw HTTP/exception output (may contain secrets).
    $headers = @{ Authorization = 'Bearer ' + $env:QUICK_READ_ADMIN_TOKEN }
    $bodyArgs = @{ limit = $Limit; after_id = $Cursor }
    if ($Mode -eq 'recovery') { $bodyArgs = @{ mode = 'recovery' } }
    if ($RunStartedAt) { $bodyArgs.run_started_at = $RunStartedAt }
    $body = $bodyArgs | ConvertTo-Json -Compress
    $oldProtocol = [Net.ServicePointManager]::SecurityProtocol
    try {
        [Net.ServicePointManager]::SecurityProtocol = $oldProtocol -bor [Net.SecurityProtocolType]::Tls12
        $response = Invoke-WebRequest -UseBasicParsing -Uri 'https://veeays.com/internal/quick-read/batch' `
            -Method Post -Headers $headers -ContentType 'application/json' -Body $body `
            -MaximumRedirection 0 -TimeoutSec 600 -ErrorAction Stop -Verbose:$false -Debug:$false
        try { $data = $response.Content | ConvertFrom-Json -ErrorAction Stop }
        catch { return @{ HttpStatus = 200; Data = $null; RetryAfter = $null } }
        return @{ HttpStatus = [int]$response.StatusCode; Data = $data; RetryAfter = $null }
    } catch {
        $http = $_.Exception.Response
        if ($null -eq $http) {
            # Only failures known to precede sending the request can be replayed.
            $safe = $_.Exception -is [Net.WebException] -and
                $_.Exception.Status -in @([Net.WebExceptionStatus]::NameResolutionFailure,[Net.WebExceptionStatus]::ProxyNameResolutionFailure)
            return @{ HttpStatus = 0; Data = $null; RetryAfter = $null; RetrySafe = $safe }
        }
        $retryAfter = $null
        if ([int]$http.StatusCode -eq 429) { $retryAfter = $http.Headers['Retry-After'] }
        return @{ HttpStatus = [int]$http.StatusCode; Data = $null; RetryAfter = $retryAfter }
    } finally {
        [Net.ServicePointManager]::SecurityProtocol = $oldProtocol
        $headers.Clear()
    }
}

function Invoke-QuickReadBackfill {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$AfterId,
        [ValidateRange(5,500)][int]$MaxJobs = 50,
        [switch]$UntilExhausted,
        [ValidateRange(5,100000)][int]$EmergencyMaxJobs = 10000,
        [ValidateRange(1,720)][int]$MaxRunMinutes = 180,
        [ValidateRange(2,100)][int]$MaxSweeps = 5,
        [ValidateRange(10,300)][int]$WaitSeconds = 15,
        [ValidateRange(1,10)][int]$MaxRetries = 3,
        [string]$ReportDirectory = (Join-Path ([IO.Path]::GetTempPath()) 'VeeAys-QuickRead'),
        # Injection seams for offline tests; the command-line entry point never exposes these.
        [scriptblock]$Request = { param($cursor,$limit,$started,$mode) Invoke-QuickReadHttp $cursor $limit $started $mode },
        [scriptblock]$Sleep = { param($seconds) Start-Sleep -Seconds $seconds },
        [scriptblock]$Now = { [DateTimeOffset]::UtcNow }
    )
    $ErrorActionPreference = 'Stop'
    if ($AfterId -cnotmatch '^(0|[1-9][0-9]{0,18})$') { throw 'Supply an explicit numeric -AfterId (for example 444).' }
    if ($MaxJobs % 5 -ne 0) { throw 'MaxJobs must be a multiple of 5, between 5 and 500.' }
    if ($UntilExhausted -and $PSBoundParameters.ContainsKey('MaxJobs')) { throw 'Use either -UntilExhausted or -MaxJobs, not both.' }
    if ($EmergencyMaxJobs % 5 -ne 0) { throw 'EmergencyMaxJobs must be a multiple of 5.' }
    $jobCeiling = $MaxJobs
    if ($UntilExhausted) { $jobCeiling = $EmergencyMaxJobs }
    # Even a server returning one result per response cannot exceed this request bound.
    $requestCeiling = ($jobCeiling + $MaxSweeps + $MaxRunMinutes * 6 + 1) * ($MaxRetries + 1)
    $started = & $Now
    $runStartedAt = $started.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
    if ([string]::IsNullOrWhiteSpace($env:QUICK_READ_ADMIN_TOKEN) -or
        $env:QUICK_READ_ADMIN_TOKEN.Length -lt 32 -or $env:QUICK_READ_ADMIN_TOKEN.Length -gt 512 -or
        $env:QUICK_READ_ADMIN_TOKEN -match '[\r\n]') { throw 'Set a valid QUICK_READ_ADMIN_TOKEN in the process environment.' }
    $report = [ordered]@{
        started_at = $runStartedAt; finished_at = $null
        starting_cursor = $AfterId; final_cursor = $AfterId; max_jobs = $MaxJobs
        until_exhausted = [bool]$UntilExhausted; emergency_max_jobs = $EmergencyMaxJobs
        request_ceiling = $requestCeiling; max_run_minutes = $MaxRunMinutes; max_sweeps = $MaxSweeps
        sweeps = 1; recovery_state = $null; highest_cursor = $AfterId
        attempted = 0; ready = 0; failed = 0; other = 0; failed_by_error = @{}
        completed_normally = $false; reason = 'interrupted'; batches = @()
    }
    $path = $null
    $cursor = $AfterId
    $retryCount = 0
    $batchNumber = 0
    $remainingLimit = 5
    $checkingRecovery = $false
    try {
        # Verify the report destination before making any request.
        New-Item -ItemType Directory -Path $ReportDirectory -Force | Out-Null
        $path = Join-Path $ReportDirectory ('quick-read-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N') + '.json')
        $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $path -Encoding UTF8
        Write-Host ('Progress report: ' + $path)
        while ($report.attempted -lt $jobCeiling) {
            if ((& $Now) -ge $started.AddMinutes($MaxRunMinutes)) { $report.reason = 'recovery_time_limit_reached'; break }
            if ($batchNumber -ge $requestCeiling) { $report.reason = 'emergency_request_ceiling_reached'; break }
            $batchNumber++
            $start = $cursor
            Write-Host ('Batch {0}: cursor {1}, limit {2}' -f $batchNumber,$start,$remainingLimit)
            try {
                $mode = ''; $cutoff = ''
                if ($UntilExhausted) { $cutoff = $runStartedAt }
                if ($checkingRecovery) { $mode = 'recovery' }
                $envelope = & $Request $cursor $remainingLimit $cutoff $mode
            }
            catch { $report.reason = 'request_failed_unknown_outcome'; break }
            $delay = $WaitSeconds
            $blocked = $false
            if ($null -eq $envelope -or $null -eq $envelope.HttpStatus -or
                [string]$envelope.HttpStatus -notmatch '^(0|[1-5][0-9]{2})$') { $report.reason = 'malformed_response'; break }
            if ($envelope.HttpStatus -eq 429 -or ($envelope.HttpStatus -eq 0 -and $envelope.RetrySafe -eq $true)) {
                $blocked = $true
                if ($envelope.HttpStatus -eq 429 -and $null -ne $envelope.RetryAfter) {
                    $seconds = 0
                    $date = [DateTimeOffset]::MinValue
                    if ([int]::TryParse([string]$envelope.RetryAfter, [ref]$seconds) -and $seconds -ge 0) {
                        $delay = [Math]::Max($delay,$seconds)
                    } elseif ([DateTimeOffset]::TryParse([string]$envelope.RetryAfter,[ref]$date)) {
                        $delay = [Math]::Max($delay,[int][Math]::Ceiling(($date - [DateTimeOffset]::UtcNow).TotalSeconds))
                    } else { $report.reason = 'invalid_retry_after'; break }
                    if ($delay -gt 900) { $report.reason = 'retry_after_exceeds_safe_wait'; break }
                }
                $report.batches += [ordered]@{ number=$batchNumber; starting_cursor=$start; ending_cursor=$cursor; http_status=[int]$envelope.HttpStatus; results=@(); outcome_uncertain=($envelope.HttpStatus -ne 429) }
            } elseif ($envelope.HttpStatus -ne 200) {
                if ($envelope.HttpStatus -in @(401,403)) { $report.reason = 'authentication_or_authorization_error' }
                elseif ($envelope.HttpStatus -eq 0) { $report.reason = 'network_error_unknown_outcome' }
                else { $report.reason = 'http_error_' + [int]$envelope.HttpStatus }
                break
            } else {
                $data = $envelope.Data
                if ($checkingRecovery) {
                    $state = $data.recovery
                    $invalidState = $null -eq $state -or $null -ne $data.error -or $state.protocol_version -ne 1
                    foreach ($field in @('eligible','ready','missing','candidates','terminal','attempted_failed','deferred')) {
                        if ([string]$state.$field -cnotmatch '^(0|[1-9][0-9]{0,8})$') { $invalidState=$true }
                    }
                    if ($invalidState -or [long]$state.eligible -ne ([long]$state.ready+[long]$state.missing) -or
                        [long]$state.missing -ne ([long]$state.candidates+[long]$state.terminal+[long]$state.attempted_failed+[long]$state.deferred)) {
                        $report.reason='invalid_recovery_state'; break
                    }
                    $next=[DateTimeOffset]::MinValue
                    if ([long]$state.deferred -gt 0 -and (-not [DateTimeOffset]::TryParse([string]$state.next_check_at,[ref]$next) -or $next -le (& $Now))) {
                        $report.reason='invalid_recovery_state'; break
                    }
                    # Retain only numeric counters and validated timestamps.
                    $report.recovery_state=[ordered]@{}
                    foreach ($field in @('eligible','ready','missing','candidates','terminal','attempted_failed','deferred')) { $report.recovery_state[$field]=[long]$state.$field }
                    $report.recovery_state.next_check_at=$null
                    if ([long]$state.deferred -gt 0) { $report.recovery_state.next_check_at=$next.UtcDateTime.ToString('o') }
                    if ([long]$state.missing -eq 0) { $report.completed_normally=$true; $report.reason='coverage_complete_at_check'; break }
                    if ([long]$state.candidates -gt 0) {
                        if ($report.sweeps -ge $MaxSweeps) { $report.reason='recovery_sweep_limit_reached'; break }
                        $report.sweeps++; $cursor='0'; $report.final_cursor=$cursor; $checkingRecovery=$false
                        Write-Host ('  Recovery sweep {0}: lower-ID/new candidates remain; restarting at 0.' -f $report.sweeps)
                    } elseif ([long]$state.deferred -gt 0) {
                        # Poll without generation while leases/cooldowns mature. Do
                        # not spend the sweep budget on waiting; the clock/request
                        # bounds still apply. Never retry this run's failures.
                        $delay=[Math]::Min(60,[Math]::Max(1,[Math]::Ceiling(($next-(& $Now)).TotalSeconds)))
                    } else { $report.reason='coverage_incomplete_requires_action'; break }
                    $retryCount=0
                    $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath ($path + '.tmp') -Encoding UTF8
                    [IO.File]::Replace(($path + '.tmp'),$path,($path + '.previous'))
                    & $Sleep $delay
                    continue
                }
                # Validate the entire response before trusting any cursor or printing fields.
                if ($null -eq $data -or $null -ne $data.error -or
                    $data.results -isnot [System.Array] -or
                    [string]$data.next_after_id -cnotmatch '^(0|[1-9][0-9]{0,18})$' -or
                    $data.results.Count -gt $remainingLimit) { $report.reason = 'malformed_response'; break }
                $last = $cursor
                $validated = @()
                $fatal = $false
                $invalid = $false
                foreach ($job in $data.results) {
                    $id = [string]$job.job_id
                    $status = [string]$job.status
                    $code = [string]$job.error
                    if ($blocked -or $id -cnotmatch '^[1-9][0-9]{0,18}$' -or
                        [decimal]$id -le [decimal]$last -or
                        $status -cnotin @('ready','failed','unchanged','retry_later','ineligible','invalid','claim_expired','source_changed','unsupported','busy','rate_limited') -or
                        ($status -ne 'failed' -and $code.Length -gt 0)) { $invalid = $true; break }
                    if ($status -eq 'failed' -and $code -cnotmatch '^(unsupported_source|unsafe_source|source_hash_mismatch|invalid_generated_output|invalid_schema|invalid_source_reference|unsupported_requirement|preference_upgraded|mixed_obligation|application_condition_misplaced|material_condition_misplaced|source_omitted|generation_failed|provider_(not_configured|http_[0-9]{3}|incomplete|refusal|invalid_output|invalid_json))$') {
                        $invalid = $true; break
                    }
                    $validated += [ordered]@{ job_id=$id; status=$status; error=$code }
                    if ($status -in @('busy','rate_limited')) { $blocked = $true }
                    else {
                        $last = $id
                        if ($status -in @('invalid','claim_expired','source_changed') -or
                            $code -match '^(generation_failed|provider_not_configured|provider_http_[0-9]{3})$') { $fatal = $true }
                    }
                }
                if ($invalid -or [string]$data.next_after_id -cne $last -or
                    ($data.results.Count -gt 0 -and $last -eq $cursor -and -not $blocked)) {
                    $report.reason = 'invalid_or_stalled_cursor_response'; break
                }
                if ($data.results.Count -eq 0) {
                    if ($UntilExhausted) { $checkingRecovery=$true; continue }
                    $report.completed_normally = $true; $report.reason = 'cursor_sweep_complete'; break
                }
                foreach ($job in $validated) {
                    Write-Host ('  Job {0}: {1} {2}' -f $job.job_id,$job.status,$job.error)
                    if ($job.status -in @('busy','rate_limited')) { continue }
                    $report.attempted++
                    if ($job.status -eq 'ready') { $report.ready++ }
                    elseif ($job.status -eq 'failed') {
                        $report.failed++
                        $report.failed_by_error[$job.error] = 1 + [int]$report.failed_by_error[$job.error]
                    } else { $report.other++ }
                }
                $cursor = [string]$data.next_after_id
                $report.final_cursor = $cursor
                if ([decimal]$cursor -gt [decimal]$report.highest_cursor) { $report.highest_cursor=$cursor }
                $report.batches += [ordered]@{ number=$batchNumber; starting_cursor=$start; ending_cursor=$cursor; http_status=200; results=$validated }
                # Persist every confirmed batch, including fatal results and the ceiling batch.
                $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath ($path + '.tmp') -Encoding UTF8
                [IO.File]::Replace(($path + '.tmp'),$path,($path + '.previous'))
                Write-Host ('  Ending cursor {0}; attempted {1}, ready {2}, failed {3}' -f $cursor,$report.attempted,$report.ready,$report.failed)
                if ($fatal) { $report.reason = 'job_infrastructure_or_state_error'; break }
            }
            if ($report.attempted -ge $jobCeiling) {
                if ($UntilExhausted) { $report.reason = 'emergency_job_ceiling_reached' }
                else { $report.completed_normally = $true; $report.reason = 'max_jobs_reached' }
                break
            }
            # A partial batch consumes only completed candidates. Never exceed the cap.
            $remainingLimit = [Math]::Min(5,$jobCeiling - $report.attempted)
            if ($blocked) {
                $retryCount++
                if ($retryCount -gt $MaxRetries) { $report.reason = 'busy_or_rate_limit_retry_exhausted'; break }
                $delay = [Math]::Max($delay,[Math]::Min(300,30 * [Math]::Pow(2,$retryCount - 1)))
                Write-Host ('  Transient busy/rate-limit/transport condition: retry {0}/{1} from confirmed cursor {2} after {3}s.' -f $retryCount,$MaxRetries,$cursor,$delay)
            } else { $retryCount = 0 }
            $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath ($path + '.tmp') -Encoding UTF8
            [IO.File]::Replace(($path + '.tmp'),$path,($path + '.previous'))
            & $Sleep $delay
        }
    } catch {
        # Do not expose exception bodies, request headers, or untrusted server text.
        $report.reason = 'local_error_or_report_write_failed'
        $report.completed_normally = $false
    } finally {
        $report.finished_at = (& $Now).UtcDateTime.ToString('o')
        if ($null -ne $path) {
            try {
                $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath ($path + '.tmp') -Encoding UTF8
                [IO.File]::Replace(($path + '.tmp'),$path,($path + '.previous'))
            }
            catch { Write-Host 'Could not save report; use the summary cursor below.'; $report.completed_normally=$false; $report.reason='report_write_failed' }
        }
        Write-Host ('Summary: {0} -> {1}; attempted {2}, ready {3}, failed {4}, other {5}; {6}' -f $AfterId,$report.final_cursor,$report.attempted,$report.ready,$report.failed,$report.other,$report.reason)
        foreach ($code in @($report.failed_by_error.Keys | Sort-Object)) { Write-Host ('  {0}: {1}' -f $code,$report.failed_by_error[$code]) }
        Write-Host ('Completed normally: ' + $report.completed_normally)
        if ($null -ne $path) { Write-Host ('Report: ' + $path) }
    }
    return [pscustomobject]$report
}

if ($MyInvocation.InvocationName -ne '.') {
    if ([string]::IsNullOrWhiteSpace($AfterId)) { throw 'Required: -AfterId. Overnight production run: -AfterId 5438 -UntilExhausted.' }
    $arguments = @{ AfterId=$AfterId; UntilExhausted=$UntilExhausted; EmergencyMaxJobs=$EmergencyMaxJobs; WaitSeconds=$WaitSeconds; MaxRetries=$MaxRetries; MaxRunMinutes=$MaxRunMinutes; MaxSweeps=$MaxSweeps; ReportDirectory=$ReportDirectory }
    if ($PSBoundParameters.ContainsKey('MaxJobs') -or -not $UntilExhausted) { $arguments.MaxJobs=$MaxJobs }
    $result = Invoke-QuickReadBackfill @arguments
    if (-not $result.completed_normally) { exit 1 }
}

