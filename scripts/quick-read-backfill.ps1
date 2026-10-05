#requires -Version 5.1
<#
.SYNOPSIS
Bounded operator-only Quick Read backfill. Never retries completed failed jobs.
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
    [ValidateRange(10,300)][int]$WaitSeconds = 15,
    [ValidateRange(1,10)][int]$MaxRetries = 3,
    [string]$ReportDirectory = (Join-Path ([IO.Path]::GetTempPath()) 'VeeAys-QuickRead')
)

function Invoke-QuickReadHttp {
    param([string]$Cursor, [int]$Limit)
    # Fixed origin, no redirects and no raw HTTP/exception output (may contain secrets).
    $headers = @{ Authorization = 'Bearer ' + $env:QUICK_READ_ADMIN_TOKEN }
    $body = @{ limit = $Limit; after_id = $Cursor } | ConvertTo-Json -Compress
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
        if ($null -eq $http) { return @{ HttpStatus = 0; Data = $null; RetryAfter = $null } }
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
        [ValidateRange(10,300)][int]$WaitSeconds = 15,
        [ValidateRange(1,10)][int]$MaxRetries = 3,
        [string]$ReportDirectory = (Join-Path ([IO.Path]::GetTempPath()) 'VeeAys-QuickRead'),
        # Injection seams for offline tests; the command-line entry point never exposes these.
        [scriptblock]$Request = { param($cursor,$limit) Invoke-QuickReadHttp $cursor $limit },
        [scriptblock]$Sleep = { param($seconds) Start-Sleep -Seconds $seconds }
    )
    $ErrorActionPreference = 'Stop'
    if ($AfterId -cnotmatch '^(0|[1-9][0-9]{0,18})$') { throw 'Supply an explicit numeric -AfterId (for example 444).' }
    if ($MaxJobs % 5 -ne 0) { throw 'MaxJobs must be a multiple of 5, between 5 and 500.' }
    if ([string]::IsNullOrWhiteSpace($env:QUICK_READ_ADMIN_TOKEN) -or
        $env:QUICK_READ_ADMIN_TOKEN.Length -lt 32 -or $env:QUICK_READ_ADMIN_TOKEN.Length -gt 512 -or
        $env:QUICK_READ_ADMIN_TOKEN -match '[\r\n]') { throw 'Set a valid QUICK_READ_ADMIN_TOKEN in the process environment.' }
    $report = [ordered]@{
        started_at = [DateTime]::UtcNow.ToString('o'); finished_at = $null
        starting_cursor = $AfterId; final_cursor = $AfterId; max_jobs = $MaxJobs
        attempted = 0; ready = 0; failed = 0; other = 0; failed_by_error = @{}
        completed_normally = $false; reason = 'interrupted'; batches = @()
    }
    $path = $null
    $cursor = $AfterId
    $retryCount = 0
    $batchNumber = 0
    $remainingLimit = 5
    try {
        # Verify the report destination before making any request.
        New-Item -ItemType Directory -Path $ReportDirectory -Force | Out-Null
        $path = Join-Path $ReportDirectory ('quick-read-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N') + '.json')
        $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $path -Encoding UTF8
        while ($report.attempted -lt $MaxJobs) {
            $batchNumber++
            $start = $cursor
            Write-Host ('Batch {0}: cursor {1}, limit {2}' -f $batchNumber,$start,$remainingLimit)
            try { $envelope = & $Request $cursor $remainingLimit }
            catch { $report.reason = 'request_failed_unknown_outcome'; break }
            $delay = $WaitSeconds
            $blocked = $false
            if ($envelope.HttpStatus -eq 429) {
                $blocked = $true
                if ($null -ne $envelope.RetryAfter) {
                    $seconds = 0
                    $date = [DateTimeOffset]::MinValue
                    if ([int]::TryParse([string]$envelope.RetryAfter, [ref]$seconds) -and $seconds -ge 0) {
                        $delay = [Math]::Max($delay,$seconds)
                    } elseif ([DateTimeOffset]::TryParse([string]$envelope.RetryAfter,[ref]$date)) {
                        $delay = [Math]::Max($delay,[int][Math]::Ceiling(($date - [DateTimeOffset]::UtcNow).TotalSeconds))
                    } else { $report.reason = 'invalid_retry_after'; break }
                    if ($delay -gt 900) { $report.reason = 'retry_after_exceeds_safe_wait'; break }
                }
                $report.batches += [ordered]@{ number=$batchNumber; starting_cursor=$start; ending_cursor=$cursor; http_status=429; results=@() }
            } elseif ($envelope.HttpStatus -ne 200) {
                if ($envelope.HttpStatus -in @(401,403)) { $report.reason = 'authentication_or_authorization_error' }
                elseif ($envelope.HttpStatus -eq 0) { $report.reason = 'network_error_unknown_outcome' }
                else { $report.reason = 'http_error_' + [int]$envelope.HttpStatus }
                break
            } else {
                $data = $envelope.Data
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
                        $status -cnotin @('ready','failed','unchanged','retry_later','ineligible','invalid','claim_expired','source_changed','busy','rate_limited') -or
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
                    $report.completed_normally = $true; $report.reason = 'no_more_candidates'; break
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
                $report.batches += [ordered]@{ number=$batchNumber; starting_cursor=$start; ending_cursor=$cursor; http_status=200; results=$validated }
                Write-Host ('  Ending cursor {0}; attempted {1}, ready {2}, failed {3}' -f $cursor,$report.attempted,$report.ready,$report.failed)
                if ($fatal) { $report.reason = 'job_infrastructure_or_state_error'; break }
            }
            if ($report.attempted -ge $MaxJobs) { $report.completed_normally = $true; $report.reason = 'max_jobs_reached'; break }
            # A partial batch consumes only completed candidates. Never exceed the cap.
            $remainingLimit = [Math]::Min(5,$MaxJobs - $report.attempted)
            if ($blocked) {
                $retryCount++
                if ($retryCount -gt $MaxRetries) { $report.reason = 'busy_or_rate_limit_retry_exhausted'; break }
                $delay = [Math]::Max($delay,[Math]::Min(300,30 * [Math]::Pow(2,$retryCount - 1)))
                Write-Host ('  Busy/rate limited: retry {0}/{1} from returned cursor {2} after {3}s.' -f $retryCount,$MaxRetries,$cursor,$delay)
            } else { $retryCount = 0 }
            $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $path -Encoding UTF8
            & $Sleep $delay
        }
    } catch {
        # Do not expose exception bodies, request headers, or untrusted server text.
        $report.reason = 'local_error_or_report_write_failed'
        $report.completed_normally = $false
    } finally {
        $report.finished_at = [DateTime]::UtcNow.ToString('o')
        if ($null -ne $path) {
            try { $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $path -Encoding UTF8 }
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
    if ([string]::IsNullOrWhiteSpace($AfterId)) { throw 'Required: -AfterId. First production run: -AfterId 444 -MaxJobs 50.' }
    $result = Invoke-QuickReadBackfill -AfterId $AfterId -MaxJobs $MaxJobs -WaitSeconds $WaitSeconds -MaxRetries $MaxRetries -ReportDirectory $ReportDirectory
    if (-not $result.completed_normally) { exit 1 }
}
