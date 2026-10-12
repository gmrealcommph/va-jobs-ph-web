-- Staged only. Independent webhook must be configured before activation.
create table if not exists veeays_admin.alert_outbox(
 incident_key text primary key check(length(incident_key)<=240),
 payload jsonb not null check(pg_column_size(payload)<2048),
 created_at timestamptz not null default now(),
 lease_token uuid,lease_until timestamptz,attempts integer not null default 0,
 delivered_at timestamptz
);
alter table veeays_admin.alert_outbox enable row level security;
revoke all on veeays_admin.alert_outbox from public,anon,authenticated;
grant usage on schema veeays_admin to service_role;
create or replace function veeays_admin.claim_alert(p_key text,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' set statement_timeout='3s' as $$
declare token uuid;
begin
if p_key is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or p_payload->>'key' is distinct from p_key or p_payload->>'severity' is null or p_payload->>'severity' not in ('warning','high','critical') then raise exception 'Invalid alert';end if;
delete from veeays_admin.alert_outbox where created_at<now()-interval '90 days';
insert into veeays_admin.alert_outbox(incident_key,payload) values(p_key,p_payload) on conflict do nothing;
update veeays_admin.alert_outbox set lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1
where incident_key=p_key and delivered_at is null and (lease_until is null or lease_until<now()) and attempts<8
returning lease_token into token;
return token;
end;$$;
revoke all on function veeays_admin.claim_alert(text,jsonb) from public,anon,authenticated;
grant execute on function veeays_admin.claim_alert(text,jsonb) to service_role;
create or replace function public.veeays_admin_claim_alert(p_key text,p_payload jsonb) returns uuid
language sql security invoker set search_path='' as $$select veeays_admin.claim_alert(p_key,p_payload);$$;
revoke all on function public.veeays_admin_claim_alert(text,jsonb) from public,anon,authenticated;
grant execute on function public.veeays_admin_claim_alert(text,jsonb) to service_role;
create or replace function veeays_admin.ack_alert(p_key text,p_token uuid) returns boolean
language plpgsql security definer set search_path='' set statement_timeout='3s' as $$
begin
update veeays_admin.alert_outbox set delivered_at=now(),lease_until=null where incident_key=p_key and lease_token=p_token and delivered_at is null;
return found;
end;$$;
revoke all on function veeays_admin.ack_alert(text,uuid) from public,anon,authenticated;
grant execute on function veeays_admin.ack_alert(text,uuid) to service_role;
create or replace function public.veeays_admin_ack_alert(p_key text,p_token uuid) returns boolean
language sql security invoker set search_path='' as $$select veeays_admin.ack_alert(p_key,p_token);$$;
revoke all on function public.veeays_admin_ack_alert(text,uuid) from public,anon,authenticated;
grant execute on function public.veeays_admin_ack_alert(text,uuid) to service_role;
