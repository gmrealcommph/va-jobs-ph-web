# Résumé Studio 2.0 — focused usability release

## Assessment and priorities

Inspected the existing controller, styles, parser, photo pipeline, PDF/DOCX engines, server route, budget gate and `docs/resume-studio-launch.md`. The existing free editor already supplies live A4 pagination, twelve designs, local photo cropping, draft-file import/export and explicit privacy guidance. These are retained. The launch notes mention draft switching, but the source only supported restoring downloaded drafts.

1. Writing started below twelve design choices and photo controls. Keep those existing controls in a native disclosure so the first task is writing.
2. Eight simultaneous fields made mobile progress hard to follow. Add native section disclosures, visible added/optional cues, previous/next controls and direct workflow shortcuts. Keep every section reachable without compulsory completion.
3. The checklist was identical for every document. Add explainable browser-only checks for missing contact/name/role/skills/experience, malformed email/phone, incomplete LinkedIn URLs, missing/mixed dates, reversed year ranges and vague responsibility statements. Each prompt links to its field. These are heuristic prompts, never a score or hiring prediction. No automatic rewriting.
4. Add up to ten in-memory drafts, duplication and switching, preserving sections, design, accent, crop and unparsed source. Import and clear actions warn before replacing current work. Draft files remain the durable backup; refresh/navigation clears tab memory. No localStorage, IndexedDB, account saving or résumé upload is introduced.
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

Rebased baseline regression run: 496 tests, 492 passed, four skipped, zero failed; added controller syntax check and final targeted rerun recorded in the delivery report. Build dry run passes. Twelve PDF designs pass multi-page content, bounds and A4 tests. Twelve DOCX styles pass long content/final-marker preservation, XML escaping and A4 checks. Native browser downloads completed for all 24 design/format combinations using a long résumé. Desktop 1440px and mobile 390px visual and keyboard/section/checklist/draft flows inspected. Disabled review endpoint rejects without provider access.

Native Microsoft Word visual pagination and a real screen-reader session remain unverified. The readiness checker cannot establish whether a contact address is deliverable or whether claims are true, and cannot interpret every free-form date notation. It provides review prompts rather than a certification.
