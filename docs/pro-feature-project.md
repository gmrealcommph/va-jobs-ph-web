# Current business rule — 23 October 2026

The owner has superseded the older Pro+AI proposal below: one Pro tier only, ₱499 for 30 days, no automatic renewal. All new Pro tools use existing active entitlements. Paid AI requires separate spending authorization, never another membership tier. See pro-phase-one.md for current work.

# VeeAys Pro project — 19 October 2026

## Focused inventory

- Baseline: main fff908585bed48e2fec0746040bce6b7186fbf29, production deployment 7132282b-d006-4e45-8d89-b707f9d6262d.
- Public search supports keywords, category, and category sorting. Saved jobs are separate from search presets. This release adds five saved keyword/category slots, editable names and deletion, with database ownership and active-Pro write enforcement. Slots make the maximum atomic under concurrent writes. Permanent Pro grants remain valid; expired presets are retained and deletable. Account deletion cascades. No email opt-in is implied.
- Entitlements come from protected profiles.plan, plan_status and pro_expires_at. Existing PayMongo checkout remains a one-time PHP 499 purchase for 30 days. Free browsing, saved jobs, applications and the three-match allowance are preserved.
- Existing /my-jobs application tracker already supports Applied, Interview, Offer, Rejected, Hired and Withdrawn plus 2,000-character notes. Existing ownership policies protect reads and writes. Keep this available free; do not duplicate it or move it behind a paywall.
- Existing /email-preferences supports strong-match and daily match email opt-in. The newer /job-alerts supports categories, employment types, salary preferences, daily Pro or weekly free delivery and explicit separate consent. Contrary to the older personalized-job-alerts.md candidate note, its private schema and member RPCs ARE installed in production. Settings: two records, one enabled and unsuppressed at inventory time. No recipient data exported.
- The newer sender remains gated off by JOB_ALERTS_MODE=disabled and database control.enabled=false. Database quotas are 40 attempts/day and 1,000/month. Sender code requires both legacy modes disabled, a sender mailing address, and a dedicated signed webhook secret. Neither JOB_ALERTS_SENDER_ADDRESS nor JOB_ALERTS_WEBHOOK_SECRET exists in production bindings. Existing lifecycle webhook is a separate endpoint; do not silently repurpose it. Activation is blocked pending the actual business address, provider webhook provisioning/verification, capacity check and controlled delivery validation. No consent migration, email send or sender switch in this release.
- Existing OpenAI Quick Reads process public job descriptions. They do not establish a private CV pipeline, CV retention policy, per-member CV budget, or a Pro+AI entitlement/payment product. No CV upload, matching endpoint, storage, tier or checkout is introduced. AI CV matching remains unavailable until those contracts, privacy/retention/security controls and measured cost limits are validated. PHP 750/30 days is proposed only; separate explicit launch/charging authorization is required.

## Validation and release scope

Saved-search endpoint tests and an isolated PostgreSQL-compatible test cover entitlement expiry, anonymous denial, cross-account isolation, owner reassignment rejection, sixth-slot rejection, atomic replacement, deletion after expiry and account deletion cascade. Related navigation, application panel, Pro visibility and email sender tests pass. Two pro-discovery copy assertions already fail on unchanged main; the baseline reproduction is retained locally. The release uses an exact snapshot of production variables, compatibility flags and four cron schedules; secrets remain bound by name. No matching, ingestion, freshness, payment or scheduled email logic changes.

## Pending work

1. Activate and validate the existing configurable alerts only after the missing sender/provider requirements are supplied.
2. Design and validate private CV processing, deletion/retention, explainable matching, malicious-document handling, usage/cost enforcement and separate Pro+AI entitlements. Keep unavailable until validated; no new tier or charge without explicit authorization.
