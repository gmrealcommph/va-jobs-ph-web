param(
  [Parameter(Mandatory = $true)][string]$SiteUrl,
  [Parameter(Mandatory = $true)][string]$ExpectedEmail,
  [string]$NotificationId = '165',
  [switch]$Send
)
$ErrorActionPreference = 'Stop'
$taskSite = [Uri]$SiteUrl
if ($taskSite.Scheme -ne 'https' -or $taskSite.UserInfo) { throw 'Use your production HTTPS site origin.' }
if ($NotificationId -notmatch '^[1-9]\d{0,18}$') { throw 'Invalid notification ID.' }
$taskEndpoint = $taskSite.GetLeftPart([UriPartial]::Authority) + '/internal/strong-match/' + $NotificationId
$taskSecureToken = Read-Host 'Enter MANUAL_NOTIFICATION_TOKEN (hidden; never your Supabase or Resend key)' -AsSecureString
$taskTokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecureToken)
try {
  $taskToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskTokenPointer)
  $taskHeaders = @{ Authorization = 'Bearer ' + $taskToken }
  $taskPreviewBody = @{ action = 'preview'; notification_id = $NotificationId; expected_email = $ExpectedEmail } | ConvertTo-Json
  $taskPreview = Invoke-RestMethod -Uri $taskEndpoint -Method Post -Headers $taskHeaders -ContentType 'application/json' -Body $taskPreviewBody
  $taskPreview | ConvertTo-Json -Depth 8
  if (-not $Send) { Write-Host 'Preview only. No email was sent. Run again with -Send for the controlled test.'; return }
  if ($taskPreview.status -notin @('ready', 'accepted_needs_acknowledgement')) { throw 'Notification is not ready for this operation.' }
  $taskRequiredConfirmation = 'SEND_' + $NotificationId
  $taskConfirmation = Read-Host ('Review the preview above. Type ' + $taskRequiredConfirmation + ' to continue; Enter cancels')
  if ($taskConfirmation -cne $taskRequiredConfirmation) { Write-Host 'Cancelled.'; return }
  $taskSendBody = @{ action = 'send'; notification_id = $NotificationId; expected_email = $ExpectedEmail; confirm = $taskConfirmation } | ConvertTo-Json
  $taskResult = Invoke-RestMethod -Uri $taskEndpoint -Method Post -Headers $taskHeaders -ContentType 'application/json' -Body $taskSendBody
  $taskResult | ConvertTo-Json -Depth 5
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskTokenPointer)
  $taskToken = $null
  $taskHeaders = $null
  $taskSecureToken.Dispose()
}
