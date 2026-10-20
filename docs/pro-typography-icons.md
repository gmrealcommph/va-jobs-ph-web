# Pro typography and colorful icons

Focused follow-up to merged PR #28, using the user-supplied Intentional Job Search Dashboard.png inspected in this chat on October 20, 2026. Keeps the existing card arrangement, hero and closing artwork, authentic shared logos, copy claims and native controls.

Locally hosted OFL Manrope variable font supplies real 400–800 weights: 800 primary headlines, 700 card headings, 400 body, 600–700 labels. Adds a consistent SVG icon family with green, yellow, orange, blue and purple accents. Decorative icons are hidden from assistive technology. Mobile benefits use 16px body text; captions remain distinct from primary copy.

Match roles and percentages retain visible illustrative captions. Saved searches now say “Up to 5” and carry a visible illustrative/example label; slot numbers are examples, not new-result or email counts. No fabricated email results added. Existing opt-in digest qualifications and inactive personalized category/salary preference notice remain intact.

Validation: 40 focused tests passed (pro-premium, pro-checkout, pro-live, pro-discovery, pro-visibility, daily-digest). Wrangler dry-run build and git diff --check passed. Local browser checks at 320/390/768/1440 showed no horizontal overflow; real Manrope loaded; one checkout form with all three buttons associated correctly and at least 48px high. Actual shared layout and Pro renderer, synthetic live-checkout display only; no checkout submitted. No live email delivery or production checkout certification. Screenshots at 1440 and 390 attached here.

Changes are limited to Pro rendering, Pro CSS, the font, and review evidence. No auth/CAPTCHA, logo assets, payment code, database, worker, schedule or configuration changes. Smart Alerts remains untouched/paused; no production mutation, merge or deployment.

Font source: https://github.com/google/fonts/blob/main/ofl/manrope/Manrope%5Bwght%5D.ttf ; existing public/fonts/Manrope-OFL.txt applies.
