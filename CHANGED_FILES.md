# Changed repository paths

Modified existing V1 files:

- `src/data.js` — detail-only enrichment RPC; hash-bound stored output; rollout-safe Original fallback.
- `src/job-detail-read.js` — validate/render stored Quick Read using the V1 contract; authoritative At-a-glance formatting.
- `src/render.js` — pass stored output; decorative logo with initials placeholder and local module.
- `src/worker.js` — protected single-job/manual batch route only; existing scheduled handlers unchanged.
- `public/styles.css` — scoped logo fallback styles only.

Added:

- `src/quick-read-generation.js` — source organizer, strict schema/content validation, SHA-256 and OpenAI Responses adapter.
- `src/quick-read-service.js` — authenticated operator endpoint, database claims and persistence, bounded manual batch.
- `public/job-detail-logo.js` — load/error/decode fallback.
- `migrations/004_job_quick_read.sql` — private cache/control tables and security-restricted RPCs.
- `scripts/generate-quick-read.mjs` — single-job operator command.
- `scripts/quick-read-verification.sql` — Supabase preflight and post-migration checks.
- `test/quick-read-generation.test.js` — provider/content validation, real-source acceptance, generation/batch behavior, formatting/logo tests.
- `test/quick-read-db.test.js` — migration, grants, eligibility/dedupe gate, leases, cooldown, rate limits and source changes.
- `test/quick-read-data.test.js` — safe projection, revision binding and missing migration/corrupt-output fallback.
- `test/fixtures/technologyadvice-37688.txt` — publicly observed original coordinator description, October 3, 2026; no model output.
- `QUICK_READ_SETUP.md` — deployment/setup/one-job acceptance/backfill instructions.
- `CHANGED_FILES.md` — this manifest.

No package, wrangler, cron, existing migration or frozen-system files are included in the patch. Existing `src/quick-read.js` deterministic formatter remains unchanged for compatibility/tests; production detail rendering passes explicit stored output or null and performs no LLM generation on page requests.

See the accompanying `baseline-hashes.json` for SHA-256 of the five existing files from the saved preceding V1 snapshot and their patch replacements. Compare against the current GitHub checkout before overwriting; the current remote revision was not supplied.
