-- Staging sender. Existing control stays disabled until an explicit staging test.
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
 where u.id=p_user and c.enabled and u.created_at>=c.start_at
   and u.email='delivered@resend.dev' and u.deleted_at is null and not coalesce(u.is_anonymous,false)
   and coalesce(u.banned_until<=now(),true)
   and u.email_confirmed_at between u.created_at and now()
   and now()>=window_start.opens and now()<window_start.opens+interval '24 hours'
   and p.plan in ('free','pro') and s.tips and not s.suppressed and s.token is not null
   and s.tips_at between u.created_at and timing.consent_cutoff
   and not exists(select 1 from veeays_alerts.settings a where a.user_id=u.id and a.suppressed)
   and not exists(select 1 from veeays_alerts.deliveries a join veeays_alerts.provider_suppressions e using(provider_id) where a.user_id=u.id)
   and not exists(select 1 from veeays_lifecycle.deliveries d join veeays_lifecycle.provider_events e using(provider_id) where d.user_id=u.id)
   and not exists(select 1 from welcome_private.deliveries w where w.user_id=u.id and w.outcome in ('bounced','complained','suppressed'))
   and not exists(select 1 from veeays_lifecycle.deliveries d where d.user_id=u.id and d.id is distinct from p_ignore
     and ((d.step=p_step and (d.first_attempt_at is not null or d.state in ('accepted','held','skipped')))
       or (d.state in ('leased','sending') and d.lease_until>now())))
   and (p_step<>'welcome' or not exists(select 1 from welcome_private.deliveries w where w.user_id=u.id
     and (w.first_attempt_at is not null or w.state='accepted')))
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
 if p_token is null or not exists(select 1 from veeays_lifecycle.control where id and enabled) then return null; end if;
 update veeays_lifecycle.deliveries d1
 set state=case when first_attempt_at is null then 'pending' else 'held' end, code='lease_expired'
 where state in ('leased','sending') and lease_until<=now()
   and exists(select 1 from auth.users u where u.id=d1.user_id and u.email='delivered@resend.dev');
 select u.id, v.step into recipient
 from auth.users u cross join veeays_lifecycle.v3_steps() v
 cross join lateral veeays_lifecycle.v3_candidate(u.id,v.step) eligibility
 where u.email='delivered@resend.dev'
 order by u.created_at limit 1;
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
 if not found or not c.enabled or p_daily_cap is distinct from c.daily_cap or p_monthly_cap is distinct from c.monthly_cap
   or c.daily_cap<1 or c.monthly_cap<1 then return false; end if;
 if (select count(*) from veeays_lifecycle.deliveries where first_attempt_at>=date_trunc('day',now(),'UTC'))>=c.daily_cap
   or (select count(*) from veeays_lifecycle.deliveries where first_attempt_at>=date_trunc('month',now(),'UTC'))>=c.monthly_cap
 then return false; end if;
 -- Preference writes, legacy slots and welcome preparation use this member lock.
 perform 1 from veeays_lifecycle.preferences where user_id=d.user_id for update;
 select * into eligible from veeays_lifecycle.v3_candidate(d.user_id,d.step,d.id);
 if not found or eligible.variant is distinct from p_variant
   or p_payload->'to' is distinct from jsonb_build_array(eligible.email)
   or (d.payload is not null and d.payload is distinct from p_payload) then return false; end if;
 insert into veeays_lifecycle.send_slots(key,user_id,kind) values('sequence:'||d.id::text,d.user_id,'sequence');
 update veeays_lifecycle.deliveries set state='sending',first_attempt_at=now(),payload=p_payload where id=d.id;
 return true;
end;
$$;

revoke all on function veeays_lifecycle.v3_steps(),veeays_lifecycle.v3_candidate(uuid,text,uuid)
 from public,anon,authenticated;
revoke all on function public.claim_member_email_v3(uuid), public.check_member_email_v3(uuid,uuid),
 public.start_member_email_v3(uuid,uuid,text,integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.claim_member_email_v3(uuid), public.check_member_email_v3(uuid,uuid),
 public.start_member_email_v3(uuid,uuid,text,integer,integer,jsonb) to service_role;

-- The legacy Worker always prepares the payload before calling the provider.
-- Serialize that preparation with lifecycle Day 0; a prior attempt owns the slot permanently.
CREATE OR REPLACE FUNCTION public.welcome_work(p_action text, p_mode text, p_test_user uuid DEFAULT NULL::uuid, p_user uuid DEFAULT NULL::uuid, p_token uuid DEFAULT NULL::uuid, p_payload jsonb DEFAULT NULL::jsonb, p_provider text DEFAULT NULL::text, p_outcome text DEFAULT NULL::text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare c welcome_private.control%rowtype; d welcome_private.deliveries%rowtype;
  recipient text; result jsonb; new_state text;
begin
  select * into c from welcome_private.control where id;
  -- Receipts can still be acknowledged after an operator switches sending off.
  if p_action in ('accept','defer') then
    select * into d from welcome_private.deliveries where user_id=p_user for update;
    if not found or d.state<>'sending' or d.token is distinct from p_token or d.lease_until<=now() then return 'false'::jsonb; end if;
    if p_action='accept' then
      if p_provider is null or length(p_provider)>200 then raise exception 'invalid_receipt'; end if;
      update welcome_private.deliveries set state='accepted',provider_id=p_provider,accepted_at=now(),
        next_outcome_at=now()+interval '5 minutes',outcome='accepted',updated_at=now(),token=null,lease_until=null where user_id=p_user;
      insert into welcome_private.audit(user_id,outcome) values(p_user,'accepted');
    else
      if p_outcome not in ('retry','held','skipped') or p_reason not in
        ('transient_or_unknown','idempotency_window_expired','recipient_ineligible','auth_recipient_changed','provider_rejected') then raise exception 'invalid_defer'; end if;
      new_state=case when p_outcome='retry' and (d.attempts>=8 or d.first_attempt_at<=now()-interval '23 hours') then 'held' else p_outcome end;
      update welcome_private.deliveries set state=new_state,last_reason=p_reason,updated_at=now(),token=null,lease_until=null,
        next_at=now()+make_interval(mins=>least(60,power(2,least(d.attempts,6))::int)) where user_id=p_user;
      insert into welcome_private.audit(user_id,outcome) values(p_user,new_state||':'||p_reason);
    end if;
    return 'true'::jsonb;
  end if;
  if not c.enabled or c.mode is distinct from p_mode or c.start_at>now() or
    (c.mode='test' and (c.test_user is null or c.test_user is distinct from p_test_user or c.test_email<>'support@veeays.com')) then
    return case when p_action='receipts' then '[]'::jsonb else 'null'::jsonb end;
  end if;
  if p_action='receipts' then
    with due as (
      select user_id from welcome_private.deliveries where state='accepted' and next_outcome_at<=now()
        and accepted_at>now()-interval '7 days' order by next_outcome_at for update skip locked limit 10
    ), polled as (
      update welcome_private.deliveries queued set next_outcome_at=now()+interval '30 minutes'
      from due where queued.user_id=due.user_id returning queued.user_id,queued.provider_id
    ) select coalesce(jsonb_agg(to_jsonb(polled)),'[]'::jsonb) into result from polled;
    return result;
  elsif p_action='outcome' then
    if p_outcome not in ('sent','delivered','delivery_delayed','bounced','complained','failed','suppressed','unknown') then raise exception 'invalid_outcome'; end if;
    select * into d from welcome_private.deliveries where user_id=p_user and state='accepted' for update;
    if not found then return 'false'::jsonb; end if;
    if d.outcome is distinct from p_outcome then insert into welcome_private.audit(user_id,outcome) values(p_user,p_outcome); end if;
    update welcome_private.deliveries set outcome=p_outcome,outcome_checked_at=now(),updated_at=now() where user_id=p_user;
    return 'true'::jsonb;
  elsif p_action='claim' then
    -- Never take Auth transaction locks. Scan committed state; optional onboarding is irrelevant.
    insert into welcome_private.deliveries(user_id)
      select u.id from auth.users u join public.profiles p on p.id=u.id
      where u.created_at>=c.start_at and u.email_confirmed_at is not null and u.email is not null
        and u.deleted_at is null and not coalesce(u.is_anonymous,false)
        and (u.banned_until is null or u.banned_until<=now())
        and (c.mode='production' or (u.id=c.test_user and lower(btrim(u.email))=c.test_email))
        and not exists(select 1 from welcome_private.deliveries queued where queued.user_id=u.id)
      order by u.created_at limit 100 on conflict(user_id) do nothing;
    -- Expired send leases retry the SAME payload/key only within Resend's safe window.
    update welcome_private.deliveries set state=case when attempts>=8 or first_attempt_at<=now()-interval '23 hours' then 'held' else 'retry' end,
      last_reason='lease_expired',token=null,lease_until=null,updated_at=now()
      where state='sending' and lease_until<=now();
    update welcome_private.deliveries set state='held',last_reason='idempotency_window_expired',updated_at=now()
      where state in ('pending','retry') and first_attempt_at<=now()-interval '23 hours';
    select * into d from welcome_private.deliveries where state in ('pending','retry') and next_at<=now()
      and (c.mode='production' or user_id=c.test_user) order by next_at for update skip locked limit 1;
    if not found then return 'null'::jsonb; end if;
    update welcome_private.deliveries set state='sending',token=gen_random_uuid(),lease_until=now()+interval '5 minutes',
      attempts=attempts+1,updated_at=now() where user_id=d.user_id returning * into d;
    return to_jsonb(d);
  elsif p_action in ('check','prepare') then
    select * into d from welcome_private.deliveries where user_id=p_user for update;
    if not found or d.state<>'sending' or d.token is distinct from p_token or d.lease_until<=now() then return 'null'::jsonb; end if;
    select lower(btrim(u.email)) into recipient from auth.users u join public.profiles p on p.id=u.id
      where u.id=p_user and u.created_at>=c.start_at and u.email_confirmed_at is not null
      and u.deleted_at is null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now())
      and (c.mode='production' or (u.id=c.test_user and lower(btrim(u.email))=c.test_email));
    if recipient is null or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return 'null'::jsonb; end if;
    if p_action='check' then return jsonb_build_object('email',recipient); end if;
    if d.first_attempt_at<=now()-interval '23 hours' or p_payload->'to' is distinct from jsonb_build_array(recipient)
      or (d.payload is not null and d.payload->'to' is distinct from jsonb_build_array(recipient)) then return 'null'::jsonb; end if;
    if recipient='delivered@resend.dev' then
      insert into veeays_lifecycle.preferences(user_id) values(p_user) on conflict do nothing;
      perform 1 from veeays_lifecycle.preferences where user_id=p_user for update;
      if exists(select 1 from veeays_lifecycle.deliveries l where l.user_id=p_user and l.step='welcome'
        and (l.first_attempt_at is not null or l.state='accepted')) then return 'null'::jsonb; end if;
    end if;
    update welcome_private.deliveries set payload=coalesce(payload,p_payload),first_attempt_at=coalesce(first_attempt_at,now()),updated_at=now()
      where user_id=p_user returning * into d;
    return jsonb_build_object('payload',d.payload,'first_attempt_at',d.first_attempt_at);
  end if;
  raise exception 'invalid_action';
end $function$
;
