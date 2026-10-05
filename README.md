# VeeAys legal and support package

Prepared 5 October 2026 against the current local VeeAys repository commit `97dfc44` (Guide Quick Read material condition placement 5.). No deployment performed.

## Changes

- Added public `/terms`, `/privacy`, `/refund-policy`, and `/contact` routes using the existing Worker and shared layout.
- Reused VeeAys typography, colors, page width, header and footer. Added page navigation and mobile wrapping.
- Retained existing Terms and Privacy footer links; added Refund Policy and Contact to the same visible footer row.
- Identified Jocelle Parungao as sole proprietor in the Philippines, with the supplied email, phone and website. No invented address, registration or tax information.
- Covered job aggregation, accounts, preferences, saved jobs, application tracking, matching, alerts/digests, Pro access, external employers and application links, data providers and authentication/session information.
- Clearly distinguished the advertised ₱499/month offer from the current absence of live payments. Future cancellation provisions are marked as planned. Paddle is not represented as processing current transactions.

## Files

`src/legal-pages.js`, `src/worker.js`, `src/render.js`, `public/styles.css`, `test/legal-pages.test.js`.

Worker changes consist only of a legal-page import and route dispatch. Renderer changes consist only of footer links and the stylesheet cache version. CSS additions target legal pages and footer wrapping. No Quick Read, payment, job-data, scheduler, authentication, homepage, Pro, categories or matches implementation was changed.

## Validation

- New tests: 6 passed. Cover public GET/HEAD routes without upstream job requests, canonical/index metadata, business contacts, footer links, payment status, hiring disclaimers and statutory-rights wording.
- Full suite: 146 tests; 135 passed, 7 failed, 4 skipped.
- Untouched baseline: 140 tests; 129 passed, the same 7 failed, 4 skipped. No new full-suite failures.
- Existing failures: digest activation test; Quick Read 41645 boundary test; Quick Read 43635 boundary test; search query expectations; job-detail escaping/application-link expectation; search pagination canonical expectation; numeric detail application-link expectation. Left unchanged to honor the requested scope.
- Wrangler 4.144.0 build dry-run passed: bundled Worker and 12 public assets, 203.73 KiB total / 52.84 KiB gzip. No upload or deployment performed.
- Browser checks: all four pages at 1440px and 390px widths; no horizontal overflow, all four footer links visible. Desktop Terms and mobile Contact screenshots reviewed.
- `git diff --check` passed.

## Apply later

Use either `veeays-legal-support.patch` or the ZIP’s changed files, not both. From a clean repository matching the base, run `git apply --check <path-to-patch>` before `git apply <path-to-patch>`. Alternatively, copy ZIP files into the corresponding repository paths. The ZIP preserves `src/`, `public/`, and `test/` paths and contains no dependencies, secrets or unrelated files. Run the repository tests and build dry-run before your normal deployment process. This package does not deploy anything.

## Before enabling paid checkout

Update the centralized copy in `src/legal-pages.js`: replace pre-launch statements with the actual merchant-of-record disclosure, provider buyer-terms/support links, tax/currency/renewal information, functioning cancellation method and agreed refund/withdrawal rules. Confirm those statements against the actual integration. Current policy text deliberately does not claim a live purchase agreement or finalized refund window. Confirm provider use, retention and privacy-contact procedures continue to match operations.

Copy was informed by [Paddle domain-review requirements](https://www.paddle.com/help/start/account-verification/what-is-domain-verification), [Paddle customer handbook](https://www.paddle.com/seller-guides/seller-handbook), [Paddle buyer terms](https://www.paddle.com/legal/buyer-terms) and [Philippine National Privacy Commission data-subject rights](https://privacy.gov.ph/data-subject-rights/). This package prepares public legal/support pages; it does not certify Paddle approval.
