# Public Résumé Studio launch

This release makes the résumé editor and PDF/DOCX downloads free for everyone at `/resume-studio`. A shared navigation link exposes the page on desktop and mobile. The editor clearly states that AI review is unavailable at launch; its controls are hidden and direct requests return 503 before any account or provider request.

All twelve approved portrait A4 designs, optional photo/crop controls, draft switching and client-side exports are included. Résumé text and photos stay in browser memory unless downloaded. No résumé database or upload service is added. DOCX is explicitly a simpler editable single-column alternative; it does not reproduce the PDF compositions. Direct PDF font support remains Latin-script. The UI preserves the official VeeAys logo and tagline.

## Activation

- Enable `RESUME_STUDIO_ENABLED=true`.
- Explicitly set `RESUME_AI_ENABLED=false`.
- Preserve every existing production secret, binding, flag, schedule, asset and runtime setting. The repository's generic config is not a complete snapshot of live configuration.
- No migrations or résumé budget binding are required for this free launch. The optional budget configuration is review-only and must not be applied.
- Capture the currently active version immediately before activation; abort if it differs from the reviewed baseline. Record a rollback target and verify public page/assets/downloads after activation.
- Future Pro AI activation requires a separate implementation and validation decision. This release does not authorize paid calls.

## Verification

- Full suite: 475 passed, 0 failed, 4 skipped (479 tests total).
- Dry-run build passes.
- Native browser downloads for all 12 PDF/DOCX styles; all 12 long CV PDFs have three A4 pages with final content markers intact.
- Mobile editor/preview and switching checked at 390 × 844.
- Shared navigation checked at widths 390, 850, 1024, 1101, 1180 and 1480 with no document overflow.
- Compared bundle declarations to live Worker version `b85c2518-2966-40df-a46b-98d9ec3da17e`: only existing `layout`, `handle`, and exports change; all other existing declarations remain identical. New declarations belong to Résumé Studio.
- The existing Pro visibility test expected an obsolete mobile-header structure. Updated it to check the current shared mobile menu and tolerate its crown icon, without changing Pro behavior.
- Tests exercise public access and disabled-AI rejection without account/database/provider access.

The original local design-review files and earlier reports predate the free-launch decision. This document supersedes their public-release and entitlement blockers for the AI-disabled editor. Native Microsoft Word rendering remains unverified; the simpler Word export is labelled accordingly.
