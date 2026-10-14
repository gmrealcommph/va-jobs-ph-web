-- Local/reviewable only. Applying this migration does not enable scheduled email.
begin;
create schema if not exists veeays_verification;
revoke all on schema veeays_verification from public,anon,authenticated;
create table veeays_verification.resend_attempts (
 id bigint generated always as identity primary key,
 email_hash text not null, ip_hash text not null, attempted_at timestamptz not null default now()
);
create index on veeays_verification.resend_attempts(email_hash,attempted_at);
create index on veeays_verification.resend_attempts(ip_hash,attempted_at);
create index on veeays_verification.resend_attempts(attempted_at);
create table veeays_verification.reminders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 stage integer not null check(stage in (24,72)), email text not null,
 state text not null default 'pending' check(state in ('pending','sent','skipped','review')),
 first_attempt_at timestamptz not null default now(), next_attempt_at timestamptz not null default now()+interval '16 minutes',
 attempts integer not null default 1, receipt text, sent_at timestamptz,
 unique(user_id,stage)
);
create index on veeays_verification.reminders(next_attempt_at,first_attempt_at) where state='pending';
create index on veeays_verification.reminders(first_attempt_at);
alter table veeays_verification.resend_attempts enable row level security;
alter table veeays_verification.reminders enable row level security;
revoke all on all tables in schema veeays_verification from public,anon,authenticated;

create function veeays_verification.resend_claim(p_email_hash text,p_ip_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_email_hash !~ '^[0-9a-f]{64}$' or p_ip_hash !~ '^[0-9a-f]{64}$' or p_email_hash is null or p_ip_hash is null then return false; end if;
 perform pg_advisory_xact_lock(71482401);
 delete from veeays_verification.resend_attempts where attempted_at<now()-interval '2 days';
 if exists(select 1 from veeays_verification.resend_attempts where email_hash=p_email_hash and attempted_at>now()-interval '60 seconds')
 or (select count(*) from veeays_verification.resend_attempts where email_hash=p_email_hash and attempted_at>now()-interval '24 hours')>=3
 or (select count(*) from veeays_verification.resend_attempts where ip_hash=p_ip_hash and attempted_at>now()-interval '1 hour')>=10
 or (select count(*) from veeays_verification.resend_attempts where attempted_at>now()-interval '1 hour')>=30
 or (select count(*) from veeays_verification.resend_attempts where attempted_at>now()-interval '24 hours')>=20
 then return false; end if;
 insert into veeays_verification.resend_attempts(email_hash,ip_hash) values(p_email_hash,p_ip_hash);
 return true;
end $$;
create function public.veeays_verification_resend_claim(p_email_hash text,p_ip_hash text) returns boolean
language sql security invoker set search_path='' as $$select veeays_verification.resend_claim(p_email_hash,p_ip_hash)$$;

create function veeays_verification.reminder_claim(p_start_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r veeays_verification.reminders; u record;
begin
 if p_start_at is null then raise exception 'Cohort start required'; end if;
 perform pg_advisory_xact_lock(71482402);
 -- Resend idempotency expires after 24h. Ambiguous older sends require human review.
 update veeays_verification.reminders set state='review' where state='pending' and next_attempt_at<=now() and (first_attempt_at<now()-interval '23 hours' or attempts>=4);
 select * into r from veeays_verification.reminders where state='pending' and next_attempt_at<=now() order by first_attempt_at limit 1 for update;
 if r.id is not null then
  update veeays_verification.reminders set attempts=attempts+1,next_attempt_at=now()+interval '16 minutes' where id=r.id;
  return to_jsonb(r);
 end if;
 if (select count(*) from veeays_verification.reminders where first_attempt_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=10 then return null; end if;
 select a.id,a.email,case when a.created_at<=now()-interval '72 hours' then 72 else 24 end stage into u
 from auth.users a where a.created_at>=p_start_at and a.created_at<=now()-interval '24 hours'
 and a.created_at>now()-interval '7 days' and a.email_confirmed_at is null and a.deleted_at is null
 and coalesce(a.is_anonymous,false)=false and (a.banned_until is null or a.banned_until<=now()) and a.email is not null
 and not exists(select 1 from veeays_verification.reminders x where x.user_id=a.id and x.stage=case when a.created_at<=now()-interval '72 hours' then 72 else 24 end)
 and not exists(select 1 from veeays_verification.reminders x where x.user_id=a.id and x.first_attempt_at>now()-interval '24 hours')
 order by a.created_at,a.id limit 1;
 if u.id is null then return null; end if;
 insert into veeays_verification.reminders(user_id,email,stage) values(u.id,u.email,u.stage) returning * into r;
 return to_jsonb(r);
end $$;
create function public.veeays_verification_reminder_claim(p_start_at timestamptz) returns jsonb
language sql security invoker set search_path='' as $$select veeays_verification.reminder_claim(p_start_at)$$;
create function veeays_verification.reminder_finish(p_id uuid,p_state text,p_receipt text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_state not in ('sent','skipped') or (p_state='sent' and coalesce(p_receipt,'')='') then raise exception 'Invalid receipt'; end if;
 update veeays_verification.reminders set state=p_state,receipt=p_receipt,sent_at=case when p_state='sent' then now() end where id=p_id and state='pending';
 return found;
end $$;
create function public.veeays_verification_reminder_finish(p_id uuid,p_state text,p_receipt text) returns boolean
language sql security invoker set search_path='' as $$select veeays_verification.reminder_finish(p_id,p_state,p_receipt)$$;

revoke all on all functions in schema veeays_verification from public,anon,authenticated;
revoke all on function public.veeays_verification_resend_claim(text,text), public.veeays_verification_reminder_claim(timestamptz), public.veeays_verification_reminder_finish(uuid,text,text) from public,anon,authenticated;
grant usage on schema veeays_verification to service_role;
grant execute on all functions in schema veeays_verification to service_role;
grant execute on function public.veeays_verification_resend_claim(text,text), public.veeays_verification_reminder_claim(timestamptz), public.veeays_verification_reminder_finish(uuid,text,text) to service_role;

create function veeays_verification.admin_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if veeays_admin.has_access() is distinct from true then raise exception 'Admin access required' using errcode='42501'; end if;
 return jsonb_build_object('available',true,'checked_at',now(),
 'total',(select count(*) from auth.users where deleted_at is null),
 'verified',(select count(*) from auth.users where deleted_at is null and email_confirmed_at is not null),
 'unverified',(select count(*) from auth.users where deleted_at is null and email_confirmed_at is null),
 'reminders',(select coalesce(jsonb_object_agg(state,n),'{}'::jsonb) from (select state,count(*) n from veeays_verification.reminders group by state) x),
 'members',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
 select a.id,a.email,a.created_at,a.email_confirmed_at,
 (select max(sent_at) from veeays_verification.reminders r where r.user_id=a.id and stage=24) reminder_24h_at,
 (select max(sent_at) from veeays_verification.reminders r where r.user_id=a.id and stage=72) reminder_72h_at
 from auth.users a where deleted_at is null order by a.created_at desc,a.id limit 100) x));
end $$;
revoke all on function veeays_verification.admin_snapshot() from public,anon;
grant usage on schema veeays_verification to authenticated;
grant execute on function veeays_verification.admin_snapshot() to authenticated;
create function public.veeays_admin_verification_snapshot() returns jsonb
language sql stable security invoker set search_path='' as $$select veeays_verification.admin_snapshot()$$;
revoke all on function public.veeays_admin_verification_snapshot() from public,anon;
grant execute on function public.veeays_admin_verification_snapshot() to authenticated;
commit;
