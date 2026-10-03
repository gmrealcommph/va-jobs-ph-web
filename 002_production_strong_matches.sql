-- Apply after 001. No sending, no changes to discovery, entitlement or frontend policies.
begin;
create table public.strong_match_batches (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check(status in ('pending','retry','accepted','held','skipped')),
  payload jsonb, first_attempt_at timestamptz, attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(), lease_token uuid, lease_until timestamptz,
  resend_id text, accepted_at timestamptz, last_error text,
  check ((resend_id is null) = (accepted_at is null))
);
create table public.strong_match_batch_items (
  notification_id text primary key, batch_id uuid not null references public.strong_match_batches(id),
  job_id text not null, match_score jsonb
);
create index strong_match_batch_due on public.strong_match_batches(status,next_attempt_at);
create index strong_match_batch_user on public.strong_match_batches(user_id,created_at);
create index strong_match_items_batch on public.strong_match_batch_items(batch_id);
alter table public.strong_match_batches enable row level security;
alter table public.strong_match_batch_items enable row level security;
revoke all on public.strong_match_batches, public.strong_match_batch_items from public,anon,authenticated;
grant select on public.strong_match_batches, public.strong_match_batch_items to service_role;

-- Notification age/order uses the existing discovered_at; batch created_at tracks reservation/cooldown.
-- One claim per RPC, globally serialized selection, durable per-user cooldown.
-- Existing manual attempts are quarantined, including unknown outcomes.
create function public.claim_strong_match_batch(p_token uuid, p_cutoff timestamptz)
returns setof public.strong_match_batches language plpgsql security definer set search_path = '' as $$
declare b public.strong_match_batches; uid uuid;
begin
  if p_cutoff is null then raise exception 'cutoff required'; end if;
  perform pg_advisory_xact_lock(78236419);
  update public.strong_match_batches set status='held',last_error='idempotency_window_expired'
    where status in ('pending','retry') and first_attempt_at <= now()-interval '23 hours'
      and (lease_until is null or lease_until < now());
  select * into b from public.strong_match_batches
    where status in ('pending','retry') and next_attempt_at <= now()
      and (lease_until is null or lease_until < now())
    order by next_attempt_at,id limit 1 for update;
  if b.id is null then
    select n.user_id into uid from public.job_match_notifications n
    join public.profiles p on p.id=n.user_id
    join public.job_preferences pref on pref.user_id=n.user_id
    join auth.users u on u.id=n.user_id
    where n.notification_type='strong_match' and n.notified_at is null
      and n.discovered_at >= p_cutoff and n.discovered_at <= now()-interval '15 minutes'
      and p.plan='pro' and p.plan_status='active'
      and (p.pro_expires_at is null or p.pro_expires_at > now())
      and pref.email_strong_matches is true and u.email_confirmed_at is not null
      and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
      and exists(select 1 from public.public_jobs j where j.id::text=n.job_id::text)
      and not exists(select 1 from public.manual_strong_match_deliveries m where m.notification_id=n.id::text)
      and not exists(select 1 from public.strong_match_batch_items i where i.notification_id=n.id::text)
      and not exists(select 1 from public.strong_match_batches x where x.user_id=n.user_id
        and (x.created_at > now()-interval '24 hours' or x.accepted_at > now()-interval '24 hours'
          or x.status in ('pending','retry','held')))
    order by n.discovered_at,n.id limit 1;
    if uid is null then return; end if;
    insert into public.strong_match_batches(user_id) values(uid) returning * into b;
    insert into public.strong_match_batch_items(notification_id,batch_id,job_id,match_score)
      select n.id::text,b.id,n.job_id::text,to_jsonb(n.match_score)
      from public.job_match_notifications n
      where n.user_id=uid and n.notification_type='strong_match' and n.notified_at is null
        and n.discovered_at >= p_cutoff and n.discovered_at <= now()-interval '15 minutes'
        and exists(select 1 from public.public_jobs j where j.id::text=n.job_id::text)
        and not exists(select 1 from public.manual_strong_match_deliveries m where m.notification_id=n.id::text)
        and not exists(select 1 from public.strong_match_batch_items i where i.notification_id=n.id::text)
      order by n.discovered_at,n.id limit 5;
  end if;
  update public.strong_match_batches set lease_token=p_token,lease_until=now()+interval '5 minutes'
    where id=b.id returning * into b;
  return next b;
end $$;

-- Frozen payload never changes after first persistence. The lease token fences stale workers.
create function public.freeze_strong_match_batch(p_id uuid,p_token uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  update public.strong_match_batches set payload=coalesce(payload,p_payload)
    where id=p_id and lease_token=p_token and lease_until>now() and status in ('pending','retry')
    returning payload into result;
  if result is null then raise exception 'lease lost'; end if;
  return result;
end $$;

create function public.start_strong_match_attempt(p_id uuid,p_token uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare started timestamptz;
begin
  update public.strong_match_batches set first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1
    where id=p_id and lease_token=p_token and lease_until>now() and payload is not null
      and status in ('pending','retry') and (first_attempt_at is null or first_attempt_at>now()-interval '23 hours')
    returning first_attempt_at into started;
  if started is null then raise exception 'attempt refused'; end if;
  return started;
end $$;

-- Provider receipt and all notification acknowledgements commit together.
create function public.accept_strong_match_batch(p_id uuid,p_token uuid,p_resend_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare b public.strong_match_batches;
begin
  select * into b from public.strong_match_batches where id=p_id for update;
  if b.status='accepted' and b.resend_id=p_resend_id then return true; end if;
  if b.lease_token is distinct from p_token or b.status not in ('pending','retry')
    or b.first_attempt_at is null or p_resend_id is null or length(p_resend_id)=0 then raise exception 'receipt refused'; end if;
  update public.strong_match_batches set status='accepted',resend_id=p_resend_id,accepted_at=now(),
    lease_token=null,lease_until=null,last_error=null where id=p_id;
  update public.job_match_notifications n set notified_at=now()
    from public.strong_match_batch_items i where i.batch_id=p_id and n.id::text=i.notification_id
      and n.notification_type='strong_match' and n.user_id=b.user_id and n.job_id::text=i.job_id
      and n.notified_at is null;
  return true;
end $$;

create function public.defer_strong_match_batch(p_id uuid,p_token uuid,p_status text,p_error text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('retry','held','skipped') then raise exception 'invalid status'; end if;
  update public.strong_match_batches set status=p_status,last_error=left(p_error,120),
    next_attempt_at=now()+make_interval(secs => least(21600,60*power(2,least(attempts,8))::integer)),
    lease_token=null,lease_until=null where id=p_id and lease_token=p_token and status in ('pending','retry');
  return found;
end $$;
revoke all on function public.claim_strong_match_batch(uuid,timestamptz),public.freeze_strong_match_batch(uuid,uuid,jsonb),
  public.start_strong_match_attempt(uuid,uuid),public.accept_strong_match_batch(uuid,uuid,text),
  public.defer_strong_match_batch(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_strong_match_batch(uuid,timestamptz),public.freeze_strong_match_batch(uuid,uuid,jsonb),
  public.start_strong_match_attempt(uuid,uuid),public.accept_strong_match_batch(uuid,uuid,text),
  public.defer_strong_match_batch(uuid,uuid,text,text) to service_role;
commit;
