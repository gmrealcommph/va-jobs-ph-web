-- READ ONLY. Run before migration/activation. Never displays secret credentials.
-- Notification age/order requires discovered_at, never a notification created_at column.
select table_name,column_name,data_type,is_nullable from information_schema.columns
where table_schema='public' and table_name in ('job_match_notifications','profiles','job_preferences','jobs','public_jobs')
order by table_name,ordinal_position;
select pg_get_viewdef('public.public_jobs'::regclass,true) as public_job_availability_contract;
select id,notification_type,discovered_at,notified_at from public.job_match_notifications where id::text='165';
select notification_id,resend_id,accepted_at,created_at from public.manual_strong_match_deliveries order by created_at;
select notification_type,count(*) from public.job_match_notifications where notified_at is null group by notification_type;
select table_name from information_schema.tables where table_schema='public'
  and table_name in ('strong_match_batches','strong_match_batch_items');

-- After migration: read-only monitoring; do not query payload unless recipient/body inspection is needed.
-- select id,user_id,status,attempts,first_attempt_at,next_attempt_at,resend_id,last_error from public.strong_match_batches order by created_at desc;
