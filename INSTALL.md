# Customer Support header artwork

Changed code: src/job-detail-header.js, public/styles.css, test/job-detail-header.test.js.
The ZIP also includes the exact, unchanged approved public/images/job-header-customer-support.png (1678 × 937 RGBA). The patch covers the three code files; the PNG is already present in your checkout.

Customer Support, Customer Service, their punctuation/case/separator variants, Customer Care and Customer Success use the dedicated image. Other categories retain the existing illustration. Add future images and aliases to categoryArtworks. Displayed category and employer text remain untouched.

Desktop uses the existing roughly 38% artwork column; tablet reduces it to roughly 31%; artwork hides at 760px and below. The image has no container background, border or crop and is capped at 640 CSS pixels. Its own globe replaces the duplicate globe behind the artwork. Existing title highlight, eyebrow, accents, chips, folded corner and tagline remain HTML/CSS.

## GitHub Desktop

1. Select va-jobs-ph-web. Changes are applied locally if checkout write approval was granted. Otherwise extract changed-files into C:\Users\gmrea\Documents\GitHub\va-jobs-ph-web, preserving folders.
2. Review the three code files. The PNG should have no diff if already committed. Select only these files (plus the PNG if it is untracked); leave unrelated work out of the commit.
3. Commit with summary: Use approved Customer Support header artwork.
4. Click Push origin. Follow your existing hosting deployment process. GitHub Desktop pushes commits; it does not itself deploy the Worker. No production deployment was performed by this task. No database migration or backfill action is needed.

## Validation

- 14 focused header, At a glance and Quick Read presentation tests passed.
- Local browser geometry checks passed at 1440, 900, 760 and 390px for normal and very long title/company text. Desktop and mobile screenshots are supplied separately.
- npm run build passed (Wrangler deploy --dry-run only).
- Full suite: 162 tests, 153 passed, 5 failed, 4 skipped. Baseline: 160 tests, 151 passed, the same 5 failed, 4 skipped. Existing failures: daily-digest default-disabled assertion; worker search quoting; script application URL assertion; search page canonical; original application link assertion. These frozen areas were not edited.
- Artwork bytes are unchanged. No production calls, live backfill, database changes or deployment.
