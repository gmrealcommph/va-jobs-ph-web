# VeeAys Learning Hub — phase 1

21 October 2026, Manila. Based on main `07d399a1a46709dfbad808f1a0a3d261b41e96c6`.

## Preview and scope

Staging: https://veeays-learning-staging.gm-realcommph.workers.dev/resources

This is a separate Worker using staging Supabase `megedmsfdwtjxjejrxaq`, its publishable key, no secret bindings, and no cron schedules. It does not overwrite another staging feature. Robots disallow crawling; page metadata is noindex with future production canonicals. No production deployment, merge, production database write, migration, payment, email, or AI generation was performed.

The existing source uses a server-rendered Cloudflare Worker with a shared layout, original `/veeays-logo.png`, public company/legal pages, Résumé Studio, and member navigation. Source and the live homepage were inspected. No dedicated career-advice library was found. Existing job Quick Reads describe individual vacancies; this library contains general original editorial guidance and leaves Quick Reads unchanged.

## Pages

All routes are public, free, and require no signup:

| Route | Topic |
| --- | --- |
| `/resources` | Learning Hub with three populated category sections |
| `/resources/getting-started-with-remote-work` | Setup, realistic expectations, work habits, seven-day starting plan |
| `/resources/finding-your-remote-work-niche` | Transferable tasks, comparing roles, practice before paid training |
| `/resources/honest-beginner-resume` | Truthful evidence, beginner structure, example bullets, privacy and export checks |
| `/resources/remote-job-applications` | Role fit, tailored message, sending checklist, application tracking |
| `/resources/remote-interview-preparation` | Time zones, setup, truthful stories, practice answers, employer questions |
| `/resources/spotting-remote-job-scams` | Red flags, independent verification, privacy, response after engagement |

Categories: Career Guides (4), Interview Preparation (1), Job Safety (1). Each guide has four substantive sections, a takeaway, contents navigation, a practical exercise, a hub backlink, and a next-guide link. Clear English with light Taglish; no invented credentials, hiring promises, or BIR/legal claims.

Design retains the exact logo and shared shell, forest/mint/cream palette, yellow/orange book artwork, readable serif titles, numbered cards and mint exercise boxes. Artwork is lightweight CSS; no image service or extra dependency. The tagline is “Better Jobs. From Home.” Resources appears in shared desktop/mobile discovery navigation. All existing destinations remain, including member workspace and profile links. A compact spacing adjustment at 1151–1300px prevents the additional destination crowding signed-in navigation.

Metadata includes unique titles, descriptions, canonical links, existing social metadata and seven sitemap entries. Unknown slugs return 404/noindex, valid trailing slashes redirect, unsupported methods return 405, and HEAD has no response body. Static editorial modules require no database fetch for anonymous reading.

## Validation

- Full automated suite: 489 total, 485 passed, 4 skipped, 0 failed.
- Five new tests cover public GET/HEAD routes, no upstream dependency, links/fragments, substantive content, populated categories, navigation states, 404/method/indexing behavior, and sitemap membership.
- Build dry run passes; staging deployment independently bundles successfully (461.96 KiB / 131.37 KiB gzip).
- 56 local browser checks: seven real public routes and one synthetic Pro navigation fixture across 320/390/768/1151/1301/1366/1440px. No horizontal overflow or header overlap; authentic logo decodes at 1200px. Mobile member destinations visible; Enter opens and Escape closes the menu.
- 42 deployed staging responsive checks: all seven pages across 320/390/768/1151/1301/1440px. No horizontal overflow; logo loads. Desktop hub and mobile interview screenshots visually inspected; mobile contents list and shared-header style collisions corrected.
- Staging smoke: all seven GET/HEAD pages 200, matching final stylesheets, 404 unknown slug, 308 trailing slash, noindex metadata, robots disallow. Hosting API confirms staging database, zero schedules and no secrets.
- Whitespace check passes. No end-to-end real member login, payment or registration testing was performed; member navigation used a clearly synthetic local fixture.

## Production readiness

Ready for owner review of staging, not released to production. Keep existing automatic builds paused. Before an authorized production deployment, refresh the production source/configuration baseline and reconcile concurrent changes. Preserve live bindings, secrets, routes, schedules, lifecycle/alert/Quick Read flags, and the single ₱499 / 30-day Pro offer; do not deploy the repository's stale production defaults blindly. Deploy the reviewed source with existing runtime settings only after explicit production authorization, then smoke-test public resources, sitemap, shared navigation, current jobs, Pro, and member access. No new Pro tier or personalized AI coaching is included.
