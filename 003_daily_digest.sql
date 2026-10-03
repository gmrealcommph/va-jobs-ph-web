-- Daily Digest only. Does not create/alter the matcher, public_jobs, or Strong Match state.
begin;

-- Fail migration clearly if the required production contract is absent.
do $$ begin
  if to_regprocedure('public._get_job_matches_for_user(uuid,integer)') is null then
    raise exception 'Frozen Matching V2 function missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='job_preferences' and column_name='daily_digest' and data_type='boolean') then
    raise exception 'Existing boolean job_preferences.daily_digest required';
  end if;
end $$;

create table public.daily_digest_deliveries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  digest_day date not null, window_end timestamptz not null,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check(status in ('pending','retry','accepted','held','skipped')),
  items jsonb, payload jsonb, first_attempt_at timestamptz, attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(), lease_token uuid, lease_until timestamptz,
  resend_id text, accepted_at timestamptz, last_error text,
  unique(user_id,digest_day),
  check ((resend_id is null) = (accepted_at is null)),
  check (items is null or (jsonb_typeof(items)='array' and jsonb_array_length(items)<=10)),
  check (digest_day=(window_end at time zone 'Asia/Manila')::date)
);
create index daily_digest_due on public.daily_digest_deliveries(status,next_attempt_at);
alter table public.daily_digest_deliveries enable row level security;
revoke all on public.daily_digest_deliveries from public,anon,authenticated;
grant select on public.daily_digest_deliveries to service_role;

-- Existing frozen engine's order is retained via ordinality, including all tie-breakers.
-- Its global top-100 cap is intentional for V1. No notifications table is involved.
create function public.daily_digest_matches(p_user_id uuid,p_window_end timestamptz)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(x.item order by x.rank),'[]'::jsonb)
  from (
    select (to_jsonb(m)-'ordinality') || jsonb_build_object('job_id',m.job_id::text) as item,
      m.ordinality as rank
    from public._get_job_matches_for_user(p_user_id,100) with ordinality m
    join public.jobs j on j.id=m.job_id
    join public.public_jobs v on v.id=m.job_id
    where j.status='active' and j.philippines_eligible is true
      and coalesce(j.created_at,j.collected_at,j.posted_at)>=p_window_end-interval '24 hours'
      and coalesce(j.created_at,j.collected_at,j.posted_at)<p_window_end
    order by m.ordinality limit 10
  ) x;
$$;

create function public.claim_daily_digest(p_token uuid,p_window_end timestamptz,p_start_at timestamptz)
returns setof public.daily_digest_deliveries language plpgsql security definer set search_path='' as $$
declare d public.daily_digest_deliveries;
begin
  if p_token is null or p_start_at is null or p_window_end is null
    or p_window_end<>date_trunc('day',p_window_end at time zone 'UTC') at time zone 'UTC'
    or p_window_end>now() or p_window_end<date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
    then raise exception 'Invalid daily digest window'; end if;
  if p_window_end<p_start_at then return; end if;
  perform pg_advisory_xact_lock(78236420);
  -- Never retry beyond the provider's safe idempotency horizon or send an old roundup.
  update public.daily_digest_deliveries set status='held',last_error='idempotency_window_expired'
    where status in ('pending','retry') and first_attempt_at<=now()-interval '23 hours'
      and (lease_until is null or lease_until<now());
  update public.daily_digest_deliveries set status=case when first_attempt_at is null then 'skipped' else 'held' end,
    last_error='digest_window_closed'
    where status in ('pending','retry') and window_end<p_window_end
      and (lease_until is null or lease_until<now());
  insert into public.daily_digest_deliveries(user_id,digest_day,window_end)
    select p.id,(p_window_end at time zone 'Asia/Manila')::date,p_window_end
    from public.profiles p join public.job_preferences pref on pref.user_id=p.id
    join auth.users u on u.id=p.id
    where p.plan='pro' and p.plan_status='active'
      and (p.pro_expires_at is null or p.pro_expires_at>now()) and pref.daily_digest is true
      and u.email_confirmed_at is not null and u.deleted_at is null
      and (u.banned_until is null or u.banned_until<=now())
    on conflict(user_id,digest_day) do nothing;
  select * into d from public.daily_digest_deliveries
    where window_end=p_window_end and status in ('pending','retry') and next_attempt_at<=now()
      and (lease_until is null or lease_until<now())
    -- Unattempted users before retrying failures: a failing user cannot monopolize fanout.
    order by attempts,next_attempt_at,user_id limit 1 for update;
  if d.id is null then return; end if;
  update public.daily_digest_deliveries set lease_token=p_token,lease_until=now()+interval '5 minutes'
    where id=d.id returning * into d;
  return next d;
end $$;

-- Recheck entitlement and Auth independently of Strong Match opt-in.
-- Frozen items must still be public, fresh and present in today's frozen top 100.
create function public.check_daily_digest(p_id uuid,p_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.daily_digest_deliveries; candidate jsonb; person jsonb;
begin
  select * into d from public.daily_digest_deliveries where id=p_id and lease_token=p_token
    and lease_until>now() and status in ('pending','retry') for update;
  if d.id is null then raise exception 'lease lost'; end if;
  if d.window_end<>date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' then
    return jsonb_build_object('error','digest_window_closed'); end if;
  select jsonb_build_object('email',lower(trim(u.email)),'profile',to_jsonb(p)) into person
    from public.profiles p join public.job_preferences pref on pref.user_id=p.id
    join auth.users u on u.id=p.id
    where p.id=d.user_id and p.plan='pro' and p.plan_status='active'
      and (p.pro_expires_at is null or p.pro_expires_at>now()) and pref.daily_digest is true
      and u.email_confirmed_at is not null and u.deleted_at is null
      and (u.banned_until is null or u.banned_until<=now())
      and u.email is not null;
  if person is null then return jsonb_build_object('error','recipient_not_eligible'); end if;
  candidate:=public.daily_digest_matches(d.user_id,d.window_end);
  if d.items is null then
    if jsonb_array_length(candidate)=0 then return jsonb_build_object('error','no_new_matches'); end if;
    update public.daily_digest_deliveries set items=candidate where id=d.id;
    d.items:=candidate;
  elsif exists(select 1 from jsonb_array_elements(d.items) i where not exists(
    select 1 from jsonb_array_elements(candidate) c where c=i)) then
    return jsonb_build_object('error','frozen_matches_changed');
  end if;
  return person || jsonb_build_object('items',d.items);
end $$;

create function public.freeze_daily_digest(p_id uuid,p_token uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  update public.daily_digest_deliveries set payload=coalesce(payload,p_payload)
    where id=p_id and lease_token=p_token and lease_until>now() and items is not null
      and jsonb_array_length(items)>0 and status in ('pending','retry') returning payload into result;
  if result is null then raise exception 'lease lost'; end if;
  return result;
end $$;

create function public.start_daily_digest_attempt(p_id uuid,p_token uuid)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare started timestamptz; checked jsonb;
begin
  checked:=public.check_daily_digest(p_id,p_token);
  if checked ? 'error' then raise exception 'send-time check refused'; end if;
  update public.daily_digest_deliveries set first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1
    where id=p_id and lease_token=p_token and lease_until>now() and payload is not null
      and payload->'to'=jsonb_build_array(checked->>'email') and status in ('pending','retry')
      and (first_attempt_at is null or first_attempt_at>now()-interval '23 hours')
    returning first_attempt_at into started;
  if started is null then raise exception 'attempt refused'; end if;
  return started;
end $$;

create function public.accept_daily_digest(p_id uuid,p_token uuid,p_resend_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare d public.daily_digest_deliveries;
begin
  select * into d from public.daily_digest_deliveries where id=p_id for update;
  if d.status='accepted' and d.resend_id=p_resend_id then return true; end if;
  if d.id is null or d.lease_token is distinct from p_token or d.status not in ('pending','retry')
    or d.first_attempt_at is null or p_resend_id is null or length(p_resend_id)=0 then
    raise exception 'receipt refused'; end if;
  update public.daily_digest_deliveries set status='accepted',resend_id=p_resend_id,accepted_at=now(),
    lease_token=null,lease_until=null,last_error=null where id=p_id;
  return true;
end $$;

create function public.defer_daily_digest(p_id uuid,p_token uuid,p_status text,p_error text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_status not in ('retry','held','skipped') then raise exception 'invalid status'; end if;
  update public.daily_digest_deliveries set status=p_status,last_error=left(p_error,120),
    next_attempt_at=now()+make_interval(secs=>least(21600,60*power(2,least(attempts,8))::integer)),
    lease_token=null,lease_until=null where id=p_id and lease_token=p_token and status in ('pending','retry');
  return found;
end $$;

revoke all on function public.daily_digest_matches(uuid,timestamptz),
  public.claim_daily_digest(uuid,timestamptz,timestamptz),public.check_daily_digest(uuid,uuid),
  public.freeze_daily_digest(uuid,uuid,jsonb),public.start_daily_digest_attempt(uuid,uuid),
  public.accept_daily_digest(uuid,uuid,text),public.defer_daily_digest(uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.daily_digest_matches(uuid,timestamptz),
  public.claim_daily_digest(uuid,timestamptz,timestamptz),public.check_daily_digest(uuid,uuid),
  public.freeze_daily_digest(uuid,uuid,jsonb),public.start_daily_digest_attempt(uuid,uuid),
  public.accept_daily_digest(uuid,uuid,text),public.defer_daily_digest(uuid,uuid,text,text)
  to service_role;
notify pgrst,'reload schema';
commit;
