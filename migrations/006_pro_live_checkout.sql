-- LIVE payment ledger. Uses the existing profiles entitlement fields.
begin;
create table public.pro_payments (
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  checkout_id text unique,
  checkout_url text,
  payment_id text unique,
  event_id text,
  amount integer not null check (amount = 49900),
  currency text not null check (currency = 'PHP'),
  livemode boolean not null default true check (livemode = true),
  status text not null check (status in ('creating','pending','creation_failed','confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  confirmed_at timestamptz,
  entitlement_before timestamptz,
  entitlement_expires_at timestamptz,
  entitlement_outcome text check (entitlement_outcome in ('granted','extended','unlimited_preserved')),
  check (status <> 'confirmed' or (checkout_id is not null and payment_id is not null and paid_at is not null
    and confirmed_at is not null and entitlement_outcome is not null))
);
create index pro_payments_user_created on public.pro_payments(user_id,created_at desc);
alter table public.pro_payments enable row level security;
revoke all on public.pro_payments from public, anon, authenticated;
grant select, insert, update on public.pro_payments to service_role;

-- Defense against permissive profile policies or an older browser-callable RPC.
-- Profile name/onboarding edits are unaffected; service-role and SQL operator edits remain valid.
create function public.protect_profile_live_entitlement() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare caller text := coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
  nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','');
begin
  if (current_setting('role',true) in ('anon','authenticated') or caller in ('anon','authenticated')) then
    if TG_OP = 'INSERT' then
      if new.plan is distinct from 'free' or new.pro_expires_at is not null then
        raise exception 'Browser cannot set entitlement';
      end if;
    elsif (new.plan,new.plan_status,new.pro_expires_at) is distinct from (old.plan,old.plan_status,old.pro_expires_at) then
      raise exception 'Browser cannot set entitlement';
    end if;
  end if;
  return new;
end $$;
create trigger protect_profile_live_entitlement before insert or update on public.profiles
for each row execute function public.protect_profile_live_entitlement();

create function public.accept_pro_payment(p_id uuid,p_checkout_id text,p_payment_id text,p_event_id text,
  p_amount integer,p_currency text,p_state text,p_livemode boolean,p_paid_at timestamptz)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare receipt public.pro_payments%rowtype; member public.profiles%rowtype;
  expiry timestamptz; outcome text;
begin
  if p_amount is distinct from 49900 or p_currency is distinct from 'PHP' or p_state is distinct from 'paid'
    or p_livemode is distinct from true or p_paid_at is null or p_paid_at > now()+interval '5 minutes'
    or p_payment_id is null or p_payment_id !~ '^pay_[A-Za-z0-9]+$' then
    raise exception 'Invalid live payment';
  end if;
  select * into receipt from public.pro_payments where id=p_id for update;
  if not found or receipt.checkout_id is distinct from p_checkout_id or receipt.amount <> p_amount
    or receipt.currency <> p_currency or not receipt.livemode or p_paid_at < receipt.created_at-interval '5 minutes' then
    raise exception 'Payment ownership mismatch';
  end if;
  if receipt.status='confirmed' then
    if receipt.payment_id is distinct from p_payment_id then raise exception 'Payment already credited'; end if;
    return jsonb_build_object('duplicate',true,'expires_at',receipt.entitlement_expires_at,'outcome',receipt.entitlement_outcome);
  end if;
  if receipt.status <> 'pending' then raise exception 'Checkout not ready'; end if;
  -- Locks serialize separate purchases for the same member as well as duplicate deliveries.
  select * into member from public.profiles where id=receipt.user_id for update;
  if not found then raise exception 'Missing profile'; end if;
  if member.plan='pro' and member.plan_status='active' and member.pro_expires_at is null then
    expiry := null; outcome := 'unlimited_preserved';
  elsif member.plan='pro' and member.plan_status='active' and member.pro_expires_at > p_paid_at then
    expiry := member.pro_expires_at + interval '30 days'; outcome := 'extended';
  else
    expiry := p_paid_at + interval '30 days'; outcome := 'granted';
  end if;
  update public.profiles set plan='pro',plan_status='active',pro_expires_at=expiry where id=receipt.user_id;
  update public.pro_payments set status='confirmed',payment_id=p_payment_id,event_id=p_event_id,
    paid_at=p_paid_at,confirmed_at=now(),updated_at=now(),entitlement_before=member.pro_expires_at,
    entitlement_expires_at=expiry,entitlement_outcome=outcome where id=p_id;
  return jsonb_build_object('duplicate',false,'expires_at',expiry,'outcome',outcome);
end $$;
revoke all on function public.accept_pro_payment(uuid,text,text,text,integer,text,text,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.accept_pro_payment(uuid,text,text,text,integer,text,text,boolean,timestamptz) to service_role;
commit;
