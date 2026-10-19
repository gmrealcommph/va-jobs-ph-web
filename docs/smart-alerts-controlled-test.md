# VeeAys Smart Alerts: controlled test completed

One real email was sent by this task, only to **support@veeays.com**. No retry or second send was attempted.

## Provider and webhook evidence

- Production sender: `VeeAys Jobs <jobs@veeays.com>`, using the existing bound `RESEND_API_KEY`. No secret value was retrieved or changed.
- Provider email ID: `01a15498-e9c5-7605-832f-054b145fbca1`.
- Provider Message-ID: `<010601a15498ec7e-bfbafd87-58dd-4c9f-8865-cafe38b84751-000000@ap-northeast-1.amazonses.com>`.
- Accepted: HTTP 200 at **19 October 2026, 10:37:50 PM Manila**.
- Resend status subsequently read: **delivered**. This establishes provider-reported delivery, not that a person read the inbox.
- Dedicated webhook: `https://veeays.com/webhooks/job-alerts`, ID `137b09ed-4518-4295-96e4-117a1f0d911a`.
- Provider-originated `email.delivered` event: `msg_3KuwIF8375dSXRn08V4mrTXUhln`, provider history **success**.
- Attempt: `atmpt_3KuwIFOfIP4G2ggZQEslyHRlYad`, HTTP **204**, sent at **10:37:58.908 PM Manila**.
- Worker log at **10:37:59.050 PM Manila**: `job_alerts_signed_delivery`, the same email ID, and the same event ID. This log executes only after raw-body signature and timestamp verification. Worker invocation outcome: `ok`, no exceptions.

## Changes and cleanup

Temporary version `aefb3c15-3b7a-483b-b025-982a0de91fa5` added `/internal/job-alerts-test`. It required a random 256-bit bearer token, stored only as a SHA-256 digest in deployed source, rejected origins/query/body overrides, expired automatically, required global alerts disabled, and hardcoded the sole recipient. A unique database insert committed before the provider request; conflicts, uncertain database outcomes, and provider failures never retried. A fixed provider idempotency key supplied another fence. A local exclusive attempt marker prevented accidentally rerunning the operator command.

The permanent claim is `public.job_alert_test_claim`, restricted to the single authorization ID `smart-alerts-support-20261019`. Its row records the provider ID and claim time `2026-10-19T14:37:48.958646Z`. RLS is enabled, anonymous/member grants are revoked, and the Worker has no DELETE privilege or permission to update the claim ID. Retain this small audit record; do not reset it. The installation SQL is recorded in repository documentation and was executed directly, without adding a migration-history entry. The advisor's informational “RLS enabled, no policies” notice is intentional for this service-only table.

Cleanup version **`5f9dfa9d-ffeb-4182-9fc4-d31a980355ce`** is live. Downloaded deployed source confirms the temporary route and function are absent. The temporary source and tests are preserved in implementation commit `ef2681d` and removed from the final branch. The only runtime code retained is signature-verified delivery logging with provider/event IDs; no email body, address, token or signing secret is logged.

Added `email.delivered` to the dedicated webhook, retaining `email.bounced`, `email.complained`, `email.suppressed`. The separate member lifecycle webhook remains enabled with its original three subscriptions.

## Validation and preserved state

- Repository baseline and live Worker: all 305 declarations matched after normalizing build-path labels before changes.
- Eleven focused tests passed before deployment, covering auth, mode/expiry/body restrictions, concurrent replay, uncertain outcomes, existing alerts behavior, and webhook signature tampering.
- Worker production build passed. No changed assets were uploaded.
- Live unauthenticated test POST returned 401 before the authorized call.
- Database access checks: RLS true; anonymous insert false; member read false; server delete false; server insert true.
- Post-cleanup live binding metadata and cron schedules matched the saved baseline exactly. Secret values are unreadable and were not compared or changed.
- **`JOB_ALERTS_MODE=disabled` remains confirmed.** Existing legacy email modes, Quick Reads/AI flags, payments, entitlements and crons were preserved. No member/bulk send was invoked by this task.

The controlled sender and signed delivery checks are complete. This task does not activate Smart Alerts or validate the separate enrollment/matching pipeline for rollout.
