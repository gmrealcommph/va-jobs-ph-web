-- Phase 1 commits independently so no new attempts can start.
begin;
update veeays_lifecycle.control set v3_enabled=false where id;
commit;

-- Phase 2 is safe to rerun once existing leases drain. Keep provider IDs,
-- payloads, first-attempt timestamps, consent, and both delivery ledgers.
update veeays_lifecycle.deliveries
set state='held', code='ambiguous_after_start'
where state='sending' and first_attempt_at is not null and lease_until<=now()
  and exists (select 1 from veeays_lifecycle.control where id and not v3_enabled)
  and step in (select step from veeays_lifecycle.v3_steps());
