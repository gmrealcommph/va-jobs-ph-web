# VeeAys approved homepage artwork

Prepared against va-jobs-ph-web commit 9575a10 (Add safe overnight Quick Read backfill mode).

Changed files only:
- public/veeays-hero-approved.png — original supplied transparent 1591 × 989 PNG, 1,540,514 bytes; byte-for-byte unchanged.
- public/styles.css — scoped responsive artwork frame; crops empty left space without altering the source; caps visible artwork at 580 CSS pixels, preserves roughly 2x density; disables artwork transforms/animation.
- src/render.js — uses new artwork, intrinsic dimensions and descriptive alt text; removes old overlaid decorative labels; updates stylesheet cache version.

Existing navigation, HTML headline, Explore opportunities anchor, search form and listing behavior are preserved. Quick Read, backfill, matching, auth, payments, database, collectors and deployment configuration are unchanged.

## Apply with GitHub Desktop
1. Open your existing va-jobs-ph-web repository in GitHub Desktop. Review any pending changes, then create a branch named homepage-approved-hero from your current intended release branch.
2. Choose Repository → Open in Terminal. Run these commands with the full path to the supplied patch (quotes are required):

   git apply --check "C:/Users/gmrea/Documents/Codex/2026-10-06/referenced-chatgpt-conversation-this-is-an-2/outputs/hero-install/veeays-hero.patch"
   git apply "C:/Users/gmrea/Documents/Codex/2026-10-06/referenced-chatgpt-conversation-this-is-an-2/outputs/hero-install/veeays-hero.patch"

   If the check fails, stop; your checkout differs from the prepared baseline. Do not overwrite whole files or force the patch. The changed-file copies are included for review, not to overwrite unrelated pending work.
3. In GitHub Desktop, review the three changed files and commit with “Install approved VeeAys homepage artwork”. The patch includes the PNG.
4. Publishing/pushing can trigger deployment depending on your repository setup. Wait until the current Quick Read backfill has finished before taking any action that deploys a new Worker. Publish the branch and open a PR when appropriate; merge only through your normal release process after reviewing the diff.
5. After the backfill finishes, use the existing deployment process. If it is a manual deployment, run npm run build first, then npm run deploy only when ready. Do not change cron settings, reset the backfill, run migrations, or rerun collectors for this artwork change.
6. Check the homepage on desktop/mobile: one HTML hero CTA, new collage with all benefit cards visible, working anchor/search/navigation, and no horizontal scrolling.

## Validation
- Deployment dry run: passed; no upload/deployment performed.
- JavaScript syntax and git diff whitespace checks: passed.
- Full tests: 154 total; 143 passed, 4 skipped, 7 failed. The unmodified baseline returned identical totals and the same seven failures, in digest activation, existing Quick Read source boundaries (41645/43635), and worker search/detail expectations. Frozen functionality was not edited to address them.
- Browser layout checks: 1440, 850, 601, 390 and 320 CSS pixels at 2x device density; correct intrinsic source size, frame ≤580px, no horizontal overflow, image animation disabled, and CTA href retained.
- Desktop/mobile screenshots visually reviewed. Screenshots use a static homepage fragment with no live database requests or page scripts.
- Source PNG SHA-256: 4013E3C5073BBF1767B88773A85D7413072BCE3343E6186BFF6B3345591360F0.

No production endpoint or backfill control was called. This package is a local integration only.