# VeeAys operator and indexing update

Prepared against the 5 October legal/support repo snapshot (base commit 97dfc44 plus its legal-page additions). Incremental patch: apply after the previous legal/support package. No deployment performed.

Changed only src/legal-pages.js, src/worker.js and test/legal-pages.test.js. Both operator references now use Alfred Parungao. Shared copy retains the sole proprietor/Philippines statement, support@veeays.com and +63 975 810 4597.

Terms, Privacy and Refund Policy use the existing renderer's noindex,follow meta value and a route-specific X-Robots-Tag: noindex, follow header. Contact retains index,follow with no added robots header. No styling, Quick Read, payment or other feature changes. Byte comparison confirmed only these three files changed.

Focused tests: 6 passed, checking GET/HEAD headers, exact robots meta values, operator wording, contacts and footer links. Full suite: 146 tests, 135 passed, 7 failed, 4 skipped. Untouched source baseline produced the same counts and identical failing test names (digest activation, two Quick Read boundaries and four worker/search/detail expectations). No new failures. Wrangler 4.144.0 build dry-run passed (203.91 KiB / gzip 52.89 KiB); no upload. Reverse patch application check passed.

Repo-wide Jocelle search: originally two source references and one test expectation. No remaining operator/content references. The only remaining occurrence is test/legal-pages.test.js:20, a negative assertion preventing Jocelle Parungao from appearing in rendered pages.

ZIP contains the three replacement files with repository paths and this report. Patch is incremental; use ZIP or patch, not both.
