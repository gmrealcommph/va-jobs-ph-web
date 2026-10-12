-- Read-only monitoring. No claims, retries, spending changes or queue writes.
create or replace function veeays_admin.quick_reads() returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='5s' as $$
declare result jsonb;
begin
if not veeays_admin.has_access() then raise exception 'Admin access required' using errcode='42501'; end if;
with queue as (
 select a.job_id,a.state,a.inserted_at,a.next_attempt_at,a.updated_at queue_updated_at,
 q.status,q.error_code,q.updated_at,q.generated_at,q.lease_until,j.title
 from public.quick_read_auto_queue a left join public.job_quick_reads q using(job_id)
 left join public.jobs j on j.id::text=a.job_id
), running as (
 select q.job_id,j.title,q.updated_at started_at,q.lease_until
 from public.job_quick_reads q left join public.jobs j on j.id::text=q.job_id where q.status='running'
)
select jsonb_build_object(
 'checked_at',now(),'scope','Automatic queue; current records, not attempt history',
 'counts',(select jsonb_build_object(
   'queued',count(*) filter(where state='pending'),
   'processing',count(*) filter(where state='running'),
   'completed',count(*) filter(where state='done'),
   'failed',count(*) filter(where state='stopped' and status='failed'),
   'stopped_other',count(*) filter(where state='stopped' and status is distinct from 'failed'),
   'total',count(*)) from queue),
 'all_reads',(select jsonb_build_object('ready',count(*) filter(where status='ready'),'failed',count(*) filter(where status='failed'),'running',count(*) filter(where status='running')) from public.job_quick_reads),
 'running',coalesce((select jsonb_agg(to_jsonb(r) order by r.started_at) from running r),'[]'),
 'unmatched_running',(select count(*) from queue where state='running' and status is distinct from 'running'),
 'gate',(select jsonb_build_object('enabled',enabled) from public.quick_read_rollout_stop where id),
 'automation',(select jsonb_build_object('enabled',enabled,'activated_at',activated_at) from public.quick_read_auto_control where id),
 'oldest_due',(select min(next_attempt_at) from queue where state='pending' and next_attempt_at<=now()),
 'latest_worker_record',(select max(updated_at) from public.job_quick_reads),
 'latest_completion',(select jsonb_build_object('job_id',job_id,'title',title,'at',generated_at) from queue where status='ready' and generated_at is not null order by generated_at desc limit 1),
 'throughput',(select jsonb_build_object('last_hour',count(*) filter(where generated_at>=now()-interval '1 hour'),'last_24h',count(*) filter(where generated_at>=now()-interval '24 hours')) from queue where status='ready'),
 'recent',coalesce((select jsonb_agg(to_jsonb(x) order by x.at desc) from (
   select job_id,title,case when state='pending' then 'queued' when state='done' then 'completed' when state='running' then 'processing' when status='failed' then 'failed' else 'stopped' end event,
   case when state='pending' then inserted_at when state='done' then coalesce(generated_at,queue_updated_at) else queue_updated_at end at,
   error_code from queue order by at desc limit 12
 ) x),'[]')
) into result;
return result;
end; $$;
revoke all on function veeays_admin.quick_reads() from public,anon;
grant execute on function veeays_admin.quick_reads() to authenticated;
create or replace function public.veeays_admin_quick_reads() returns jsonb
language sql stable security invoker set search_path='' as $$ select veeays_admin.quick_reads(); $$;
revoke all on function public.veeays_admin_quick_reads() from public,anon;
grant execute on function public.veeays_admin_quick_reads() to authenticated;
