# Résumé Studio 2.0 — focused usability release

## Assessment and priorities

Inspected the existing controller, styles, parser, photo pipeline, PDF/DOCX engines, server route, budget gate and `docs/resume-studio-launch.md`. The existing free editor already supplies live A4 pagination, twelve designs, local photo cropping, draft-file import/export and explicit privacy guidance. These are retained. The launch notes mention draft switching, but the source only supported restoring downloaded drafts.

1. Follow the approved dashboard mockup with a compact cream/mint illustrated hero, prominent Build My Résumé and Improve My Résumé actions, exact shared brand/navigation and five steps: design, personal info, experience, education/skills, review/download. The generated decorative illustration uses a pure-black dog; all headings, copy, actions and steps remain accessible HTML. The official logo is served only from the unchanged shared header asset.
2. Eight simultaneous fields made mobile progress hard to follow. Group existing native section disclosures into the five-step flow, keep added/optional cues and previous/next controls, and preserve direct field links from review prompts. Steps never require optional sections or reset content. All five mobile steps remain visible together; preview fits the page width.
3. The checklist was identical for every document. Add explainable browser-only checks for missing contact/name/role/skills/experience, malformed email/phone, incomplete LinkedIn URLs, missing/mixed dates, reversed year ranges and vague responsibility statements. Each prompt links to its field. These are heuristic prompts, never a score or hiring prediction. No automatic rewriting.
4. Add up to ten in-memory drafts, duplication and switching, preserving sections, design, accent, crop and unparsed source. Import and clear actions warn before replacing current work. Draft files also preserve unparsed source while remaining compatible with older files. Recovery is optional and off by default: explicit consent enables autosave to this tab's sessionStorage, never to a server or account. On refresh/navigation, users are offered a restore action rather than silently replacing their draft. Recovery is bounded, expires after 24 hours, validates draft/photo/source data, reports storage/quota errors without clearing open drafts, and can be removed. Downloaded drafts remain the durable backup. No localStorage, IndexedDB, account saving or résumé upload is introduced. Unprotected nonempty drafts trigger the browser's leave-page warning.
5. Preserve the live preview and current export engines. Guard printing while pagination is pending. Native summaries/buttons/selects retain keyboard support and visible focus, and new controls have 44px minimum targets and narrow-screen wrapping.

## Release boundary

Based on the already deployed `feature/cream-header-redesign` branch, commit `7dd764c`, because main lacks the deployed cream header/Learning Hub. Relative to that baseline only Résumé Studio files, this document, tests and the isolated staging config change. No logo, header, Learning Hub, Traffic Waves, payment, registration, Quick Reads, schema or production runtime settings change.

Production baseline inspected: `f31e8a99-c9b6-41d6-99d6-831e632de136`. Do not deploy the generic repository config to production: launch notes correctly state it is not a full live configuration snapshot. Recheck active version immediately before any activation, preserve all live bindings/settings/schedules, and record rollback. No production activation is part of this staged review.

Staging uses a separate Worker, no credentials/database bindings, no cron schedules, and disabled AI/payments/background jobs: `https://veeays-resume-studio-preview.gm-realcommph.workers.dev/resume-studio`. It is intended for the public free résumé journey; signed-in/payment workflows are not staging acceptance targets.

## Future Pro AI review plan — disabled

Keep `RESUME_AI_ENABLED=false`. No provider calls or activation in this release. Future review belongs only to existing Pro at ₱499/30 days, with no new tier and no restriction on the free editor, checklist or downloads. A later explicit activation decision must validate:

- An intentional request and per-request consent before sending minimized text; never on typing, autosave, opening a draft, or exporting. Photo excluded. Account entitlement checked server-side.
- Exact source quotations, clear suggestions and review-before-apply editing. Reject invented skills, employers, qualifications and results. No fabricated ATS scores or employment guarantees.
- The existing fail-closed durable global reservation, a reviewed maximum cost per attempt, global ceiling, five attempts per 30-day user window, 60-second cooldown, duplicate-content guard, bounded input/output, timeout and no automatic retries/fallback providers. Charge failed attempts against reservations; alert and disable at budget exhaustion. Validate model/pricing and worst-case bounds before approval.
- Clear cancellation, stale-result rejection, provider failure behavior, retention wording and abuse tests. Résumé content and provider output must never enter analytics, application logs or budget storage.

Existing provider plumbing remains unchanged and hidden. Future activation needs separate security, cost and quality review and explicit user approval before any paid AI request.

## Validation

Final mockup/recovery regression run: 501 tests, 497 passed, four skipped, zero failed. Final focused run: 30 passed. Build dry run passes. Twelve PDF designs pass multi-page content, bounds and A4 tests. Twelve DOCX styles pass long content/final-marker preservation, XML escaping and A4 checks. The earlier native browser matrix completed all 24 design/format combinations using a long résumé; final staging PDF and DOCX smoke downloads also succeeded with a recovered cropped photo. Staged tests restored two independent draft names, unparsed source, design, photo and crop, and offered recovery after refresh and back navigation. Removing recovery leaves open drafts intact. Downloaded draft files round-trip unparsed source and mode. No document overflow at 320, 390, 768, 850, 1100 and 1440 pixels; all five steps fit each tested width. Default editor begins at approximately 712px on desktop and 798px at 390px phone width. Desktop/mobile top and full-page before/after captures accompany the delivery report. Disabled review endpoint rejects without provider access.

Native Microsoft Word visual pagination and a real screen-reader session remain unverified. The readiness checker cannot establish whether a contact address is deliverable or whether claims are true, and cannot interpret every free-form date notation. It provides review prompts rather than a certification.
