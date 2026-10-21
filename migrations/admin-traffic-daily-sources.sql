-- Extend existing admin-only traffic RPC with daily session counts by channel.
-- No new permissions, events, tracking or changes to existing records.
begin;
create or replace function public.veeays_admin_traffic(p_start date,p_end date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not veeays_admin.has_access() then raise exception 'Admin access required' using errcode='42501';end if;
 if p_start is null or p_end is null or p_end<p_start or p_end-p_start>90 or p_end>(now() at time zone 'Asia/Manila')::date then raise exception 'Invalid period';end if;
 with cohort as (
  select s.*,exists(select 1 from public.pro_payments p where p.user_id=s.user_id and p.livemode and p.status='confirmed' and p.payment_id is not null and p.confirmed_at is not null and p.amount>0 and p.paid_at>=s.registered_at and p.paid_at<=now() and p.paid_at< s.created_at+interval '90 days') purchased
  from veeays_admin.traffic_sessions s where s.created_at>=p_start::timestamp at time zone 'Asia/Manila' and s.created_at<(p_end+1)::timestamp at time zone 'Asia/Manila' and s.created_at>=now()-interval '90 days'
 ),sources as (select channel,source,medium,campaign,count(*) sessions,count(user_id) registrations,count(*) filter(where purchased) pro_conversions from cohort group by channel,source,medium,campaign),
 daily as (
  select (created_at at time zone 'Asia/Manila')::date as day,
    count(*) as sessions,
    count(*) filter(where channel in ('Google organic','Google organic (inferred)')) as google_organic,
    count(*) filter(where channel='Direct / unknown') as direct_unknown,
    count(*) filter(where channel='Referrals') as referrals,
    count(*) filter(where channel='Facebook') as facebook,
    count(*) filter(where channel='LinkedIn') as linkedin,
    count(*) filter(where channel='Paid campaigns') as paid,
    count(*) filter(where channel='Campaign / other') as campaign_other
  from cohort group by 1
 ), landings as(select landing,count(*) sessions from cohort group by landing order by sessions desc,landing limit 20)
 select jsonb_build_object('available',true,'started_at',(select started_at from veeays_admin.traffic_config where id),'checked_at',now(),'sessions',(select count(*) from cohort),'registrations',(select count(user_id) from cohort),'sources',coalesce((select jsonb_agg(to_jsonb(s) order by sessions desc,channel) from sources s),'[]'::jsonb),'daily',coalesce((select jsonb_agg(to_jsonb(d) order by day desc) from daily d),'[]'::jsonb),'landings',coalesce((select jsonb_agg(to_jsonb(l)) from landings l),'[]'::jsonb),'historical_unavailable',p_start::timestamp at time zone 'Asia/Manila'<(select started_at from veeays_admin.traffic_config where id),'retention_days',90) into result;
 return result;
end;$$;
commit;
