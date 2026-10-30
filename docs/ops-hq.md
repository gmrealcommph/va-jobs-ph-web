# Operations HQ (`/admin/ops-hq`)

Read-only animated office scene fed by `GET /admin/api/ops-hq`. Admin-only (session + `veeays_admin_access`).
No migrations, no new tables, no writes.

## Contract
Structure follows the agreed Section M contract (`generated_at`, `stale`, `metrics{intake,jobs,reads,pro,refer,comms,health,chief}`, `events[]`).
Unavailable metrics are `null`; the scene shows "—" / "Unknown". Nothing is estimated or invented.

## Metric sources
| Metric | Source | Notes |
|---|---|---|
| intake.new_today / total / growth_pct | `veeays_admin_analytics` (`daily`, `members`) | Asia/Manila day; growth vs yesterday, null if yesterday = 0 |
| jobs.active / new_today | `veeays_admin_analytics` (`live_jobs`, `daily.jobs`) | |
| jobs.processing | none | null |
| reads.queued / running | `veeays_admin_quick_reads` `counts.queued` / `counts.processing` | |
| reads.ready_total / failed | `veeays_admin_quick_reads` `all_reads.ready` / `all_reads.failed` | all `job_quick_reads`, not only the auto queue |
| reads.stopped | `veeays_admin_quick_reads` `counts.stopped_other` | queue rows with `state='stopped'` whose Quick Read `status` is **not** `failed` (includes no read row, e.g. `previously_attempted`). Disjoint from the queue's own failed count. See `migrations/admin-quick-reads.sql` lines 18-24 |
| pro.active | `veeays_admin_analytics` `pro_access` | |
| pro.upgrades_today | `veeays_admin_payment_snapshot` (live, confirmed, PHP, last 24h, filtered to today in Manila) | |
| pro.expiring_7d | `veeays_admin_extended` `members.expiring_7d` (from `profiles.pro_expires_at`) | |
| comms.accepted_today | `veeays_admin_extended` `email.accepted_in_period` (period = today) | digests + strong-match batches only; provider acceptance, **not** delivery |
| comms.delivered_today / suppressed_or_bounced_today | none | Resend delivered events are only logged; bounces are stored without a date |
| refer.verified_signups / eligible_conversions | `veeays_referral_admin_analytics()` `referred_signups` / `eligible_pro_conversions` | existing admin RPC; counts `attributions.verified_signup_at is not null` and `pro_conversions.status='eligible' and is_test=false`. Read-only, admin-gated |
| refer.on_hold | length of `veeays_referral_admin_dispute_hold_dashboard().active` (commissions with `dispute_hold`) | only the count is used; hold reasons and ids are never forwarded |
| chief.* | none | no source |
| health.database | **Admin RPC availability only**: all 5 admin RPC sources answered (healthy), some failed (warning), none (critical). Shown in the scene as "Admin data". It says nothing about Supabase as a whole (auth, storage, realtime, other schemas) | |
| health.edge | **Quick Reads processing only**: the minute-cron Quick Read worker is draining its queue (oldest due item < 10 min healthy, < 30 warning, else critical); `unknown` when automation is disabled. Shown as "Reads worker". It says nothing about Cloudflare or the other Workers/crons | |
| health.queue_depth / alerts | `counts.queued`; failed sources + late worker + unmatched running reads | |

## Events, paging and reconnection
Contract fields are unchanged. Two backward-compatible fields were added: `has_more` (boolean) and `incomplete` (boolean).
- `?since=` is inclusive. Events are returned **oldest first**, 60 per page; a page may grow (up to 200) to finish a group of equal timestamps, so no event is split or skipped. `has_more: true` means call again with `since` = last event's `occurred_at`.
- `incomplete: true` means an event source was unavailable or hit its own row cap (200 registrations/payments, 12 recent Quick Reads); events may be missing. Metrics are unaffected.
- Event ids are stable (`reg:`/`pay:` + hash, `qr:` + event + job id + time) and unique per payload.
- Client: new-ness is decided by event id, never by timestamp. It requests `since` with a 2-minute overlap (catches late-committed rows) except while paging (`has_more`), polls again after 1.5 s while `has_more`, and treats first load, a gap of more than 5 minutes (sleep/offline) and the whole catch-up as **silent**: numbers update, history is not replayed as animations. Reactions are grouped per desk/type (`×N`), max 4 per poll.
- Live reactions and previews never change a counter. Counters change only in offline demo mode. Turning live data off restores the simulated baseline, so real numbers are never decorated with simulated ones.

## Referral and Communications sources (verified on staging `megedmsfdwtjxjejrxaq`, read-only)
The `veeays_referral`, `veeays_lifecycle` and `veeays_campaign_analytics` schemas exist on staging. Verified status values: commissions `pending|approved|rejected|paid|reversed` (+ `dispute_hold` boolean, `is_test`), pro_conversions `eligible|ineligible|reversed`, payout_requests `pending|approved|rejected|paid|cancelled`, lifecycle deliveries `pending|leased|sending|accepted|held|skipped`.
No referral payout, program or policy RPC is ever called; only the two read-only count sources above. Production has not been inspected: confirm the same RPCs and columns exist there before production.
Communications: no existing admin RPC counts lifecycle email deliveries (`veeays_lifecycle.deliveries`) or Resend delivered/bounced events, so those stay `null`. A new admin RPC would need a migration and your approval.

## (Superseded) Unverified schemas
`veeays_referral`, `veeays_campaign` and `veeays_lifecycle` exist in the production Supabase database but are
**not in this repository** and this build had **no database access**, so their tables, columns and status values are
NOT VERIFIED. Referral and Communications metrics beyond `accepted_today` therefore stay `null`.
No replacement tables are proposed. To close the gap, someone with read access should run (read-only):

```sql
select table_schema, table_name, column_name, data_type
from information_schema.columns
where table_schema in ('veeays_referral','veeays_campaign','veeays_lifecycle')
order by 1,2,ordinal_position;
-- plus: distinct status/state values per candidate table, and the existing admin RPCs (if any) that read them.
```
Metrics should be added only through an admin-gated `SECURITY DEFINER` RPC in the existing `veeays_admin_*` style, after review.

## Load on Supabase
One shared cache per Worker isolate serves all admins, tabs and devices; concurrent requests share one in-flight refresh.
- fast tier, every 15 s at most: `veeays_admin_quick_reads` (5 s timeout), `veeays_admin_registration_snapshot`, `veeays_admin_payment_snapshot`
- analytics tier, every 60 s at most: `veeays_admin_analytics` (same lifetime as the main dashboard cache)
- slow tier, every 120 s at most: `veeays_admin_extended` (heaviest)
Worst case per isolate: 3 + 1/4 + 1/8 ≈ 3.4 calls per 15 s. Quick-reads monitor already polls every 15 s today.
Failures are cached for the tier interval (no hammering during an outage). The per-user 30/min limit and `ADMIN_API_LIMITER` still apply.
Several isolates each keep their own cache, so peak load scales with active isolates, not viewers.

## Assets, licensing, performance
- Eight 3D character/desk models (`public/ops-hq/m_*.bin`), all generated with **Tripo** (GLB `asset.generator` = `Tripo`; no licence text in the files).
  **Commercial-use rights could not be verified from here.** Before production, confirm in the Tripo account that generated each model:
  the plan active at generation time grants commercial use, and the models were not generated as public/CC-licensed.
  Keep the account export/receipt with the project records. Source GLBs are not committed.
- `three.min.js` r128 is MIT licensed (header preserved).
- Page load: HTML ≈ 3 KB, CSS 6 KB (2 KB gz), JS 38 KB (15 KB gz), three.js 603 KB (149 KB gz), background 331 KB, 8 models 26.6 MB (already gzip-packed; decompress to 53 MB in the browser).
  First visit ≈ 27.6 MB; models load in parallel. Static assets use Cloudflare's default validation caching (ETag, revalidate), so repeat visits are 304s.
- Scene weight: 1.25 M vertices, 2.56 M triangles total. Estimated ~150 MB RAM+GPU (vertex buffers ≈ 76 MB on GPU plus typed arrays on the JS side). Continuous 3D rendering, paused while the tab is hidden. Not measured on a MatePad 11.5 PaperMatte; the earlier local build ran on it.
  If frame rate or memory is a problem on the tablet, the fix is a lower-poly model set (re-decimate), not a code change.
