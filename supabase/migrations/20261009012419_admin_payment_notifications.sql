begin;
create or replace function veeays_admin.payment_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='3s' as $$
begin
if not coalesce(veeays_admin.has_access(),false) then raise exception 'Admin access required' using errcode='42501'; end if;
return jsonb_build_object('available',true,'generated_at',now(),
'events',(select coalesce(jsonb_agg(to_jsonb(x) order by x.confirmed_at,x.event_id),'[]'::jsonb)
from (select pg_catalog.md5('payment:'||id::text) event_id,confirmed_at,amount amount_minor,currency
from public.pro_payments where livemode is true and status='confirmed' and payment_id is not null
and paid_at is not null and confirmed_at>=now()-interval '24 hours' and confirmed_at<=now()
and amount>0 and currency='PHP' order by confirmed_at desc,id desc limit 200) x));
end; $$;
revoke all on function veeays_admin.payment_snapshot() from public,anon;
grant execute on function veeays_admin.payment_snapshot() to authenticated;
create or replace function public.veeays_admin_payment_snapshot() returns jsonb
language sql stable security invoker set search_path='' as $$ select veeays_admin.payment_snapshot(); $$;
revoke all on function public.veeays_admin_payment_snapshot() from public,anon;
grant execute on function public.veeays_admin_payment_snapshot() to authenticated;
commit;
