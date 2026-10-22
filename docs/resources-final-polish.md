# VeeAys Career Hub — staging visual correction
22 October 2026 · Awaiting screenshot approval · No production release

Staging: https://veeays-resources-polish.gm-realcommph.workers.dev/resources
Staging worker: veeays-resources-polish
Version: d45681bf-fc03-4549-afb4-164e9f99d079
Baseline: 061872b5b5b0d88bc24d06caae41b9a159cb626e (resources-final-polish, PR #41).

## Implementation
- Replaced the flat hero checklist with the supplied warm workspace artwork featuring the male model and black Shih Tzu. Its former step panel is covered by a concise, live-text “Better Jobs. From Home.” panel; the four career steps appear only in the roadmap. Existing supporting copy, two CTAs and free-resource message remain. The H1 uses the reference’s sentence case and underline on “career”.
- Shortened the four colorful starting-point cards, reused their reference illustrations and retained every description and action destination. Mobile cards use the reference’s compact illustration/title/action layout; descriptions remain in the desktop layout and the linked guides.
- Made the Discover → Prepare → Practice → Apply roadmap a compact connected line on desktop and a vertical connected list on mobile. All destinations remain; desktop CTA descriptions remain. On mobile each complete step is still a link, with its explanatory copy.
- Kept the four real tool destinations in the mint tools panel. No extra carousel, fake progress or duplicate steps were added.
- Changed the two plain featured cards into four image-led cards for existing beginner, résumé, interview and safety guides. Titles, categories, actual reading times and current takeaway copy remain. All six existing guides remain in the resource library.
- Tightened the six library rows to thumbnails, category, title, reading time and accessible arrow links. The same takeaway is available in the featured card or article rather than repeated in every row. Search, category intersection, GET fallback, history, reset and empty states retain the existing client implementation.
- Replaced accumulated Career Hub landing-page overrides with a single responsive layer. Shared header, navigation CSS, official logo file, guide source content, footer, Résumé Studio, Traffic Waves, pricing and all backend code are unchanged from the verified baseline in the final staging package.
- Added 11 WebP crops (64,462 bytes total) extracted directly from the user-provided mockup. No AI generation, external stock download, new logo or paid AI call was used. The small logo visible on the laptop is baked into the supplied reference artwork; the actual header/footer continue to use the exact official logo asset.

## Validation
- Full regression suite: 506 tests; 502 passed, 4 skipped, 0 failed.
- Final focused Resources/navigation tests: 10 passed, 0 failed.
- Staging build passed with the explicit isolated staging configuration.
- Actual staged landing verified at 320, 390, 768, 1024 and 1440px. All six articles verified at 390 and 1440px: HTTP 200, one H1, no horizontal overflow, correct footer, noindex and valid page fragments.
- Actual browser checks passed: all images decode, four featured cards, six library guides, no hero roadmap duplication, accented résumé search, category intersection, empty state, reset, back/forward history, 3px keyboard focus and the three guide pathways.
- Résumé Studio destination retained as /resume-studio; jobs and categories destinations retained. Their production HTTP status was checked read-only. No account, payment, AI, database or job mutation was performed.
- GET search without JavaScript passed: résumé = 2 guides; safety = 1; unknown query = 0. Reduced-motion styling passed. No browser page errors.
- Official logo, shared styles/header scripts and Résumé Studio asset hashes checked against the baseline and final staging. Final deployment was built from a clean baseline package with only the Career Hub module, stylesheet and crops overlaid. An unrelated working-copy Résumé Studio edit was excluded and left uncommitted.
- AI/payment/background features are disabled in the stage config; no production routes, secret/database bindings or cron schedules are configured. Production was not deployed or merged.

## Remaining visual differences for approval
- Artwork is extracted from a 1536×1024 composite, not original standalone assets. The hero crop is only 420×295px, and featured crops are about 193×93px; softness is visible when enlarged on desktop. Original high-resolution exports would improve clarity without changing layout.
- The approved source dog has warm gray/brown highlights around its face and coat. These are preserved. It is not a newly recolored, uniformly jet-black dog; a separate pure-black source would be required to remove that difference without generating new art.
- The hero uses one tagline panel in place of the reference’s four-step overlay, as requested to eliminate repetition. The desktop hero is deliberately compact; the exact source typography and every pixel of spacing are not reproduced.
- The existing approved site header stays intact. Its mobile floating cream header and Menu control differ from the slim header drawn inside the reference phone. No fake carousel dots are added to the static hero.
- The roadmap retains existing vector icons and live links rather than introducing another set of painted icons. The four starting illustrations and featured artwork do match the supplied source.
- Desktop featured guides are four across at wide widths and two across on tablet/mobile. The reference shows them two across in a separate continuation panel. Long current guide titles and current takeaway copy determine the real card heights.
- All six actual guides remain in the library; the mockup shows only four example rows, including titles that are not among the six current guides. No placeholder guides were invented. Mobile also includes tools, featured cards, the library and real footer below the point where the reference phone ends.
- Viewport emulation is not a physical-device or Safari test. No formal screen-reader or Core Web Vitals audit was performed.

## Review artifacts
The supplied reference and actual staged screenshots are provided separately, plus side-by-side desktop, library and mobile comparisons. The comparison normalizes panel widths for inspection; screenshots themselves are unaltered browser captures. See visual-review.html for the complete review, focused-tests.txt and staging-verification.json for evidence.

Production release remains blocked on explicit user screenshot approval.
