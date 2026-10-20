# Pro page premium redesign — draft only

The Pro page now follows the approved homepage's forest green, mint and warm cream palette, Manrope headings and rounded surfaces. A compact pricing block leads into a labeled, static match-feed illustration, three focused benefits, an optional daily digest note, and Free/Pro cards. No new raster assets, libraries or client JavaScript. Existing official header/footer logos are used unchanged.

## Product verification

Based on main e80c624 (including merged homepage #26 and CAPTCHA #27). A fresh read-only production request on 2026-10-20 returned the current `YOUR NEXT MOVE, WITH MORE FOCUS.` headline, daily-email benefit and paused personalized-category/salary-email caveat. Anonymous production rendering uses the existing free-match fallback. No live purchase was attempted.

- Price: PHP 499, 30 days, one-time payment, no automatic renewal. Existing checkout action and every account/test/live/fallback branch remain intact.
- Full ranked match feed beyond free top 3; salary, schedule, work type and 90%+ match filters are existing controls.
- Saved searches: up to five keyword/category presets; saving does not subscribe anyone to email.
- `wrangler.jsonc`: `DAILY_DIGEST_MODE=enabled`; existing daily scheduler requires active Pro and opt-in, skips empty digests. Provider secrets/delivery health were not independently verified.
- `JOB_ALERTS_MODE=disabled` remains unchanged. No Smart Alerts benefit is advertised. Personalized category/salary email preference caveat remains explicit.
- Public browsing/applying stays free; match scores are not interview or job guarantees.

## Validation and previews

- Desktop: [1440px](../evidence/pro-redesign/desktop.png); mobile: [390px](../evidence/pro-redesign/mobile.png).
- Local screenshots use the actual shared layout and Pro renderer, live-checkout rendering, local assets, external requests blocked, and optional analytics declined through its existing control. Illustrative jobs/scores are labeled, not real inventory.
- Browser widths 320, 390, 768 and 1440: document width equals viewport; primary CTA >=48px tall; single POST /pro/checkout form. Native navigation and purchase semantics preserved; visible keyboard focus and reduced-motion rules provided.
- 52 focused tests pass: Pro marketing/account states, checkout/payment validation, CAPTCHA, saved searches, daily digest and homepage discovery.
- Wrangler dry-run build passes. No deploy command was run.
- Two stale marketing tests already failed on baseline main (old autopilot/coming-soon claims); updated their expectations to current truthful copy.

No changes to homepage, auth, payments, worker, cron, configuration or existing assets. Do not merge or deploy without owner review.

Full suite: 451 tests; 447 passed, 4 skipped, 0 failed.
