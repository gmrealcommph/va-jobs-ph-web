-- READ ONLY. Supabase SQL Editor, as project owner. Run preflight before 004.
select column_name,data_type from information_schema.columns
where table_schema='public' and table_name='jobs'
and column_name in ('id','description','status','philippines_eligible','employment_type','engagement_type',
 'salary_min','salary_max','salary_currency','salary_period','schedule_region','experience_level');
select pg_get_viewdef('public.public_jobs'::regclass,true) as existing_dedupe_definition;
select n.nspname as pgcrypto_schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
-- 004 expects Supabase's usual pgcrypto schema = extensions. If it differs, stop
-- and adapt digest qualification in 004; do not relocate an existing extension.
select id,title,company,description from public.public_jobs
where company ilike '%TechnologyAdvice%' and title ilike '%Client Success Operations Coordinator%';

-- AFTER migration/deployment; verify one job, public projection and access boundaries.
select public.public_job_detail_enrichment('37688');
select job_id,status,formatter_version,schema_version,model,source_hash,generated_at,error_code,retry_after
from public.job_quick_reads where job_id='37688';
select has_table_privilege('anon','public.job_quick_reads','select') as must_be_false,
 has_function_privilege('anon','public.claim_job_quick_read(text,text,uuid)','execute') as must_also_be_false,
 has_function_privilege('anon','public.public_job_detail_enrichment(text)','execute') as must_be_true;
-- Examine ready payload and source side by side in SQL Editor for the ONE acceptance job.
select j.description as original,q.payload from public.jobs j
left join public.job_quick_reads q on q.job_id=j.id::text where j.id::text='37688';
