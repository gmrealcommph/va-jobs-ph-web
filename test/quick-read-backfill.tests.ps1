#requires -Version 5.1
# Offline, dependency-free regression tests. No network or real token required.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../scripts/quick-read-backfill.ps1')
$previousToken = $env:QUICK_READ_ADMIN_TOKEN
$env:QUICK_READ_ADMIN_TOKEN = 'offline-fixture-token-000000000000000000'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('quick-read-tests-' + [Guid]::NewGuid().ToString('N'))
$script:passed = 0
function Assert($condition, $message) { if (-not $condition) { throw $message } }
function Job($id,$status='ready',$error='') { return @{ job_id=[string]$id; status=$status; error=$error } }
function Response($jobs,$cursor) { return @{ HttpStatus=200; Data=@{ results=@($jobs); next_after_id=[string]$cursor } } }
function Run($responses,$max=5,$retries=3,[switch]$overnight,$ceiling=10000) {
    $state = @{ index=0; calls=@(); sleeps=@(); responses=@($responses) }
    $request = {
        param($cursor,$limit)
        $state.calls += @{ cursor=$cursor; limit=$limit }
        if ($state.index -ge $state.responses.Count) { throw 'Fixture exhausted' }
        $value = $state.responses[$state.index]; $state.index++; return $value
    }.GetNewClosure()
    $sleep = { param($seconds) $state.sleeps += $seconds }.GetNewClosure()
    $arguments = @{AfterId='444'; MaxRetries=$retries; ReportDirectory=$testRoot; Request=$request; Sleep=$sleep}
    if ($overnight) { $arguments.UntilExhausted=$true; $arguments.EmergencyMaxJobs=$ceiling }
    else { $arguments.MaxJobs=$max }
    $result = Invoke-QuickReadBackfill @arguments
    return @{ result=$result; state=$state }
}
function Case($name,[scriptblock]$test) {
    & $test
    $script:passed++
    Write-Host ('PASS: ' + $name)
}
try {
    Case 'ten batches, max 50, cursor from server and no 436' {
        $responses = @()
        for ($batch=0; $batch -lt 10; $batch++) {
            $jobs=@(); for ($j=1; $j -le 5; $j++) { $jobs += Job (444+$batch*5+$j) }
            $responses += Response $jobs (449+$batch*5)
        }
        $r=Run $responses 50
        Assert ($r.result.completed_normally -and $r.result.attempted -eq 50 -and $r.result.ready -eq 50) 'Expected 50 ready'
        Assert ($r.state.calls.Count -eq 10 -and $r.state.sleeps.Count -eq 9) 'Wrong calls/waits'
        Assert ($r.result.final_cursor -eq '494') 'Wrong final cursor'
        Assert (@($r.state.calls | Where-Object { $_.limit -ne 5 -or [decimal]$_.cursor -lt 444 }).Count -eq 0) 'Unsafe call'
    }
    Case 'validation failure recorded once and next batch continues' {
        $a=@((Job 445),(Job 446 'failed' 'invalid_source_reference'),(Job 447),(Job 448),(Job 449))
        $b=@((Job 450),(Job 451),(Job 452),(Job 453),(Job 454))
        $r=Run @((Response $a 449),(Response $b 454)) 10
        Assert ($r.result.failed -eq 1 -and $r.result.ready -eq 9 -and $r.result.failed_by_error.invalid_source_reference -eq 1) 'Wrong failures'
        Assert ($r.state.calls[1].cursor -eq '449') 'Failed job retried'
    }
    Case 'partial busy retains candidate, respects remaining cap' {
        $r=Run @((Response @((Job 445),(Job 446 'busy')) 445),(Response @((Job 446),(Job 447),(Job 448),(Job 449)) 449))
        Assert ($r.state.calls[1].cursor -eq '445' -and $r.state.calls[1].limit -eq 4) 'Skipped busy or exceeded cap'
        Assert ($r.result.attempted -eq 5 -and $r.result.ready -eq 5) 'Busy counted as attempted'
    }
    Case 'rate gate without progress retries same cursor with bound' {
        $busy=Response @((Job 445 'rate_limited')) 444
        $r=Run @($busy,$busy,$busy,$busy)
        Assert ($r.state.calls.Count -eq 4 -and -not $r.result.completed_normally -and $r.result.final_cursor -eq '444') 'Unbounded gate retries'
        Assert ($r.result.attempted -eq 0 -and $r.state.sleeps.Count -eq 3) 'Wrong retry counting'
    }
    Case 'HTTP 429 respects Retry-After without advancing' {
        $r=Run @(@{HttpStatus=429;RetryAfter='120'},(Response @((Job 445),(Job 446),(Job 447),(Job 448),(Job 449)) 449))
        Assert ($r.state.sleeps[0] -eq 120 -and $r.state.calls[1].cursor -eq '444') 'Wrong HTTP retry'
    }
    Case 'HTTP 429 retry bound and unreasonable Retry-After' {
        $r=Run @(@{HttpStatus=429},@{HttpStatus=429},@{HttpStatus=429},@{HttpStatus=429})
        Assert ($r.state.calls.Count -eq 4 -and $r.result.reason -eq 'busy_or_rate_limit_retry_exhausted') 'HTTP retry unbounded'
        foreach ($value in @('garbage','901')) {
            $r=Run @(@{HttpStatus=429;RetryAfter=$value})
            Assert ($r.state.calls.Count -eq 1 -and -not $r.result.completed_normally) 'Bad retry-after continued'
        }
    }
    Case 'auth and nontransient errors stop without retries' {
        foreach ($status in @(401,403,500,502,503,504,0,302)) {
            $r=Run @(@{HttpStatus=$status})
            Assert ($r.state.calls.Count -eq 1 -and $r.result.final_cursor -eq '444' -and -not $r.result.completed_normally) 'Unsafe retry'
        }
    }
    Case 'overnight sparse IDs and validation failure continue until explicit empty batch' {
        $r=Run @((Response @((Job 5438 'failed' 'unsupported_requirement')) 5438),(Response @((Job 9001)) 9001),(Response @() 9001)) -overnight
        Assert ($r.result.completed_normally -and $r.result.reason -eq 'no_more_candidates' -and $r.result.failed -eq 1 -and $r.result.attempted -eq 2) 'Incorrect exhaustion'
        Assert ($r.state.calls.Count -eq 3 -and $r.state.calls[2].cursor -eq '9001' -and $r.state.sleeps.Count -eq 2) 'Did not continue safely'
        Assert (@($r.state.calls | Where-Object {$_.limit -ne 5}).Count -eq 0) 'Overnight batch size changed'
    }
    Case 'overnight busy retries then exhausts' {
        $r=Run @((Response @((Job 445 'busy')) 444),(Response @((Job 445)) 445),(Response @() 445)) -overnight
        Assert ($r.result.completed_normally -and $r.result.attempted -eq 1 -and $r.state.calls[1].cursor -eq '444' -and $r.state.sleeps[0] -eq 30) 'Busy mishandled'
    }
    Case 'confirmed pre-send network errors retry with finite backoff' {
        foreach ($status in @(0)) {
            $r=Run @(@{HttpStatus=$status;RetrySafe=$true},(Response @((Job 445)) 445),(Response @() 445)) -overnight
            Assert ($r.result.completed_normally -and $r.state.calls[1].cursor -eq '444' -and $r.state.sleeps[0] -eq 30) 'Transport retry skipped cursor'
            $r=Run @(@{HttpStatus=$status;RetrySafe=$true},@{HttpStatus=$status;RetrySafe=$true},@{HttpStatus=$status;RetrySafe=$true},@{HttpStatus=$status;RetrySafe=$true}) -overnight
            Assert (-not $r.result.completed_normally -and $r.state.calls.Count -eq 4 -and $r.state.sleeps.Count -eq 3) 'Persistent failure not bounded'
        }
    }
    Case 'overnight cursor stall and malformed response fail closed' {
        foreach ($response in @((Response @((Job 445)) 444),@{HttpStatus=200;Data=$null},@{},(Response @() 445))) {
            $r=Run @($response) -overnight
            Assert (-not $r.result.completed_normally -and $r.result.final_cursor -eq '444' -and $r.state.calls.Count -eq 1) 'Unsafe response trusted'
        }
    }
    Case 'overnight emergency ceiling stops without claiming exhaustion' {
        $r=Run @((Response @((Job 445),(Job 446),(Job 447),(Job 448),(Job 449)) 449)) -overnight -ceiling 5
        Assert (-not $r.result.completed_normally -and $r.result.reason -eq 'emergency_job_ceiling_reached' -and $r.result.final_cursor -eq '449' -and $r.state.calls.Count -eq 1) 'Emergency ceiling not enforced'
    }
    Case 'checkpoint exists before wait and interrupted run resumes from confirmed cursor' {
        $directory=Join-Path $testRoot 'interrupted'
        $request={param($cursor,$limit) Response @((Job 445 'failed' 'mixed_obligation')) 445}
        $sleep={param($seconds)
            $file=Get-ChildItem -LiteralPath $directory -Filter '*.json' | Select-Object -First 1
            $saved=Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
            Assert ($saved.final_cursor -eq '445' -and $saved.failed -eq 1 -and $null -eq $saved.finished_at) 'Missing live checkpoint'
            throw 'Simulated interruption'
        }.GetNewClosure()
        $r=Invoke-QuickReadBackfill -AfterId 444 -UntilExhausted -ReportDirectory $directory -Request $request -Sleep $sleep
        Assert (-not $r.completed_normally -and $r.final_cursor -eq '445') 'Interruption lost cursor'
        $state=@{cursor=$null}
        $resume={param($cursor,$limit) $state.cursor=$cursor; Response @() $cursor}.GetNewClosure()
        $r=Invoke-QuickReadBackfill -AfterId $r.final_cursor -UntilExhausted -ReportDirectory $directory -Request $resume -Sleep {param($s)}
        Assert ($r.completed_normally -and $state.cursor -eq '445') 'Resume skipped cursor'
    }
    Case 'overnight rejects ambiguous caps' {
        $threw=$false
        try { Invoke-QuickReadBackfill -AfterId 444 -UntilExhausted -MaxJobs 50 -Request {throw 'must not request'} | Out-Null } catch {$threw=$true}
        Assert $threw 'Ambiguous mode accepted'
    }
    Case 'empty inventory completes only with unchanged cursor' {
        $r=Run @((Response @() 444))
        Assert ($r.result.completed_normally -and $r.result.attempted -eq 0) 'Empty response not complete'
        $r=Run @((Response @() 445))
        Assert (-not $r.result.completed_normally) 'Empty advanced cursor accepted'
    }
    Case 'malformed responses fail closed before counting or advancing' {
        $bad=@(
            @{HttpStatus=200;Data=$null},
            @{HttpStatus=200;Data=@{results=@();error='unexpected';next_after_id='444'}},
            @{HttpStatus=200;Data=@{results=(Job 445);next_after_id='445'}},
            (Response @((Job 445)) 444),
            (Response @((Job 445),(Job 445)) 445),
            (Response @((Job 443)) 443),
            (Response @((Job 445 'mystery')) 445),
            (Response @((Job 445 'failed' $env:QUICK_READ_ADMIN_TOKEN)) 445),
            (Response @((Job 445 'busy'),(Job 446)) 446),
            (Response @((Job 445 'busy')) 445),
            (Response @((Job 445),(Job 446),(Job 447),(Job 448),(Job 449),(Job 450)) 450)
        )
        foreach ($response in $bad) {
            $r=Run @($response)
            Assert (-not $r.result.completed_normally -and $r.result.attempted -eq 0 -and $r.result.final_cursor -eq '444') 'Malformed response trusted'
        }
    }
    Case 'per-job infrastructure failure records checkpoint then stops' {
        $r=Run @((Response @((Job 445 'failed' 'provider_http_503'),(Job 446 'busy')) 445))
        Assert ($r.result.final_cursor -eq '445' -and $r.result.failed -eq 1 -and $r.state.calls.Count -eq 1 -and -not $r.result.completed_normally) 'Infrastructure continued'
    }
    Case 'other endpoint statuses counted separately' {
        $r=Run @((Response @((Job 445 'unchanged'),(Job 446 'retry_later'),(Job 447 'ineligible'),(Job 448),(Job 449)) 449))
        Assert ($r.result.other -eq 3 -and $r.result.attempted -eq 5 -and $r.result.ready -eq 2) 'Wrong status counts'
    }
    Case 'unknown request failure does not retry' {
        $r=Run @()
        Assert ($r.result.reason -eq 'request_failed_unknown_outcome' -and $r.state.calls.Count -eq 1) 'Unknown failure retried'
    }
    Case 'numeric IDs above floating point precision remain exact' {
        $state=@{calls=0}
        $request={param($cursor,$limit) $state.calls++; Response @((Job '9007199254740994')) '9007199254740994'}.GetNewClosure()
        $r=Invoke-QuickReadBackfill -AfterId '9007199254740993' -ReportDirectory $testRoot -Request $request -Sleep {param($s)}
        Assert ($r.final_cursor -eq '9007199254740994' -and $r.attempted -eq 1) 'Precision lost'
    }
    Case 'bad config and missing token fail before requests' {
        foreach ($params in @(@{AfterId='';MaxJobs=50},@{AfterId='444';MaxJobs=6},@{AfterId='444';MaxJobs=505},@{AfterId='-1';MaxJobs=50})) {
            $threw=$false
            try { Invoke-QuickReadBackfill @params -Request {throw 'must not request'} | Out-Null } catch { $threw=$true }
            Assert $threw 'Bad configuration accepted'
        }
        $env:QUICK_READ_ADMIN_TOKEN=''
        $threw=$false
        try { Invoke-QuickReadBackfill -AfterId 444 -Request {throw 'must not request'} | Out-Null } catch { $threw=$true }
        Assert $threw 'Missing token accepted'
        $env:QUICK_READ_ADMIN_TOKEN='offline-fixture-token-000000000000000000'
    }
    Case 'reports contain no token and valid JSON checkpoints' {
        foreach ($file in Get-ChildItem -LiteralPath $testRoot -Filter '*.json') {
            $text=Get-Content -LiteralPath $file.FullName -Raw
            Assert (-not $text.Contains($env:QUICK_READ_ADMIN_TOKEN)) 'Token leaked'
            $data=$text | ConvertFrom-Json
            Assert ($null -ne $data.finished_at -and $null -ne $data.final_cursor) 'Report incomplete'
        }
    }
    Case 'report failure prevents any request' {
        $occupied=Join-Path $testRoot 'occupied-file'
        Set-Content -LiteralPath $occupied -Value 'fixture'
        $state=@{calls=0}
        $request={param($cursor,$limit) $state.calls++; throw 'must not request'}.GetNewClosure()
        $r=Invoke-QuickReadBackfill -AfterId 444 -ReportDirectory (Join-Path $occupied 'child') -Request $request -Sleep {param($s)}
        Assert ($state.calls -eq 0 -and -not $r.completed_normally) 'Requested without a writable report'
    }
    Case 'HTTP adapter fixes origin, disables redirects, uses JSON and hides errors' {
        function Invoke-WebRequest {
            param($Uri,$Method,$Headers,$ContentType,$Body,$MaximumRedirection,$TimeoutSec,[switch]$UseBasicParsing,$ErrorAction,$Verbose,$Debug)
            Assert ($Uri -eq 'https://veeays.com/internal/quick-read/batch' -and $Method -eq 'Post') 'Wrong endpoint'
            Assert ($MaximumRedirection -eq 0 -and $TimeoutSec -eq 600) 'Unsafe transport settings'
            Assert ($Headers.Authorization -ceq ('Bearer '+$env:QUICK_READ_ADMIN_TOKEN)) 'Missing bearer'
            $json=$Body | ConvertFrom-Json
            Assert ($json.limit -eq 5 -and $json.after_id -eq '444' -and $ContentType -eq 'application/json') 'Wrong request'
            return @{StatusCode=200;Content='{"results":[],"next_after_id":"444"}'}
        }
        $r=Invoke-QuickReadHttp 444 5
        Assert ($r.HttpStatus -eq 200 -and $r.Data.next_after_id -eq '444') 'Adapter not parsed'
        function Invoke-WebRequest { throw ('secret-echo-'+$env:QUICK_READ_ADMIN_TOKEN) }
        $r=Invoke-QuickReadHttp 444 5
        Assert ($r.HttpStatus -eq 0 -and $null -eq $r.Data) 'Exception leaked or retried'
    }
    Write-Host ('All {0} offline tests passed on PowerShell {1}.' -f $script:passed,$PSVersionTable.PSVersion)
} finally {
    $env:QUICK_READ_ADMIN_TOKEN=$previousToken
    # Test artifacts remain in TEMP, outside the repository.
}


