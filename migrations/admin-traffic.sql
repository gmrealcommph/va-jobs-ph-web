begin;
create table if not exists veeays_admin.traffic_config(id boolean primary key default true check(id),started_at timestamptz not null default now());
insert into veeays_admin.traffic_config(id) values(true) on conflict do nothing;
create table if not exists veeays_admin.traffic_sessions(
 id uuid primary key,created_at timestamptz not null default now(),landing text not null,
 source text,medium text,campaign text,channel text not null,
 user_id uuid unique references auth.users(id) on delete cascade,registered_at timestamptz,
 check(length(landing)<=128),check(source is null or source ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
 check(medium is null or medium ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),check(campaign is null or campaign ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
 check(channel in ('Direct / unknown','Facebook','LinkedIn','Google organic','Google organic (inferred)','Referrals','Paid campaigns','Campaign / other'))
);
create index if not exists traffic_sessions_created on veeays_admin.traffic_sessions(created_at);
alter table veeays_admin.traffic_sessions enable row level security;
alter table veeays_admin.traffic_config enable row level security;
revoke all on veeays_admin.traffic_sessions,veeays_admin.traffic_config from public,anon,authenticated;
create or replace function public.veeays_traffic_record(p_id uuid,p_landing text,p_source text,p_medium text,p_campaign text,p_channel text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_landing !~ '^/(jobs(/[1-9][0-9]{0,18})?|categories(/[A-Za-z0-9%_-]{1,100})?|employers|about|pro)?/?$' then raise exception 'Invalid public landing';end if;
 insert into veeays_admin.traffic_sessions(id,landing,source,medium,campaign,channel) values(p_id,p_landing,p_source,p_medium,p_campaign,p_channel) on conflict(id) do nothing;
 return exists(select 1 from veeays_admin.traffic_sessions where id=p_id and created_at>now()-interval '30 minutes');
end;$$;
create or replace function public.veeays_traffic_forget(p_id uuid)
returns void language sql security definer set search_path='' as $$delete from veeays_admin.traffic_sessions where id=p_id;$$;
create or replace function public.veeays_traffic_register(p_id uuid,p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 -- A signup API success can mask an existing account. Only a newly created real account qualifies.
 if exists(select 1 from auth.users where id=p_user and created_at>=now()-interval '2 minutes') then
  update veeays_admin.traffic_sessions s set user_id=p_user,registered_at=u.created_at from auth.users u
  where s.id=p_id and u.id=p_user and s.user_id is null and s.created_at>now()-interval '30 minutes'
   and u.created_at>=s.created_at and not exists(select 1 from veeays_admin.traffic_sessions where user_id=p_user);
 end if;
end;$$;
revoke all on function public.veeays_traffic_record(uuid,text,text,text,text,text),public.veeays_traffic_forget(uuid),public.veeays_traffic_register(uuid,uuid) from public,anon,authenticated;
grant execute on function public.veeays_traffic_record(uuid,text,text,text,text,text),public.veeays_traffic_forget(uuid),public.veeays_traffic_register(uuid,uuid) to service_role;
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
 landings as(select landing,count(*) sessions from cohort group by landing order by sessions desc,landing limit 20)
 select jsonb_build_object('available',true,'started_at',(select started_at from veeays_admin.traffic_config where id),'checked_at',now(),'sessions',(select count(*) from cohort),'registrations',(select count(user_id) from cohort),'sources',coalesce((select jsonb_agg(to_jsonb(s) order by sessions desc,channel) from sources s),'[]'::jsonb),'landings',coalesce((select jsonb_agg(to_jsonb(l)) from landings l),'[]'::jsonb),'historical_unavailable',p_start::timestamp at time zone 'Asia/Manila'<(select started_at from veeays_admin.traffic_config where id),'retention_days',90) into result;
 return result;
end;$$;
revoke all on function public.veeays_admin_traffic(date,date) from public,anon;
grant execute on function public.veeays_admin_traffic(date,date) to authenticated;
commit;
