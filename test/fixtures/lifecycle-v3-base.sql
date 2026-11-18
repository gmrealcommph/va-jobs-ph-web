create role anon;create role authenticated;create role service_role;
create schema auth;grant usage on schema auth to authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table auth.users(id uuid primary key,email text,created_at timestamptz not null default now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
create table public.profiles(id uuid primary key,full_name text,plan text default 'free',onboarding_completed boolean default false);
create table public.daily_digest_deliveries(user_id uuid,first_attempt_at timestamptz,lease_until timestamptz);
create table public.job_match_notifications(user_id uuid,notified_at timestamptz);
create schema veeays_alerts;
create table veeays_alerts.settings(user_id uuid,suppressed boolean default false);
create table veeays_alerts.deliveries(user_id uuid,first_attempt_at timestamptz,lease_until timestamptz);

-- STAGING CANDIDATE ONLY. Not installed in production. No existing email/payment functions replaced.
create schema veeays_lifecycle;
revoke all on schema veeays_lifecycle from public,anon,authenticated;
create table veeays_lifecycle.control(id boolean primary key default true check(id),enabled boolean not null default false,start_at timestamptz not null default 'infinity',reminders_verified boolean not null default false,daily_cap integer not null default 5 check(daily_cap between 1 and 100),monthly_cap integer not null default 50 check(monthly_cap between 1 and 1000));
insert into veeays_lifecycle.control default values;
create table veeays_lifecycle.preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 tips boolean not null default false,pro boolean not null default false,
 tips_at timestamptz,pro_at timestamptz,consent_version text not null default 'member-emails-v1',
 token uuid not null unique default gen_random_uuid(),suppressed boolean not null default false,
 updated_at timestamptz not null default now());
create table veeays_lifecycle.deliveries(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 step text not null check(step in('verify-day-2','verify-day-5','getting-started','profile-tip','pro-introduction','safer-search','interview-tip')),
 state text not null default 'pending' check(state in('pending','leased','sending','accepted','held','skipped')),
 lease_token uuid,lease_until timestamptz,payload jsonb,created_at timestamptz not null default now(),
 first_attempt_at timestamptz,accepted_at timestamptz,provider_id text unique,code text,
 unique(user_id,step));
create table veeays_lifecycle.provider_events(provider_id text primary key,created_at timestamptz not null default now());
create table veeays_lifecycle.send_slots(
 key text primary key,user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in('sequence','legacy')),reserved_at timestamptz not null default now(),lease_until timestamptz not null default now()+interval '2 minutes');
create index lifecycle_send_slots_user_time on veeays_lifecycle.send_slots(user_id,reserved_at);
alter table veeays_lifecycle.control enable row level security;
alter table veeays_lifecycle.preferences enable row level security;
alter table veeays_lifecycle.deliveries enable row level security;
alter table veeays_lifecycle.provider_events enable row level security;
alter table veeays_lifecycle.send_slots enable row level security;
revoke all on all tables in schema veeays_lifecycle from public,anon,authenticated;

-- Apply to staging first. No Auth triggers, registration writes, or historical backfill.
create schema welcome_private;
revoke all on schema welcome_private from public,anon,authenticated;
create table welcome_private.control (
  id boolean primary key default true check(id), enabled boolean not null default false,
  mode text not null default 'test' check(mode in ('test','production')),
  start_at timestamptz not null default now(), test_user uuid,
  test_email text not null default 'support@veeays.com'
);
insert into welcome_private.control(id) values(true);
create table welcome_private.deliveries (
  user_id uuid primary key, created_at timestamptz not null default now(),
  state text not null default 'pending' check(state in ('pending','sending','retry','accepted','held','skipped')),
  token uuid, lease_until timestamptz, next_at timestamptz not null default now(),
  first_attempt_at timestamptz, attempts integer not null default 0,
  payload jsonb, provider_id text, accepted_at timestamptz,
  outcome text, outcome_checked_at timestamptz, next_outcome_at timestamptz,
  last_reason text, updated_at timestamptz not null default now()
);
create index welcome_due on welcome_private.deliveries(next_at) where state in ('pending','retry');
create table welcome_private.audit (
  id bigint generated always as identity primary key, user_id uuid not null,
  occurred_at timestamptz not null default now(), outcome text not null
);
alter table welcome_private.control enable row level security;
alter table welcome_private.deliveries enable row level security;
alter table welcome_private.audit enable row level security;
revoke all on all tables in schema welcome_private from public,anon,authenticated;



alter table auth.users add column is_anonymous boolean not null default false;
alter table veeays_alerts.deliveries add column provider_id text;
create table veeays_alerts.provider_suppressions(provider_id text primary key);
create table veeays_lifecycle.marketing_consents (
 user_id uuid primary key, withdrawn_at timestamptz, withdrawal_source text
);
CREATE OR REPLACE FUNCTION public.finish_member_email(p_id uuid, p_token uuid, p_provider text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
begin
 if p_provider is null or length(p_provider)>128 then return false;end if;
 update veeays_lifecycle.deliveries set state='accepted',accepted_at=now(),provider_id=p_provider,code='ok' where id=p_id and lease_token=p_token and state='sending';
 if found then
  update veeays_lifecycle.preferences set suppressed=true where user_id in(select user_id from veeays_lifecycle.deliveries where id=p_id) and exists(select 1 from veeays_lifecycle.provider_events where provider_id=p_provider);
  return true;
 end if;
 return false;
end $function$
;
CREATE OR REPLACE FUNCTION public.hold_member_email(p_id uuid, p_token uuid, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
begin
 update veeays_lifecycle.deliveries set state='held',code=case when p_code='ambiguous_after_start' then p_code else 'eligibility_or_preflight' end where id=p_id and lease_token=p_token and state in('leased','sending');
 return found;
end $function$
;
CREATE OR REPLACE FUNCTION public.defer_member_email(p_id uuid, p_token uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
begin
 update veeays_lifecycle.deliveries set state='pending',lease_token=null,lease_until=null,code='send_time_deferred' where id=p_id and lease_token=p_token and state='leased' and first_attempt_at is null;
 return found;
end $function$
;
CREATE OR REPLACE FUNCTION public.unsubscribe_member_email(p_token uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare uid uuid;
begin
 select user_id into uid from veeays_lifecycle.preferences where token=p_token for update;
 if not found then return true;end if;
 if exists(select 1 from veeays_lifecycle.deliveries where user_id=uid and state='sending' and lease_until>now()) then return false;end if;
 update veeays_lifecycle.preferences set tips=false,pro=false,tips_at=null,pro_at=null,updated_at=now() where user_id=uid;
 update veeays_lifecycle.marketing_consents set withdrawn_at=clock_timestamp(),withdrawal_source='email-unsubscribe'
 where user_id=uid and withdrawn_at is null;
 return true;
end $function$
;

-- Existing welcome RPC, installed independently of the v3 migration.
CREATE FUNCTION public.welcome_work(p_action text, p_mode text, p_test_user uuid DEFAULT NULL::uuid, p_user uuid DEFAULT NULL::uuid, p_token uuid DEFAULT NULL::uuid, p_payload jsonb DEFAULT NULL::jsonb, p_provider text DEFAULT NULL::text, p_outcome text DEFAULT NULL::text, p_reason text DEFAULT NULL::text)
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
    update welcome_private.deliveries set payload=coalesce(payload,p_payload),first_attempt_at=coalesce(first_attempt_at,now()),updated_at=now()
      where user_id=p_user returning * into d;
    return jsonb_build_object('payload',d.payload,'first_attempt_at',d.first_attempt_at);
  end if;
  raise exception 'invalid_action';
end $function$
;
