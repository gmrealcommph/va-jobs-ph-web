# Unified VeeAys navigation — preview only

Based on main 9b07af4. PR #26 (homepage), #28 (Pro redesign), #29 (typography/mobile), and #30 (Pro font policy) were inspected and are already merged. No outstanding draft feature work was incorporated. The prior logo task confirmed cancellation with no edits, commits, merge or deployment.

Shared `siteHeader` is consumed by the existing public/member layout, covering homepage, Pro, categories, listings, job details, employer/about, auth, preferences, workspace and legal/support pages. The separate administrative dashboard keeps its purpose-specific navigation.

Forest #0F3D2E pill, centered dark navigation capsule, mint active tab, right account actions. Authentic /veeays-logo.png remains byte-for-byte unchanged; cream backing retained. Existing page body renderers, hero images, artwork, routes, forms, auth, payment and production settings are unchanged. Native details/summary disclosures preserve progressive enhancement, keyboard operation, Escape/focus restoration, outside click and focus-out dismissal. Mobile breakpoint is 1150px in both CSS and menu-close script; 44px minimum header/menu targets and visible focus rings.

Validation: full existing suite 448 passed / 4 skipped / 0 failed; three additional navigation tests pass (combined total 451 pass / 4 skipped). Focused 16 navigation/company/job-header/Pro tests pass. Wrangler build-only dry run and whitespace check pass. Local browser fixtures at 390 and 1440 cover homepage, Pro, category listing, jobs listing/detail, employers, login/signup, and Free workspace; also active Pro member, narrow 320 and desktop 1151. No horizontal page overflow, logo natural width 1200. Menu Enter/Escape and focus restoration verified. Browser evidence and measurements are in evidence/unified-navigation.

Previews use actual page renderers with empty public listings, a clearly illustrative job detail and synthetic Free/Pro identities. No real login, payment, account mutation, CAPTCHA submission or live deployment performed. No claim of end-to-end production authentication testing. Review homepage desktop/mobile, mobile menu and member-menu screenshots before approving merge/deployment.

NOT MERGED. NOT DEPLOYED. User preview approval is required.

## Cream floating navigation revision — 20 October 2026

The latest user instruction supersedes the forest outer pill. The shared outer shell is now cream #F8F6EE with top/side inset and a subtle shadow; the authentic logo sits directly on cream with no separate logo pill. The centered inner capsule is forest #0F3D2E with a mint current-page tab. Log in is forest and Sign up is mint. Workspace links use forest text on cream. The same shared header covers public/member pages; homepage and Pro float it over their existing illustrated heroes with content clearance. Mobile retains the compact logo, native keyboard-operable Menu disclosure and signed-in Pro/account destinations.

Originating chat was read, but its generated image was returned only as a content-reference placeholder; the exact latest generated mockup could not be retrieved. Implementation follows the user's explicit approved visual specification. No logo asset, hero artwork, page body renderer, CAPTCHA/auth flow, alert setting, runtime configuration or unrelated branch was changed. This updates existing draft PR #31; unrelated open PRs remain separate.

Fresh validation: 12 focused tests passed (shared header, route/account states, homepage search/category/save behavior, Pro rendering and offline CAPTCHA integration). Build-only Wrangler dry run and git diff whitespace check passed. Actual local Chromium screenshots use existing page renderers/assets, empty listings and synthetic member identity. Twenty viewport/route checks (320, 390, 768, 1151, 1440; homepage, Pro, login, member workspace) passed with no horizontal overflow, cream computed shell color and original logo decoded at 1200px. Mobile Enter/Escape/focus restoration passed. Optional analytics declined only in local preview storage. No live account, CAPTCHA submission, production write, merge or deployment.

Updated evidence: home-desktop.png, home-mobile.png, pro-desktop.png, pro-mobile.png, mobile-menu.png, member-menu-desktop.png and visual-checks.json in evidence/unified-navigation. These supersede the previous forest-shell screenshots. KEEP DRAFT until the user approves.
