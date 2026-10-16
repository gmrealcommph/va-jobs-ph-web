# Admin member management: release gates

GO for draft review/staging preparation. NO-GO for production deployment or action activation. This preparation performs no merge, deployment, production SQL, account action or message delivery.

## Baseline

PR #7 depends on recovered auth PR #6, 4b11e28883710f332b475014d040683acbb7357f. Main lacks deployed authentication. PR #8's CSS-only release is live at c112eecd-49b1-480f-a316-091b11d02071. The candidate keeps the complete saved live admin-theme.css as a byte-identical prefix and appends member-dialog styles. Scrolling rollout is already complete. Both source dependency PRs remain unmerged; agree their integration sequence before merge approval.

Read-only management GET checks on 2026-10-16 confirm c112eecd at 100%, settings/bindings/schedules matching the saved release, and live CSS SHA256 f2aae406142d57cae7079f81e21895258a68d9b18e84e9a3ef9656489c698360. Stop on subsequent drift. Preserve all 83 live assets, including member-emails.css. Repository Wrangler configuration is not a complete production deployment manifest. Signup, CAPTCHA, verification/resend, recovery, payments, Quick Reads, Email Allowance, secrets, bindings and schedules must remain intact.

## Confirmation security

ADMIN_MEMBER_ACTIONS_ENABLED remains false. Enabled dialogs render Turnstile explicitly, forward one token to the existing Supabase password-grant transport, reset after each attempted request, and remove the widget on close. Only Supabase consumes the token; no duplicate siteverify call occurs. Missing required key/token, malformed token, provider rejection, expiry/error/timeout and loader failure block confirmation. Passwords clear on response/close. Read-only mode shows no action form and requests no CAPTCHA script. CSP permits Turnstile only on enabled admin action pages.

Admin allowlist is checked before reads and after reauthentication. Fresh identity must match the original admin. Both current and freshly returned verified MFA factors fail closed. Self/admin targets, same-origin JSON, HttpOnly member/admin-bound confirmation, typed action/ID, audit reason and attempt limits remain enforced. Temporary reauthentication tokens do not replace browser cookies and are signed out locally in finally. Cleanup on provider logout failure remains best-effort; test it in staging.

Service-only action SQL rechecks actor/target safeguards and replay protection. Deletion reuses installed prepare/checkout-close/finish functions; provider failure and active email leases block completion; receipts survive detached, audits survive and no refund occurs. Suspension removes refresh tokens/sessions and bans the account. The active-member guard now requires JWT session_id to match a surviving, unexpired Auth session. Reactivation cannot revive a revoked JWT; fresh login is required. Preserve this guard and restrictive policies on rollback while suspensions exist.

## Evidence and limits

The earlier 113-pass result is historical evidence for unchanged behavior, not a new full-suite result. Fresh focused checks pass 56 tests covering CAPTCHA transport/rejection, MFA, authorization, defaults, session revocation, SQL, deletion and recovered auth. SQL is installed only in isolated PGlite. Production catalog exports are gathered using BEGIN READ ONLY / ROLLBACK; required columns/types, RLS, function grants, foreign keys and postgres Auth-table privileges match dependencies. Production has_access, admin-access and prepare/finish deletion definitions are replayed locally. This does not prove managed-runtime behavior or concurrency.

Chrome synthetic checks pass at 390/700/1280px, including scrolling, sections, dialog scrolling/close, typed rejection, Email Allowance and no page errors. A separate synthetic CAPTCHA browser check covers disabled UI/no script/no POST, expiry, provider rejection, password clearing, reset and removal. These do not exercise a real Turnstile challenge or real admin. Dry-run Worker build passes without upload.

Reproduce focused tests: node --test test/admin-members.test.js test/admin-members-db.test.js test/admin-member-session.test.js test/account-deletion.test.js test/account-deletion-db.test.js test/auth-production-regression.test.js test/auth-session-recovery.test.js test/admin.test.js. Set PRODUCTION_CATALOG to the reviewed production-catalog.json export for local production-function replay. Browser scripts: verify-admin-mobile.mjs and verify-admin-member-captcha.mjs; set PLAYWRIGHT_PACKAGE_ROOT and ADMIN_TEST_OUTPUT. The mobile script's historical comparison is diagnostic only.

## Separate approval stages

1. Approve the reviewed commit for isolated staging deployment with ADMIN_MEMBER_ACTIONS_ENABLED=false and staging-only migrations/admin-members-readonly.sql. It installs the audit table and authorized read functions, with no action function or suspension policy. Verify admin-only list/detail, ordinary/anonymous denial, disabled forms/POST and existing flows. Production remains untouched.
2. Obtain separate staging action-test approval naming disposable accounts/actions. Install admin-members.sql only in staging and enable actions only there. Exercise real Turnstile-enabled reauthentication (valid, expired/replayed/missing token, wrong password), current/fresh MFA denial, protected targets, receipt retention, checkout/email blocking, session removal, old JWT denial before/after reactivation and temporary-session cleanup. Never disable CAPTCHA to pass tests.
3. After staging passes, prepare an immutable production read-only package against then-current live source/assets/settings. Resolve PR #6/#8 integration and PR #7 merge sequence. Request separate approval naming exact merges, production read-only SQL, upload/traffic activation and rollback authority. Use only admin-members-readonly.sql and actions=false. Overlay only reviewed files onto the complete live asset set; preserve bindings, secrets, schedules and validate auth/dashboard. Never perform a plain repository deploy over production settings/assets.
4. Production action capability requires later separate approval naming full SQL, exact settings, permitted actions/accounts, live validation and rollback/reconciliation. Read-only approval never authorizes full SQL or actions=true. Snapshot grants/policies/functions and preserve audit/receipt data. If suspended accounts exist, do not disable their session guard as a rollback.

Exact next approval: isolated staging read-only deployment of the updated PR #7 commit plus staging-only admin-members-readonly.sql, with ADMIN_MEMBER_ACTIONS_ENABLED=false. No production changes or destructive actions. Stage 2 additionally needs a designated staging admin and valid real Turnstile hostname/key configuration.

References: https://supabase.com/docs/guides/auth/auth-captcha ; https://supabase.com/docs/guides/auth/sessions ; https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
