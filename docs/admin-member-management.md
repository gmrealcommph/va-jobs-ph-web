# Member management release candidate

This change builds on `codex/recovered-production-auth-081b6577`, the saved source of the already-deployed authentication/lifecycle release. Main was behind production; merging or deploying main directly would regress those features. The recovered baseline is a separate commit and review base. Its provenance and hashes are recorded in `recovered-auth-production-baseline.md`.

## Scope

The existing Members section now provides bounded search and pagination; verified, unverified, suspended and review filters; account/profile/plan details; confirmation receipts count; and recent audit history. Review hints use a small, explicitly limited disposable-domain list and unverified registrations older than seven days. Hints never trigger automatic action.

Suspension/reactivation and deletion require the existing admin allowlist, a current authenticated session, same-origin JSON, a short-lived HttpOnly confirmation cookie bound to the admin and member, typed action plus full member ID, a reason, and current admin password verification. Admin and self-target actions are protected. Verified MFA accounts fail closed for assisted handling. Password sessions are signed out after use. Attempt limits protect password verification, with the existing distributed limiter reused when present.

Database operations require service-role access and independently recheck the actor and protected target. Audit records survive member deletion, with replay protection bound to actor, member and action. Deletion calls the existing prepare/checkout-close/finish flow; incomplete checkout creation and active email leases still block completion. Payment receipts are detached and retained, and deletion does not issue refunds. Existing self-service deletion is unchanged.

Suspension removes refresh sessions, sets the Auth ban, rejects existing JWTs in Worker session checks while member actions are enabled, and adds restrictive policies to the existing member-owned data tables. Reactivation removes the ban and requires a fresh login. Do not disable the Worker guard as a long-term rollback while suspended accounts exist; first reconcile suspended accounts or preserve the guard independently.

The root scrolling bug reproduced at 390px: body `overflow:clip` propagated to the viewport while root overflow was visible. A touch swipe moved 0px. Giving the root an explicit vertical scroll container and allowing visible body overflow on mobile restores scrolling; desktop retains its layout and rounded container. Native dialogs scroll independently and clean up their password field on close.

The Email allowance overview tile and existing Quick Reads monitoring are retained unchanged.

## Validation

Run the focused Node suite listed in the PR. `scripts/verify-admin-mobile.mjs` uses installed Playwright and Chrome, a local HTTP server and synthetic data only. It compares baseline CSS against the candidate at 390px, then checks 390/700/1280px widths, section navigation, typed-confirmation rejection, dialog scrolling/closing and resumed page scrolling. Set `PLAYWRIGHT_PACKAGE_ROOT` if Playwright is provided outside this repository and `ADMIN_TEST_OUTPUT` to choose the evidence directory. It does not contact production services or operate real accounts.

## Approval and deployment boundaries

Nothing in this work installs production SQL, deploys a Worker, activates CAPTCHA or performs a real account action. `ADMIN_MEMBER_ACTIONS_ENABLED` is explicitly `false` in the candidate configuration. The new SQL is an unapplied candidate in `migrations/admin-members.sql`, following the repository's existing installation SQL layout; generate the final timestamped migration through the established Supabase CLI process after installation approval.

Before rollout, confirm the current deployed Worker version against recovered version `081b6577-3502-401c-9b7b-1785772e0014`, reconcile any newer changes, and preserve the live asset manifest, all bindings, secrets, schedules and feature flags. The main-branch Wrangler configuration is not a complete live deployment manifest. Obtain explicit approval for database installation, production deployment and enabling account actions. Apply the SQL only after existing admin and account-deletion migrations, run database advisors, and verify authenticated/non-admin denial in the real environment before enabling actions. If Supabase CAPTCHA is subsequently enabled, verify password reauthentication compatibility before activation; this password-only admin confirmation does not render a second CAPTCHA widget.

No live database integration or destructive smoke test was run. Local PGlite exercises the actual candidate SQL and existing deletion SQL. Real-link expiry/replay, email delivery and Telegram delivery remain governed by their existing deployment checks; no new messages were sent.
