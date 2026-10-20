# Pro typography and colorful icons

Focused follow-up to merged PR #28, using the user-supplied Intentional Job Search Dashboard.png inspected in this chat on October 20, 2026. Keeps the existing card arrangement, hero and closing artwork, authentic shared logos, copy claims and native controls.

Locally hosted OFL Manrope variable font supplies real 400–800 weights: 800 primary headlines, 700 card headings, 400 body, 600–700 labels. Adds a consistent SVG icon family with green, yellow, orange, blue and purple accents. Decorative icons are hidden from assistive technology. Mobile benefits use 16px body text; captions remain distinct from primary copy.

Match roles and percentages retain visible illustrative captions. Saved searches now say “Up to 5” and carry a visible illustrative/example label; slot numbers are examples, not new-result or email counts. No fabricated email results added. Existing opt-in digest qualifications and inactive personalized category/salary preference notice remain intact.

Validation: 40 focused tests passed (pro-premium, pro-checkout, pro-live, pro-discovery, pro-visibility, daily-digest). Wrangler dry-run build and git diff --check passed. Local browser checks at 320/390/768/1440 showed no horizontal overflow; real Manrope loaded; one checkout form with all three buttons associated correctly and at least 48px high. Actual shared layout and Pro renderer, synthetic live-checkout display only; no checkout submitted. No live email delivery or production checkout certification. Screenshots at 1440 and 390 attached here.

Changes are limited to Pro rendering, Pro CSS, the font, and review evidence. No auth/CAPTCHA, logo assets, payment code, database, worker, schedule or configuration changes. Smart Alerts remains untouched/paused; no production mutation, merge or deployment.

Font source: https://github.com/google/fonts/blob/main/ofl/manrope/Manrope%5Bwght%5D.ttf ; existing public/fonts/Manrope-OFL.txt applies.

## Mobile alignment follow-up

Mobile-only CSS straightens both match previews, uses stable icon/title/score columns, gives hero perks equal columns and purchase controls the content width, regularizes filter chips into two columns, stacks the saved-search illustration above its example panel, aligns the digest link with its text, and moves the floating plan note into normal flow. Plan prices and closing controls share consistent edges. Additional compact preview spacing applies below 360px. Desktop composition stays unchanged.

Rechecked at 320/375/390/430: no internally overflowing Pro elements or horizontal page overflow. At 768/1440 no page overflow; existing desktop rotated artwork retains intentional local visual overflow. Checkout associations remain /pro/checkout with controls >=48px. All 40 focused tests and dry-run build pass again. Updated mobile screenshot and mobile-benefits detail included. No merge or deployment.
