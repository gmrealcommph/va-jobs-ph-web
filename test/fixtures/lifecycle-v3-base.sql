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
