# VeeAys Pro — approved cozy visual redesign

Draft PR #28. Do not merge or deploy.

## Reference and scope

Inspected the exact user-attached `VeeAys Pro_ Less Searching, More Matching.jpg` on October 20, 2026 before implementation. It supplies the approved tall page composition: cozy 3D hero, forest green/mint/cream, yellow rounded CTAs, floating match cards, asymmetric benefits, dark Pro comparison and home-office closing banner. The earlier plain draft is replaced with this direction. Shared official header/footer logos remain untouched.

Only the Pro renderer, its stylesheet, optimized new illustration assets, relevant marketing assertions and review evidence change. Homepage #26, CAPTCHA #27, payment implementation, configuration, schedulers, database and Smart Alerts are unchanged.

## Truthful capabilities and checkout

- ₱499 for 30 days, one-time payment, no automatic renewal. Public jobs stay free and Free retains its top 3 personalized matches.
- Pro retains full ranked feed, five saved keyword/category searches, salary/schedule/work-type and 90%+ match filters.
- Existing `DAILY_DIGEST_MODE=enabled`, scheduler and eligibility tests support optional legacy daily digest wording: active Pro and explicit email opt-in required; empty digests skipped. Delivery health and external provider configuration are not certified by this page change.
- `JOB_ALERTS_MODE=disabled` stays untouched. Saved searches do not imply email subscriptions. No claim that paused personalized category/salary emails or Smart Alerts are live. The reference's saved-search-driven digest illustration is therefore adapted into a truthful saved-search demonstration, with optional digest separately qualified.
- One original POST checkout form, now with an ID, remains the authoritative action. Comparison and closing buttons use native HTML `form` association with that form. Account, unavailable-checkout and test-mode branches remain intact; test CTAs retain TEST labels. No live payment attempted.
- Preview jobs and scores are explicitly illustrative. All text, buttons and filter demonstrations are HTML. Preview filter chips are noninteractive illustrations; actual filters remain on the matches page.

## Media

Built-in image generation created text-free illustrations using the approved attachment as the visual reference. No generated branding. Hero: 117,682 bytes; mobile crop: 75,608 bytes; desk banner: 53,204 bytes. Responsive WebP hero, explicit dimensions, high fetch priority and async decoding. The below-fold background is a separate optimized WebP. Full-resolution generation sources are not shipped.

Generation specs: hero — wide premium polished 3D render of an adult Filipina with glasses, dark bun, cream sweater and green trousers using a plain laptop on a green sofa, black fluffy dog, plants, bookshelves and amber lighting; character right, forest green negative space left, no text/UI/logos. Desk — matching cozy 3D home office, plain laptop and cream mug, green books, plants, amber lamp; scene right, dark green negative space left; no person/text/UI/logos. Built-in imagegen used; no API fallback.

## Validation

- 40 focused tests pass: Pro states and marketing, checkout, live-payment validation, discovery, visibility and daily digest.
- Wrangler dry-run build passes. No deployment.
- Chromium layout checks at 320, 390, 768 and 1440: no horizontal overflow; all purchase controls at least 48px tall and associated with `/pro/checkout`; one checkout form; responsive hero loads.
- Screenshots use the actual shared layout and renderer with the live checkout state, local assets and blocked external requests. Optional analytics is declined via its existing UI before capture. No production purchase or external request.
- Desktop and mobile images visually inspected; mobile crop and price contrast refined after first capture. Keyboard focus styling and reduced-motion support retained.

Review: [desktop](../evidence/pro-redesign/desktop.png), [mobile](../evidence/pro-redesign/mobile.png), [layout checks](../evidence/pro-redesign/visual-checks.json).
