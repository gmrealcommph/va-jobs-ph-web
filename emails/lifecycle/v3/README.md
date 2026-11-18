# VeeAys lifecycle v3

The source of the ten lesson bodies and subject lines is the delivered Resend DESIGN TEST v3 batch. The compact white header and responsive logo CSS come from the approved Day 3 MOBILE FORMAT TEST. Subjects omit the preview prefix. Bodies omit preview notices and include an unsubscribe slot. The Free variants preserve the approved Pro promotion. The Pro variants remove the upgrade block and upgrade-only links and also serve as the education-only option for Free members with tips consent alone. See `schedule.mjs` for the exact milestone, stable delivery key, subject, Resend draft alias and ID.

Each day covers one elapsed 24-hour window measured from original registration. A skipped window expires. The candidate requires confirmed email and current, timely tips consent for every milestone. Free-member promotion additionally requires timely Pro consent. The send path must substitute the existing member-specific HTTPS unsubscribe URL and preserve one-click headers. Where applicable use the verified business mailing address before activation.

## Integration status

The deployed site Worker still has lifecycle settings and routes but its current scheduled handler does not invoke the legacy lifecycle sender. The historical implementation is in commit `4b11e28` under `src/lifecycle-*.js`. The separate `veeays-welcome` Worker has its own schedule and receipt workflow. This branch contains template assets and a tested candidate selection policy. It contains no production Worker, cron, or database changes.

Before connecting the sender, reconcile the deployed Worker with the recovered source and update the staging database claim/check/start contract to use the same ten exact-day windows. Retain stable historical keys, the existing unique member/step ledger, atomic claim and last-minute eligibility checks, immutable payloads, provider idempotency and ambiguity holds. Test suppression from both existing preference stores and ensure Day 0 shares an atomic receipt/reservation with the separate welcome flow. A prior legacy welcome receipt blocks lifecycle Day 0.

The existing RPC applies a 48-hour lifecycle gap and 48-hour post-confirmation wait. That blocks Day 0 and can block Day 3 following Day 2. Reconcile the gap with the requested cadence, validate in staging with fake recipients, and keep the current broadcast and alert coordination before connecting real sending. The live Worker caps (5/day, 50/month) also differ from database caps (500/day, 10,000/month), which fails the recovered sender's readiness equality check. Confirm the intended limits before activation. No catch-up enrollment or replay.

Run `node --test emails/lifecycle/v3/schedule.test.mjs` from the repository root. Resend assets are saved as drafts.
