-- READ-ONLY. Run before migration, then after it using the indicated sections.

-- Keep these exact engine/view definitions as your before/after comparison.
select p.proname,md5(pg_get_functiondef(p.oid)) as definition_hash
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('_get_job_matches_for_user','_get_my_job_matches_v2','get_my_job_matches',
   'claim_strong_match_batch','freeze_strong_match_batch','start_strong_match_attempt',
   'accept_strong_match_batch','defer_strong_match_batch');
select md5(pg_get_viewdef('public.public_jobs'::regclass,true)) as public_jobs_hash;
select column_name,data_type,is_nullable,column_default from information_schema.columns
where table_schema='public' and table_name='job_preferences' and column_name in ('daily_digest','email_strong_matches');

-- AFTER migration 003. Permission checks, no sending and no state mutations.
select has_function_privilege('service_role','public.claim_daily_digest(uuid,timestamptz,timestamptz)','execute') as service_claim,
  has_function_privilege('authenticated','public.claim_daily_digest(uuid,timestamptz,timestamptz)','execute') as browser_claim,
  has_table_privilege('authenticated','public.daily_digest_deliveries','select') as browser_ledger;

-- AFTER activation: aggregate monitoring without printing addresses/payloads.
select digest_day,status,count(*) as users from public.daily_digest_deliveries
group by digest_day,status order by digest_day desc,status;
select id,user_id,digest_day,status,attempts,first_attempt_at,resend_id,accepted_at,last_error,
  jsonb_array_length(items) as job_count
from public.daily_digest_deliveries order by created_at desc limit 30;
select user_id,digest_day,count(*) from public.daily_digest_deliveries
group by user_id,digest_day having count(*)>1;
