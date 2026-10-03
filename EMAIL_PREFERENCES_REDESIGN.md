# Email Preferences redesign — October 3, 2026

This addition changes the settings page, its combined save helper, related tests and shared stylesheet. It does not change Daily Digest or Strong Match delivery, Matching V2, migrations, cron dispatch, or Cloudflare configuration. The unrelated standalone My Matches link is removed; the navigation link remains.

The two settings use rounded cream cards, forest-green/lime toggle switches, the requested copy/badges, lightweight inline SVG target/mail animations, a dotted airplane detail and one Save preferences button. Saved state shows a check icon and accessible status message. Native keyboard-operable checkbox switches work without JavaScript. Reduced-motion settings disable animation and transitions.

The endpoint accepts only `email_strong_matches` and `daily_digest`, validates both, and rejects unknown properties. The backend constructs the two-field boolean payload explicitly, targets the authenticated user's existing row and verifies both returned values. Both fields update in one PATCH; no other preference/profile field can enter it. Existing login, same-origin POST, cookie refresh, no-store and content-security protections remain. A checked native switch submits its hidden `false` then `true`; this exact pair normalizes to true. Other duplicate sequences are rejected. Single explicit true/false values are also supported. Missing either field is rejected rather than silently clearing it.

The shared CSS makes body a flex column with 100vh/100dvh minimum height, main filling spare space, and the footer in normal flow. There are no fixed/sticky footers or page-specific fixed heights.

## Verification

- All 8 updated settings/security tests pass, including all four combined boolean states, native checkbox submissions, field isolation, injected unrelated properties, malformed values/duplicates, missing settings, CSRF/login, failed writes, helper validation and saved/empty states.
- Full suite with the external exact Matching V2 SQL fixture: **58 passed, 4 failed, 62 total, 0 skipped**. The four failures are the same pre-existing frontend assertions documented in the Daily Digest report. No new failures remain.
- Headless Edge exercised the actual page handler against synthetic local Auth/database responses: keyboard Space toggles, combined form submission, persisted states, success confirmation and retained target roles all passed. No live credentials, data or providers were used.
- Desktop/mobile previews were visually inspected. At 375px, scroll width is exactly 375px. At desktop height 1800px, the settings footer bottom is exactly 1800px; a separate generic short page at height 1000px also ends at 1000px. The footer remains position relative, in normal flow. Reduced-motion checks confirm both icon animations and toggle transitions are disabled.
- Hash comparison confirms Daily Digest, Strong Match, manual notification sender, migration 003 and Wrangler configuration are unchanged from before this redesign. Migrations 001/002 and worker cron dispatch were not edited.
- The deployment dry run was attempted, but Windows blocked the bundler's ancestor-directory reads (`Cannot read directory ../../../../../..: Access is denied`). The narrow permission refresh did not resolve it. This packaging check remains unverified for this revision; the previous Daily Digest dry run passed. Do not interpret the browser/Node checks as a replacement for the deployment build.

## Files and deployment

Changed production files: `src/email-preferences.js`, `src/auth.js`, `public/styles.css`. Updated test: `test/email-preferences.test.js`. No new migration or secret is needed for this redesign. Redeploy through the usual workflow after its build succeeds. Keep Daily Digest's existing disabled activation state and all Strong Match settings intact.

The `VeeAys_Daily_Digest_V1_Email_Settings.zip` artifact contains the complete current project, including the already-disabled Daily Digest addition. Production migrations 001/002 must not be rerun; migration 003 is required only if the earlier Daily Digest addition has not yet been applied. The historical validation notes describe earlier revisions; this note supersedes their radio-control and separate-save descriptions.
