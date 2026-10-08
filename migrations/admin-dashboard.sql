create schema if not exists veeays_admin;
revoke all on schema veeays_admin from public, anon;
grant usage on schema veeays_admin to authenticated;
create table if not exists veeays_admin.accounts(user_id uuid primary key references auth.users(id) on delete cascade);
alter table veeays_admin.accounts enable row level security;
revoke all on veeays_admin.accounts from public, anon, authenticated;
insert into veeays_admin.accounts(user_id) select id from auth.users where lower(email)='gm.realcommph@gmail.com' on conflict do nothing;
create or replace function veeays_admin.has_access() returns boolean
language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(select 1 from veeays_admin.accounts where user_id=auth.uid());
$$;
revoke all on function veeays_admin.has_access() from public,anon;
grant execute on function veeays_admin.has_access() to authenticated;
create or replace function public.veeays_admin_access() returns boolean
language sql stable security invoker set search_path='' as $$ select veeays_admin.has_access(); $$;
revoke all on function public.veeays_admin_access() from public,anon;
grant execute on function public.veeays_admin_access() to authenticated;
create or replace function veeays_admin.analytics(p_start date,p_end date) returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='8s' as $$
declare result jsonb; start_at timestamptz; end_at timestamptz;
begin
if not veeays_admin.has_access() then raise exception 'Admin access required' using errcode='42501'; end if;
if p_start is null or p_end is null or p_end < p_start or p_end-p_start > 90 or p_end > (now() at time zone 'Asia/Manila')::date then
raise exception 'Invalid period' using errcode='22023'; end if;
start_at := p_start::timestamp at time zone 'Asia/Manila';
end_at := (p_end+1)::timestamp at time zone 'Asia/Manila';
select jsonb_build_object(
'generated_at',now(),'start',p_start,'end',p_end,
'members',(select count(*) from auth.users),
'new_members',(select count(*) from auth.users where created_at>=start_at and created_at<end_at),
'pro_access',(select count(*) from public.profiles where plan='pro' and plan_status='active' and (pro_expires_at is null or pro_expires_at>now())),
'paid_pro_members',(select count(distinct p.user_id) from public.pro_payments p join public.profiles u on u.id=p.user_id where p.livemode and p.status='confirmed' and u.plan='pro' and u.plan_status='active' and (u.pro_expires_at is null or u.pro_expires_at>now())),
'live_jobs',(select count(*) from public.public_jobs),
'new_live_jobs',(select count(*) from public.jobs j join public.public_jobs v on v.id=j.id where j.created_at>=start_at and j.created_at<end_at),
'new_jobs',(select count(*) from public.jobs where created_at>=start_at and created_at<end_at),
'revenue',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select currency,sum(amount)::numeric/100 amount,count(*) payments from public.pro_payments where livemode and status='confirmed' and paid_at>=start_at and paid_at<end_at group by currency) x),
'payment_events',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select status,livemode,count(*) count from public.pro_payments where created_at>=start_at and created_at<end_at group by status,livemode order by livemode desc,status) x),
'quick_reads',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select status,count(*) count from public.job_quick_reads group by status order by status) x),
'quick_period',(select jsonb_build_object('completed',count(*) filter(where status='ready' and generated_at>=start_at and generated_at<end_at),'errors',count(*) filter(where status='failed' and updated_at>=start_at and updated_at<end_at)) from public.job_quick_reads),
'queue',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select state,count(*) count from public.quick_read_auto_queue group by state order by state) x),
'pilot',(select to_jsonb(x) from (select enabled,claims,budget_usd,reserved_usd,worst_request_usd from public.quick_read_rollout_stop limit 1) x),
'automation',(select to_jsonb(x) from (select enabled,activated_at from public.quick_read_auto_control limit 1) x),
'errors',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select job_id,error_code,updated_at from public.job_quick_reads where status='failed' and updated_at>=start_at and updated_at<end_at order by updated_at desc limit 12) x),
'imports',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select source,max(collected_at) last_collected_at,count(*) filter(where created_at>=start_at and created_at<end_at) new_jobs,count(*) filter(where status='active' and philippines_eligible) eligible_active_rows from public.jobs group by source order by max(collected_at) desc nulls last limit 30) x),
'daily',(select coalesce(jsonb_agg(to_jsonb(x) order by x.day),'[]') from (
with days as(select generate_series(p_start::timestamp,p_end::timestamp,'1 day')::date as day),
m as(select (created_at at time zone 'Asia/Manila')::date as day,count(*) n from auth.users where created_at>=start_at and created_at<end_at group by 1),
j as(select (created_at at time zone 'Asia/Manila')::date as day,count(*) n from public.jobs where created_at>=start_at and created_at<end_at group by 1),
q as(select (generated_at at time zone 'Asia/Manila')::date as day,count(*) n from public.job_quick_reads where status='ready' and generated_at>=start_at and generated_at<end_at group by 1),
p as(select (paid_at at time zone 'Asia/Manila')::date as day,sum(amount)::numeric/100 n from public.pro_payments where livemode and status='confirmed' and currency='PHP' and paid_at>=start_at and paid_at<end_at group by 1)
select d.day,coalesce(m.n,0) members,coalesce(j.n,0) jobs,coalesce(q.n,0) quick_reads,coalesce(p.n,0) revenue_php from days d left join m using(day) left join j using(day) left join q using(day) left join p using(day)
) x)
) into result;
return result;
end; $$;
revoke all on function veeays_admin.analytics(date,date) from public,anon;
grant execute on function veeays_admin.analytics(date,date) to authenticated;
create or replace function public.veeays_admin_analytics(p_start date,p_end date) returns jsonb
language sql stable security invoker set search_path='' as $$ select veeays_admin.analytics(p_start,p_end); $$;
revoke all on function public.veeays_admin_analytics(date,date) from public,anon;
grant execute on function public.veeays_admin_analytics(date,date) to authenticated;
