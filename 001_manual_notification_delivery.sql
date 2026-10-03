-- Run once in Supabase SQL Editor before using the protected manual endpoint.
-- This adds an isolated delivery ledger; existing tables and policies are untouched.
begin;
create table if not exists public.manual_strong_match_deliveries (
  notification_id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  resend_id text,
  accepted_at timestamptz,
  constraint acceptance_pair check ((resend_id is null) = (accepted_at is null))
);
alter table public.manual_strong_match_deliveries enable row level security;
revoke all on public.manual_strong_match_deliveries from public, anon, authenticated;
grant select, insert, update on public.manual_strong_match_deliveries to service_role;
commit;
