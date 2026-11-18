-- Read-only operator snapshot. Repeat immediately before cutover and after drain.
select now() as sampled_at_utc, v3_enabled, v3_start_at, v3_daily_cap, v3_cycle_cap,
       v3_cycle_start, v3_cycle_end, v3_next_send_at
from veeays_lifecycle.control where id;

select count(*) filter (where lease_until>now() and state in ('leased','sending')) as active_leases,
       count(*) filter (where first_attempt_at is not null and accepted_at is null
                         and state in ('sending','held')) as unresolved_attempts,
       count(*) filter (where state='accepted') as accepted_total,
       count(*) filter (where coalesce(first_attempt_at,accepted_at)>=date_trunc('day',now(),'UTC')) as utc_day_debits,
       count(*) filter (where coalesce(first_attempt_at,accepted_at)>=v3_cycle_start
                         and coalesce(first_attempt_at,accepted_at)<v3_cycle_end) as cycle_debits
from veeays_lifecycle.deliveries cross join veeays_lifecycle.control where veeays_lifecycle.control.id;

select day_utc, state, step, code, count(*) as attempts
from (
  select date_trunc('day',coalesce(first_attempt_at,accepted_at),'UTC') as day_utc, state, step, code
  from veeays_lifecycle.deliveries
  where coalesce(first_attempt_at,accepted_at)>=now()-interval '7 days'
) recent
group by day_utc,state,step,code
order by day_utc desc,state,step;

select count(*) filter (where created_at>=now()-interval '24 hours') as suppression_events_24h,
       count(*) filter (where v3_complained_at>=now()-interval '24 hours') as complaints_24h
from veeays_lifecycle.provider_events;
