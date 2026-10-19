-- One immutable authorization claim. Keep after removing the temporary route.
begin;
create table public.job_alert_test_claim (
 id text primary key check (id = 'smart-alerts-support-20261019'),
 claimed_at timestamptz not null default now(),
 provider_id text
);
alter table public.job_alert_test_claim enable row level security;
revoke all on public.job_alert_test_claim from public, anon, authenticated, service_role;
grant select, insert on public.job_alert_test_claim to service_role;
grant update (provider_id) on public.job_alert_test_claim to service_role;
commit;
