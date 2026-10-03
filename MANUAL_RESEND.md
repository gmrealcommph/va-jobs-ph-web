# Deploy and test the manual Strong Match processor

Deployment and normal site visits send no email. There is no cron, scheduled handler, queue consumer, batch scan, or background processor. The only sending entry point is an authenticated POST to `/internal/strong-match/{notification_id}`.

## 1. Install the delivery ledger

In Supabase SQL Editor, run `migrations/001_manual_notification_delivery.sql` once. It adds one private table for frozen requests and Resend receipts. It does not change existing job, profile, preference or notification tables, or their RLS policies. This table stores recipient/email content; only server-side service-role access is granted.

## 2. Configure Cloudflare runtime

Keep the five existing bindings: `SITE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `RESEND_API_KEY` (Secret) and `SUPABASE_SERVICE_ROLE_KEY` (Secret).

Add these three bindings in the same Worker's Settings → Variables and Secrets:

| Type | Name | Value for the first test |
| --- | --- | --- |
| Secret | `MANUAL_NOTIFICATION_TOKEN` | A new random token with at least 32 characters |
| Variable | `MANUAL_STRONG_MATCH_IDS` | `165` |
| Variable | `STRONG_MATCH_TEST_EMAIL` | Your actual email address, which must be the confirmed Auth email of notification #165's recipient |

Generate the new token locally in PowerShell, copy it into Cloudflare and keep it in your password manager:

```powershell
$taskRandomBytes = New-Object byte[] 32
$taskRandomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$taskRandomGenerator.GetBytes($taskRandomBytes)
$taskRandomGenerator.Dispose()
[Convert]::ToBase64String($taskRandomBytes)
```

Do not put this token, the Resend key, or the Supabase server key in files, GitHub, screenshots, or chat. The helper asks for the manual token through a hidden prompt. It never asks for your Supabase or Resend keys. Removing `MANUAL_NOTIFICATION_TOKEN` or clearing `MANUAL_STRONG_MATCH_IDS` disables this endpoint without affecting the site.

## 3. Upload and deploy

Extract the ZIP and upload its contents to the **root of the existing frontend/Worker repository**, replacing the matching files. Include `.gitignore`, `src`, `public`, `test`, `scripts`, `migrations`, the lockfile, and `wrangler.jsonc`. Keep the existing Cloudflare project, build/deploy settings, Worker name and domain.

The existing commands remain `npm run build` and `npm run deploy`. The build is a deployment dry run. `keep_vars: true` is retained, and no cron triggers were added. Confirm the eight bindings above are present in the deployed Worker. Use the HTTPS `SITE_URL` origin in the following commands.

## 4. Preview #165 — no send or database write

From the extracted project folder, run PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\manual-strong-match.ps1 -SiteUrl "https://YOUR-SITE" -ExpectedEmail "YOUR-EMAIL"
```

Enter the new `MANUAL_NOTIFICATION_TOKEN` at the hidden prompt. The default notification ID is `165`. The result must be `status: ready`. Review the recipient, job link, subject, HTML/text, match score and available job details. Preview performs only reads and never reserves a delivery, calls Resend, or changes `notified_at`.

If the recipient has changed, is not confirmed, is not the configured test email, is no longer active Pro, has expired, or disabled Strong Match Alerts, sending is blocked. A missing/invalid database field or failed read also blocks sending. A null `pro_expires_at` means no expiration, per your database rules.

## 5. Send #165 deliberately

Run the same command with `-Send`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\manual-strong-match.ps1 -SiteUrl "https://YOUR-SITE" -ExpectedEmail "YOUR-EMAIL" -Send
```

It previews again, then requires you to type `SEND_165`. Only then does it request a send. The Worker independently checks the ID allowlist, expected email, confirmation, current pending strong-match row, public job availability, Pro entitlement and email preference again before sending.

Success returns `accepted_and_notified` with a `resend_id`. Check that Resend accepted it, your inbox received the branded email from **VeeAys Jobs <jobs@veeays.com>**, the links work, and the row has `notified_at` populated:

```sql
select id, notification_type, notified_at
from public.job_match_notifications
where id = 165;

select notification_id, created_at, resend_id, accepted_at
from public.manual_strong_match_deliveries
where notification_id = '165';
```

Acceptance is not a delivery guarantee; check Resend's delivery/bounce status and your inbox. Repeat requests after acknowledgement return `not_pending` and send nothing.

## Recovery

Resend rejections and timeouts leave `notified_at` null. A frozen delivery record may remain, protecting the retry. Do not delete or reset it to force another send.

- Retry the same request and unchanged content within **23 hours of the ledger's `created_at`**. The request uses the same Resend idempotency key and payload. Resend retains idempotency keys for 24 hours, so the earlier cutoff leaves a margin.
- If Resend acceptance is saved but updating `notified_at` failed, preview returns `accepted_needs_acknowledgement`. Running with `-Send` completes acknowledgement using the saved receipt; it does not send again.
- If the request timed out or saving the receipt failed, acceptance may be unknown. Inspect Resend, then retry the same request within the safe window. Changed payloads, concurrent reservation conflicts, and attempts beyond 23 hours block sending and require review.
- For an unresolved attempt beyond the window, reconcile the exact email against Resend before any database repair. If it was accepted, record its verified Resend ID and acceptance timestamp in the ledger, then use the manual endpoint to finish acknowledgement. If acceptance cannot be proven, leave the record pending. Do not clear it and resend blindly.

The manual API accepts only JSON POST with `Authorization: Bearer <MANUAL_NOTIFICATION_TOKEN>` and no browser `Origin` header. Body: `{"action":"preview","notification_id":"165","expected_email":"YOUR-EMAIL"}`. For send, use `"action":"send"` and add `"confirm":"SEND_165"`. Never paste real tokens into committed command examples.

The processor handles any explicitly allowlisted ID using this same route and `SEND_{id}` confirmation. #165 appears only in first-test instructions and the helper's convenience default. The test-recipient guard stays enabled; this release does not enable sending to arbitrary users. Remove `165` from the runtime allowlist after the test if you want to disable further attempts.

## Verified implementation and limits

- Uses `job_match_notifications.notification_type = 'strong_match' AND notified_at IS NULL`.
- Reads `profiles.plan`, `plan_status`, `pro_expires_at`; reads `job_preferences.email_strong_matches` by `user_id`; resolves the confirmed current email via Supabase Auth admin API.
- Fetches the full `jobs` record and verifies it still exists in `public_jobs`. Available salary, location, employment type, schedule, company and score are included; absent fields are omitted.
- Stores the exact email payload before sending and the provider receipt before acknowledging. The notification is updated only after Resend returns a successful response with an email ID.
- Modern `sb_secret_` keys use the `apikey` header, never a JWT Bearer header. Legacy service-role JWTs are also supported. These credentials are confined to the new server-side module.
- Subscription/preference checks are fresh reads immediately before sending. A concurrent external account change cannot be made atomic with Resend; no database transaction is held across the email request.
- The ledger migration and real Cloudflare/Supabase/Resend integration need the controlled live test above. No live deployment, database migration, or real email send was performed during packaging.

Official references: [Resend idempotency](https://resend.com/changelog/idempotency-keys), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).
# Historical manual test instructions

These instructions describe the previous successful manual test. Do not use them to send with this release. Follow `PRODUCTION_STRONG_MATCHES.md`: clear the manual allowlist after confirming #165, keep the ledger, deploy disabled and enable cron only after review. The production-mode binding retires the old endpoint with HTTP 410.
