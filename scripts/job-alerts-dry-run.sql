-- Read-only scenario analysis before installation or enrollment. No recipient identities.
with candidates as (
 select j.* from public.jobs j join public.public_jobs v using(id)
 where j.status='active' and j.philippines_eligible
 and coalesce(j.first_imported_at,j.created_at)>=date_trunc('day',now())-interval '7 days'
 and coalesce(j.first_imported_at,j.created_at)<date_trunc('day',now())
 and (coalesce(j.original_posted_at,j.posted_at) is null or coalesce(j.original_posted_at,j.posted_at)>date_trunc('day',now())-interval '45 days')
 and not exists(select 1 from veeays_job_health.observations o where o.job_id=j.id and o.source=j.source and o.source_job_id=j.source_job_id and o.job_url=j.job_url and o.status='closed'
 and not exists(select 1 from veeays_job_health.observations n where n.job_id=o.job_id and n.source=o.source and n.source_job_id=o.source_job_id and n.job_url=o.job_url and n.checked_at>o.checked_at))
)
select jsonb_build_object('checked_at',now(),'weekly_pool',count(*),'latest_daily_imports',count(*) filter(where coalesce(first_imported_at,created_at)>=date_trunc('day',now())-interval '1 day'),
'full_time',count(*) filter(where employment_type='full_time'),'part_time',count(*) filter(where employment_type='part_time'),
'monthly_usd_minimum_1000',count(*) filter(where salary_period='monthly' and salary_min_usd>=1000)) as dry_run from candidates;
-- After installation, settings start empty and disabled. Do not simulate consent by
-- enrolling real members. Re-run matching against explicit opt-ins before activation.
