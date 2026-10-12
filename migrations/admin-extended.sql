-- Staged additive migration. Apply only after the release checkpoint.
-- Existing allowlist is required; no auth, payment, queue or budget writes.
create or replace function veeays_admin.extended(p_start date,p_end date) returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='8s' as $$
declare start_at timestamptz;end_at timestamptz;result jsonb;
begin
if not veeays_admin.has_access() then raise exception 'Admin access required' using errcode='42501';end if;
if p_start is null or p_end is null or p_end<p_start or p_end-p_start>90 or p_end>(now() at time zone 'Asia/Manila')::date then raise exception 'Invalid period' using errcode='22023';end if;
start_at:=p_start::timestamp at time zone 'Asia/Manila';end_at:=(p_end+1)::timestamp at time zone 'Asia/Manila';
select jsonb_build_object('available',true,'generated_at',now(),
'members',(select jsonb_build_object(
 'registered',count(*),'verified',count(*) filter(where u.email_confirmed_at is not null),
 'unverified',count(*) filter(where u.email_confirmed_at is null),
 'free_plan',count(*) filter(where p.plan='free'),
 'missing_profile',count(*) filter(where p.id is null),
 'active_pro',count(*) filter(where p.plan='pro' and p.plan_status='active' and (p.pro_expires_at is null or p.pro_expires_at>now())),
 'expiring_7d',count(*) filter(where p.plan='pro' and p.plan_status='active' and p.pro_expires_at>now() and p.pro_expires_at<=now()+interval '7 days'),
 'active_pro_with_purchase',count(*) filter(where p.plan='pro' and p.plan_status='active' and (p.pro_expires_at is null or p.pro_expires_at>now()) and exists(select 1 from public.pro_payments pay where pay.user_id=u.id and pay.livemode and pay.status='confirmed')),
 'active_pro_without_purchase_record',count(*) filter(where p.plan='pro' and p.plan_status='active' and (p.pro_expires_at is null or p.pro_expires_at>now()) and not exists(select 1 from public.pro_payments pay where pay.user_id=u.id and pay.livemode and pay.status='confirmed')),
 'cohort_registered',count(*) filter(where u.created_at>=start_at and u.created_at<end_at),
 'cohort_verified_now',count(*) filter(where u.created_at>=start_at and u.created_at<end_at and u.email_confirmed_at is not null),
 'cohort_purchased_now',count(*) filter(where u.created_at>=start_at and u.created_at<end_at and exists(select 1 from public.pro_payments pay where pay.user_id=u.id and pay.livemode and pay.status='confirmed'))
) from auth.users u left join public.profiles p on p.id=u.id),
'job_quality',(select jsonb_build_object(
 'active_rows',count(*) filter(where status='active'),
 'active_posted_over_30d',count(*) filter(where status='active' and posted_at<now()-interval '30 days'),
 'active_missing_posted_at',count(*) filter(where status='active' and posted_at is null),
 'inactive_rows',count(*) filter(where status<>'active'),
 'duplicate_url_groups',(select count(*) from(select job_url from public.jobs where job_url is not null and job_url<>'' group by job_url having count(*)>1)x),
 'duplicate_source_groups',(select count(*) from(select source,source_job_id from public.jobs where source_job_id is not null and source_job_id<>'' group by source,source_job_id having count(*)>1)x)
) from public.jobs),
'email',(select jsonb_build_object(
 'retrying',count(*) filter(where status='retry'),
 'held',count(*) filter(where status='held'),
 'accepted_in_period',count(*) filter(where accepted_at>=start_at and accepted_at<end_at),
 'acceptance_is_delivery',false
) from(select status,accepted_at from public.daily_digest_deliveries union all select status,accepted_at from public.strong_match_batches)x),
'revenue',jsonb_build_object('ledger','public.pro_payments','gross_basis','live confirmed, paid_at in period','fees_available',false,'refunds_available',false,'net_available',false),
'ai',jsonb_build_object('actual_spend_available',false,'estimates_available',false),
'system',jsonb_build_object('database_query_succeeded_at',now(),'uptime_available',false,'worker_error_history_available',false,'api_latency_history_available',false)
) into result;
return result;
end;$$;
revoke all on function veeays_admin.extended(date,date) from public,anon;
grant execute on function veeays_admin.extended(date,date) to authenticated;
create or replace function public.veeays_admin_extended(p_start date,p_end date) returns jsonb
language sql stable security invoker set search_path='' as $$select veeays_admin.extended(p_start,p_end);$$;
revoke all on function public.veeays_admin_extended(date,date) from public,anon;
grant execute on function public.veeays_admin_extended(date,date) to authenticated;
