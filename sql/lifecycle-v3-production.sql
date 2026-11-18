-- Production Supabase only. Existing lifecycle tables and receipts are retained.
begin;

-- Keep the old control enabled for cross-sender coordination. V3 has its own gate
-- and UTC activation timestamp. Registration age stays anchored to auth.users.
alter table veeays_lifecycle.control
 add column v3_enabled boolean not null default false,
 add column v3_start_at timestamptz not null default 'infinity',
 add column v3_daily_cap integer not null default 50 check (v3_daily_cap between 1 and 2000),
 add column v3_cycle_cap integer not null default 1500 check (v3_cycle_cap between 1 and 50000),
 add column v3_cycle_start timestamptz not null default 'infinity',
 add column v3_cycle_end timestamptz not null default 'infinity',
 add column v3_next_send_at timestamptz not null default '-infinity';
alter table veeays_lifecycle.provider_events add column v3_complained_at timestamptz;
create index deliveries_attempt_budget_idx on veeays_lifecycle.deliveries
 (coalesce(first_attempt_at,accepted_at)) where coalesce(first_attempt_at,accepted_at) is not null;
do $$
begin
 if not exists (select 1 from veeays_lifecycle.control where id) then
   raise exception 'missing lifecycle control row';
 end if;
 if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='public' and p.proname='welcome_work') then
   raise exception 'legacy welcome RPC exists; verify deployment target and history';
 end if;
end;
$$;

-- Production has no legacy welcome send RPC. Keep this ledger private for
-- verified historical receipts, ambiguous attempts and v3 Day 0 reservations.
create schema welcome_private;
revoke all on schema welcome_private from public,anon,authenticated,service_role;
create table welcome_private.deliveries (
 user_id uuid primary key,
 state text not null check (state in ('pending','accepted','held','skipped')),
 first_attempt_at timestamptz,
 accepted_at timestamptz,
 provider_id text unique,
 outcome text,
 last_reason text,
 updated_at timestamptz not null default now()
);
alter table welcome_private.deliveries enable row level security;
revoke all on welcome_private.deliveries from public,anon,authenticated,service_role;

-- Retire only the old sequence sender entry points. Existing preference,
-- unsubscribe, receipt settlement and other senders' gap RPCs still work.
revoke execute on function public.claim_member_email(uuid),
 public.start_member_email(uuid,uuid,timestamptz) from public,anon,authenticated,service_role;

alter table veeays_lifecycle.deliveries drop constraint deliveries_step_check;
alter table veeays_lifecycle.deliveries add constraint deliveries_step_check check (step in (
 'verify-day-2','verify-day-5','welcome','getting-started','va-skills-lab','profile-tip',
 'pro-introduction','safer-search','interview-tip','resume-tip','follow-up-tip','first-month'
));

create function veeays_lifecycle.v3_steps()
returns table(step text, age_hours integer)
language sql immutable set search_path = pg_catalog as $$
 values ('welcome',0),('getting-started',48),('va-skills-lab',72),('profile-tip',120),
 ('pro-introduction',168),('safer-search',240),('interview-tip',336),
 ('resume-tip',456),('follow-up-tip',576),('first-month',720)
$$;

create function veeays_lifecycle.v3_candidate(p_user uuid, p_step text, p_ignore uuid default null)
returns table(email text, token uuid, variant text)
language sql stable set search_path = pg_catalog as $$
 select u.email, s.token,
   case when p.plan='free' and s.pro and s.pro_at between u.created_at and timing.consent_cutoff
        then 'free' else 'pro' end
 from auth.users u
 join public.profiles p on p.id=u.id
 join veeays_lifecycle.preferences s on s.user_id=u.id
 join veeays_lifecycle.control c on c.id
 join veeays_lifecycle.v3_steps() v on v.step=p_step
 cross join lateral (select u.created_at+v.age_hours*interval '1 hour' as opens) window_start
 cross join lateral (select case when v.age_hours=0 then now() else window_start.opens end as consent_cutoff) timing
 where u.id=p_user and c.enabled and c.v3_enabled and now()>=c.v3_start_at and now()>=c.v3_cycle_start and now()<c.v3_cycle_end
   and u.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   and u.email !~* '@resend\.dev$' and u.deleted_at is null and not coalesce(u.is_anonymous,false)
   and coalesce(u.banned_until<=now(),true)
   and u.email_confirmed_at between u.created_at and now()
   and now()>=window_start.opens and now()<window_start.opens+interval '24 hours'
   and p.plan in ('free','pro') and s.tips and not s.suppressed and s.token is not null
   and s.tips_at between u.created_at and timing.consent_cutoff
   and not exists(select 1 from veeays_alerts.settings a where a.user_id=u.id and a.suppressed)
   and not exists(select 1 from veeays_alerts.deliveries a join veeays_alerts.provider_suppressions e using(provider_id) where a.user_id=u.id)
   and not exists(select 1 from veeays_lifecycle.deliveries d join veeays_lifecycle.provider_events e using(provider_id) where d.user_id=u.id)
   and not exists(select 1 from welcome_private.deliveries w where w.user_id=u.id and (w.outcome in ('bounced','complained','suppressed') or exists(select 1 from veeays_lifecycle.provider_events e where e.provider_id=w.provider_id)))
   and not exists(select 1 from veeays_lifecycle.deliveries d where d.user_id=u.id and d.id is distinct from p_ignore
     and ((d.step=p_step and (d.first_attempt_at is not null or d.state in ('accepted','held','skipped')))
       or (d.state in ('leased','sending') and d.lease_until>now())))
   and (p_step<>'welcome' or not exists(select 1 from welcome_private.deliveries w where w.user_id=u.id
     and (w.first_attempt_at is not null or w.state in ('accepted','held'))))
   and not exists(select 1 from veeays_lifecycle.send_slots slot where slot.user_id=u.id
     and (slot.lease_until>now() or (slot.kind='legacy' and slot.reserved_at>now()-interval '24 hours')))
   and not exists(select 1 from public.daily_digest_deliveries d where d.user_id=u.id and (d.first_attempt_at>now()-interval '24 hours' or d.lease_until>now()))
   and not exists(select 1 from public.job_match_notifications n where n.user_id=u.id and n.notified_at>now()-interval '24 hours')
   and not exists(select 1 from veeays_alerts.deliveries d where d.user_id=u.id and (d.first_attempt_at>now()-interval '24 hours' or d.lease_until>now()))
$$;

create function public.claim_member_email_v3(p_token uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare d veeays_lifecycle.deliveries; recipient record;
begin
 if p_token is null or not exists(select 1 from veeays_lifecycle.control
   where id and enabled and v3_enabled and now()>=v3_start_at
   and now()>=v3_cycle_start and now()<v3_cycle_end and v3_next_send_at<=clock_timestamp()) then return null; end if;
 update veeays_lifecycle.deliveries
 set state=case when first_attempt_at is null then 'pending' else 'held' end, code='lease_expired'
 where state in ('leased','sending') and lease_until<=now();
 select u.id, v.step into recipient
 from auth.users u cross join veeays_lifecycle.v3_steps() v
 cross join lateral veeays_lifecycle.v3_candidate(u.id,v.step) eligibility
 where u.created_at <= now()-v.age_hours*interval '1 hour'
   and u.created_at > now()-(v.age_hours+24)*interval '1 hour'
 order by u.created_at+v.age_hours*interval '1 hour',u.id limit 1;
 if not found then return null; end if;
 insert into veeays_lifecycle.deliveries(user_id,step) values(recipient.id,recipient.step)
 on conflict(user_id,step) do nothing;
 select * into d from veeays_lifecycle.deliveries where user_id=recipient.id and step=recipient.step
   and state='pending' and first_attempt_at is null for update skip locked;
 if not found then return null; end if;
 update veeays_lifecycle.deliveries set state='leased',lease_token=p_token,lease_until=now()+interval '2 minutes'
 where id=d.id;
 return jsonb_build_object('id',d.id,'step',d.step);
end;
$$;

create function public.check_member_email_v3(p_id uuid,p_token uuid)
returns jsonb language sql security definer set search_path = pg_catalog as $$
 select to_jsonb(eligible)
 from veeays_lifecycle.deliveries d
 cross join lateral veeays_lifecycle.v3_candidate(d.user_id,d.step,d.id) eligible
 where d.id=p_id and d.lease_token=p_token and d.state='leased' and d.lease_until>now()
$$;

create function public.start_member_email_v3(p_id uuid,p_token uuid,p_variant text,p_daily_cap integer,p_monthly_cap integer,p_payload jsonb)
returns boolean language plpgsql security definer set search_path = pg_catalog as $$
declare d veeays_lifecycle.deliveries; c veeays_lifecycle.control; eligible record;
begin
 select * into d from veeays_lifecycle.deliveries
 where id=p_id and lease_token=p_token and state='leased' and lease_until>now()
 for update;
 if not found or p_payload is null or d.first_attempt_at is not null then return false; end if;
 select * into c from veeays_lifecycle.control where id for update;
 if not found or not c.enabled or not c.v3_enabled or c.v3_next_send_at>clock_timestamp()
   or p_daily_cap is distinct from c.v3_daily_cap or p_monthly_cap is distinct from c.v3_cycle_cap
   or now()<c.v3_cycle_start or now()>=c.v3_cycle_end then return false; end if;
 if (select count(*) from veeays_lifecycle.deliveries where coalesce(first_attempt_at,accepted_at)>=date_trunc('day',now(),'UTC'))>=c.v3_daily_cap
   or (select count(*) from veeays_lifecycle.deliveries where coalesce(first_attempt_at,accepted_at)>=c.v3_cycle_start)>=c.v3_cycle_cap
 then return false; end if;
 -- Serialize with preference writes and legacy send-slot reservations.
 perform 1 from veeays_lifecycle.preferences where user_id=d.user_id for update;
 select * into eligible from veeays_lifecycle.v3_candidate(d.user_id,d.step,d.id);
 if not found or eligible.variant is distinct from p_variant
   or p_payload->'to' is distinct from jsonb_build_array(eligible.email)
   or (d.payload is not null and d.payload is distinct from p_payload) then return false; end if;
 -- The unique member row arbitrates with any imported welcome receipt or hold.
 if d.step='welcome' then
   insert into welcome_private.deliveries as w(user_id,state,last_reason)
   values(d.user_id,'skipped','lifecycle_v3_day_0')
   on conflict(user_id) do update
     set state='skipped',last_reason='lifecycle_v3_day_0',updated_at=now()
     where w.first_attempt_at is null and w.state not in ('accepted','held')
       and coalesce(w.outcome,'') not in ('bounced','complained','suppressed');
   if not found then return false; end if;
 end if;
 insert into veeays_lifecycle.send_slots(key,user_id,kind) values('sequence:'||d.id::text,d.user_id,'sequence');
 update veeays_lifecycle.deliveries set state='sending',first_attempt_at=now(),payload=p_payload where id=d.id;
 update veeays_lifecycle.control set v3_next_send_at=clock_timestamp()+interval '1 second' where id;
 return true;
end;
$$;

-- Reuse the existing suppression ledger, including events received before settlement.
create function public.record_member_email_v3_event(p_provider text,p_kind text)
returns boolean language plpgsql security definer set search_path = pg_catalog as $$
begin
 if p_provider is null or length(p_provider) not between 1 and 128
   or p_kind is null or p_kind not in ('bounced','complained','suppressed') then return false; end if;
 -- Serialize with send admission before touching preferences.
 perform 1 from veeays_lifecycle.control where id for update;
 insert into veeays_lifecycle.provider_events(provider_id) values(p_provider) on conflict do nothing;
 perform public.suppress_member_email(p_provider);
 update welcome_private.deliveries set outcome=p_kind,updated_at=now()
 where provider_id=p_provider and (outcome is distinct from 'complained' or p_kind='complained');
 if p_kind='complained' then
   update veeays_lifecycle.provider_events set v3_complained_at=now()
   where provider_id=p_provider and v3_complained_at is null;
   if found then update veeays_lifecycle.control set v3_enabled=false where id; end if;
 end if;
 return true;
end;
$$;

create function public.pause_member_email_v3(p_seconds integer)
returns boolean language plpgsql security definer set search_path = pg_catalog as $$
begin
 update veeays_lifecycle.control
 set v3_next_send_at=greatest(v3_next_send_at,clock_timestamp()+make_interval(secs=>least(greatest(p_seconds,60),86400))),
     v3_enabled=case when p_seconds is null then false else v3_enabled end
 where id;
 return found;
end;
$$;

revoke all on function public.record_member_email_v3_event(text,text),public.pause_member_email_v3(integer)
 from public,anon,authenticated;
grant execute on function public.record_member_email_v3_event(text,text),public.pause_member_email_v3(integer)
 to service_role;

revoke all on function veeays_lifecycle.v3_steps(),veeays_lifecycle.v3_candidate(uuid,text,uuid)
 from public,anon,authenticated;
revoke all on function public.claim_member_email_v3(uuid), public.check_member_email_v3(uuid,uuid),
 public.start_member_email_v3(uuid,uuid,text,integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.claim_member_email_v3(uuid), public.check_member_email_v3(uuid,uuid),
 public.start_member_email_v3(uuid,uuid,text,integer,integer,jsonb) to service_role;

commit;
