# Production source reconciliation — 12 October 2026

Baseline GitHub main: `ed4b7860616841db6261038105838d93ebadb993` (8 October). Production was ahead of GitHub through direct Worker uploads.

## Recovery method

The compiled Worker alone is **not** equivalent to maintainable original source. Its multipart export contained only `worker.js`; the referenced source map was absent. We located an October 10 local build map containing the original `sourcesContent` for all 31 bundled modules. These originals, the later authored October 10 admin module, and the authored October 12 Delete Account module were recovered. Small, identified production-only authentication and scheduler patches were ported into the source modules. Account deletion now imports its dependencies explicitly rather than relying on globals appended to a compiled bundle.

No source module or known deployed static asset remains unrecovered. The original pre-build files for the small direct-bundle patches were not available as a separate revision; their source equivalents were reconstructed from the bounded production diff and verified structurally. This is a reconciled source revision, not a claim that the October 12 deployment had a matching historical Git commit.

Recovered features include session recovery and auth redirects; Pro entitlements and one-time PayMongo checkout/webhooks; Quick Read request bounds, diagnostics and minute schedule; admin analytics/layout/alerts/traffic; scheduled email functions; account deletion, checkout closure, confirmation UI and disclosures. Existing migrations plus the authored admin/payment/deletion migrations were retained. No production migration was run, and this recovery does not claim a complete fresh-database restoration from migration history.

## Evidence and validation

The reference production Worker SHA-256 is `97dedca2d7be6dfc88105867fe6ca58fc6cb90159b6e5f24a7318df97b34399e`.

- `evidence/production-20261012/worker.reference.mjs` is archived compiled evidence only. Edit `src/`, never this reference.
- `source-provenance.json` records the recovered original module hashes.
- `assets.json` records successful read-only retrieval and SHA-256 checks for 57 known assets, all matching local originals. This inventory was derived from repository files and production references; it is not a server-provided listing of arbitrary unreferenced asset keys.
- `pnpm run verify:production` builds locally and compares all 260 declarations and seven startup statements against the archived production code. The comparison ignores source locations/raw escape spelling, compiler naming helpers, six documented collision aliases, object shorthand syntax, and top-level declaration-kind lowering. It does not ignore strings, branches, calls, arguments, or expression structure.
- Tests: 379 total; 375 passed, 4 intentionally skipped, 0 failed. Includes synthetic HTTP and local transactional SQL account-deletion tests, auth recovery, payment/Webhook/entitlement boundaries, Quick Reads, admin analytics and traffic tests. No real payment, email send or real-user deletion was performed.
- Stale inherited tests were updated to use the allowed model with mocked requests, current auto-claim RPC names, current one-time payment disclosures, the internal apply route, production schedule configuration, whitespace-tolerant canonical assertions, and stable LF capture fixtures. The production code was not changed to satisfy obsolete expectations.

## Configuration and no-deployment safeguard

The live Worker bundle, exported configuration, schedules and deployment metadata are backed up outside Git in the originating chat's outputs. Secret values are not exportable: only their names/types are backed up, and the existing encrypted bindings remain in Cloudflare. Runtime variables are preserved with `keep_vars`; the test email and manual-target configuration stay outside Git. No credentials or raw account configuration were committed.

The deployed cron strings are `*/15 * * * *`, `* * * * *`, and `0-59 * * * *`. Cloudflare's Git integration targets main and normally runs `pnpm run build` then `npx wrangler deploy`. The owner explicitly approved setting **Disable builds = on** before Git synchronization. Leave it on until a future deployment is explicitly authorized. No Worker upload, route change, cron change or database write is part of this reconciliation.

Job freshness remains a separate change. Do not enable automatic hiding, change member visibility, or deploy it without source-verification review and approval of hiding rules. The prior 2,315 visible-job count is a live-data snapshot, not a frozen database; existing unrelated imports may continue normally.

## Maintenance

Use the pinned pnpm lockfile. `pnpm test` runs local tests; `pnpm run build` is a dry run. Keep secrets in Cloudflare, never in committed files. The parity command is a historical recovery gate and intentionally fails after legitimate future behavior changes; retain it as evidence and add/change feature tests for subsequent releases rather than rewriting the production reference.
