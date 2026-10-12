-- Reviewed against VeeAys schema on 12 October 2026. No account is deleted by installation.
begin;
create schema if not exists veeays_private;
revoke all on schema veeays_private from public, anon, authenticated;
create table if not exists veeays_private.deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table veeays_private.deletion_requests enable row level security;
revoke all on veeays_private.deletion_requests from public,anon,authenticated,service_role;

create or replace function veeays_private.guard_checkout_deletion() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
  -- Serializes new checkout creation with deletion, including requests already in flight.
  perform 1 from public.profiles where id=new.user_id for update;
  if not found or exists(select 1 from veeays_private.deletion_requests where user_id=new.user_id) then
    raise exception 'Account unavailable for checkout';
  end if;
  return new;
end $$;
revoke all on function veeays_private.guard_checkout_deletion() from public,anon,authenticated;
drop trigger if exists guard_checkout_deletion on public.pro_payments;
create trigger guard_checkout_deletion before insert on public.pro_payments
for each row execute function veeays_private.guard_checkout_deletion();

create or replace function public.prepare_account_deletion(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare pending jsonb;
begin
  if current_setting('request.jwt.claims',true)::jsonb->>'role' is distinct from 'service_role' then
    raise exception 'Forbidden';
  end if;
  perform 1 from public.profiles where id=p_user_id for update;
  if not found and not exists(select 1 from auth.users where id=p_user_id) then
    return jsonb_build_object('missing',true);
  end if;
  if exists(select 1 from veeays_admin.accounts where user_id=p_user_id) then
    raise exception 'Administrator account requires assisted deletion';
  end if;
  -- Do not delete while an unknown provider checkout may be being created.
  if exists(select 1 from public.pro_payments where user_id=p_user_id and
    (status='creating' or (status='creation_failed' and checkout_id is null))) then
    raise exception 'Checkout creation requires reconciliation';
  end if;
  insert into veeays_private.deletion_requests(user_id) values(p_user_id) on conflict do nothing;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'checkout_id',checkout_id,'livemode',livemode)), '[]'::jsonb)
    into pending from public.pro_payments where user_id=p_user_id and checkout_id is not null;
  return jsonb_build_object('checkouts',pending);
end $$;
revoke all on function public.prepare_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;

create or replace function public.finish_account_deletion(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if current_setting('request.jwt.claims',true)::jsonb->>'role' is distinct from 'service_role' then
    raise exception 'Forbidden';
  end if;
  -- Same scheduler locks: no new email claim can race the cleanup transaction.
  perform pg_advisory_xact_lock(78236419);
  perform pg_advisory_xact_lock(78236420);
  perform 1 from public.profiles where id=p_user_id for update;
  if not found and not exists(select 1 from auth.users where id=p_user_id) then
    return jsonb_build_object('deleted',true);
  end if;
  if not exists(select 1 from veeays_private.deletion_requests where user_id=p_user_id) then
    raise exception 'Deletion not prepared';
  end if;
  if exists(select 1 from veeays_admin.accounts where user_id=p_user_id) then raise exception 'Forbidden'; end if;
  perform 1 from public.pro_payments where user_id=p_user_id for update;
  perform 1 from public.strong_match_batches where user_id=p_user_id for update;
  perform 1 from public.daily_digest_deliveries where user_id=p_user_id for update;
  if exists(select 1 from public.strong_match_batches where user_id=p_user_id and lease_until>now())
    or exists(select 1 from public.daily_digest_deliveries where user_id=p_user_id and lease_until>now()) then
    raise exception 'Email delivery in progress; retry shortly';
  end if;
  -- Clean queues without auth FKs, before cascading notification rows.
  delete from public.manual_strong_match_deliveries where notification_id in
    (select id::text from public.job_match_notifications where user_id=p_user_id);
  delete from public.strong_match_batch_items where batch_id in
    (select id from public.strong_match_batches where user_id=p_user_id);
  delete from public.strong_match_batches where user_id=p_user_id;
  delete from public.daily_digest_deliveries where user_id=p_user_id;
  delete from public._alfred_preferences_backup where user_id=p_user_id;
  -- Preserve detached financial/reconciliation references; discard checkout access URL.
  delete from public.pro_payments where user_id=p_user_id and checkout_id is null and payment_id is null;
  update public.pro_payments set user_id=null,checkout_url=null,entitlement_before=null,
    entitlement_expires_at=null,entitlement_outcome='account_deleted',updated_at=now()
    where user_id=p_user_id;
  -- Auth cascades remove identities, sessions, refresh tokens, factors, profile,
  -- preferences, saves, applications, match notifications and linked traffic.
  -- Include legacy refresh tokens that have no session FK.
  delete from auth.refresh_tokens where user_id=p_user_id::text;
  delete from auth.users where id=p_user_id;
  return jsonb_build_object('deleted',true);
end $$;
revoke all on function public.finish_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.finish_account_deletion(uuid) to service_role;
commit;
