create or replace function veeays_admin.registration_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='3s' as $$
begin
if not veeays_admin.has_access() then raise exception 'Admin access required' using errcode='42501'; end if;
return jsonb_build_object('available',true,'generated_at',now(),
'events',(select coalesce(jsonb_agg(to_jsonb(x) order by x.registered_at,x.event_id),'[]')
from (select pg_catalog.md5(id::text) event_id,created_at registered_at from auth.users
where created_at>=now()-interval '24 hours' order by created_at desc,id desc limit 200) x),
'recent_count',(select count(*) from auth.users where created_at>=now()-interval '24 hours'));
end; $$;
revoke all on function veeays_admin.registration_snapshot() from public,anon;
grant execute on function veeays_admin.registration_snapshot() to authenticated;
create or replace function public.veeays_admin_registration_snapshot() returns jsonb
language sql stable security invoker set search_path='' as $$ select veeays_admin.registration_snapshot(); $$;
revoke all on function public.veeays_admin_registration_snapshot() from public,anon;
grant execute on function public.veeays_admin_registration_snapshot() to authenticated;
