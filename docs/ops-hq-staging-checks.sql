-- Operations HQ: READ-ONLY staging checks. Run in the STAGING project only (megedmsfdwtjxjejrxaq) SQL editor.
-- No DDL/DML. Output contains metadata and counts only; no member, payment or job data.
-- Run CHECK A first, then CHECK B (each as its own run). Paste the single JSON result of each.

-- ===== CHECK A: catalog =====
select jsonb_pretty(jsonb_build_object(
 'database',current_database(),
 'functions',(select coalesce(jsonb_agg(jsonb_build_object('fn',n.nspname||'.'||p.proname,'args',pg_get_function_identity_arguments(p.oid),
    'returns',pg_get_function_result(p.oid),'security_definer',p.prosecdef,'config',p.proconfig,'owner',pg_get_userbyid(p.proowner),
    'anon_exec',has_function_privilege('anon',p.oid,'execute'),'authenticated_exec',has_function_privilege('authenticated',p.oid,'execute'),
    'checks_admin',p.prosrc ilike '%has_access%') order by n.nspname,p.proname),'[]'::jsonb)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='public' and p.proname in ('veeays_admin_access','veeays_admin_analytics','veeays_admin_quick_reads','veeays_admin_extended','veeays_admin_registration_snapshot','veeays_admin_payment_snapshot'))
     or (n.nspname='veeays_admin' and p.proname in ('has_access','analytics','quick_reads','extended','registration_snapshot','payment_snapshot'))),
 'missing_public_rpcs',(select coalesce(jsonb_agg(w),'[]'::jsonb) from unnest(array['veeays_admin_access','veeays_admin_analytics','veeays_admin_quick_reads','veeays_admin_extended','veeays_admin_registration_snapshot','veeays_admin_payment_snapshot']) w
  where not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=w)),
 'admin_accounts_count',case when to_regclass('veeays_admin.accounts') is null then null
  else ((xpath('/row/c/text()',query_to_xml('select count(*) c from veeays_admin.accounts',false,true,'')))[1])::text::int end,
 'tables',(select coalesce(jsonb_agg(jsonb_build_object('table',c.relnamespace::regnamespace::text||'.'||c.relname,'est_rows',c.reltuples::bigint,'total_size',pg_size_pretty(pg_total_relation_size(c.oid)))),'[]'::jsonb)
  from pg_class c where c.relkind='r' and (c.relnamespace::regnamespace::text||'.'||c.relname) in
  ('auth.users','public.profiles','public.jobs','public.pro_payments','public.job_quick_reads','public.quick_read_auto_queue','public.daily_digest_deliveries','public.strong_match_batches')),
 'indexes',(select coalesce(jsonb_agg(schemaname||'.'||tablename||': '||indexname),'[]'::jsonb) from pg_indexes
  where schemaname||'.'||tablename in ('auth.users','public.profiles','public.jobs','public.pro_payments','public.job_quick_reads','public.quick_read_auto_queue')),
 'referral_campaign_lifecycle_columns',(select coalesce(jsonb_agg(jsonb_build_object('table',table_schema||'.'||table_name,'columns',cols)),'[]'::jsonb)
  from (select table_schema,table_name,jsonb_agg(column_name||':'||data_type order by ordinal_position) cols from information_schema.columns
        where table_schema in ('veeays_referral','veeays_campaign','veeays_lifecycle') group by 1,2) s),
 'applied_supabase_migrations',case when to_regclass('supabase_migrations.schema_migrations') is null then null
  else ((xpath('/row/v/text()',query_to_xml('select coalesce(jsonb_agg(version order by version)::text,''[]'') v from supabase_migrations.schema_migrations',false,true,'')))[1])::text::jsonb end
)) as check_a;

-- ===== CHECK B: behaviour (read-only RPCs inside transactions that are rolled back; nothing is written) =====
-- B0: without an admin session the access check must be false (admin RPCs themselves raise 42501 'Admin access required').
begin;
select set_config('request.jwt.claims',json_build_object('role','authenticated')::text,true);
set local role authenticated;
select public.veeays_admin_access() as access_without_admin_session;   -- expect false
rollback;

-- B1: as the first admin account (rolled back)
begin;
select set_config('request.jwt.claims',json_build_object('sub',(select user_id::text from veeays_admin.accounts limit 1),'role','authenticated')::text,true);
set local role authenticated;
with d as (select (now() at time zone 'Asia/Manila')::date today),
 a as (select public.veeays_admin_analytics(d.today-1,d.today) v from d),
 q as (select public.veeays_admin_quick_reads() v),
 e as (select public.veeays_admin_extended(d.today,d.today) v from d),
 r as (select public.veeays_admin_registration_snapshot() v),
 p as (select public.veeays_admin_payment_snapshot() v)
select jsonb_pretty(jsonb_build_object(
  'access',public.veeays_admin_access(),
  'analytics_keys',(select jsonb_agg(k order by k) from a, jsonb_object_keys(a.v) k),
  'analytics_daily_rows',(select jsonb_array_length(a.v->'daily') from a),
  'quick_reads_counts_keys',(select jsonb_agg(k order by k) from q, jsonb_object_keys(q.v->'counts') k),
  'quick_reads_all_reads_keys',(select jsonb_agg(k order by k) from q, jsonb_object_keys(q.v->'all_reads') k),
  'quick_reads_has_recent_automation_gate',(select jsonb_build_object('recent',jsonb_typeof(q.v->'recent'),'automation',q.v->'automation'->'enabled','gate',q.v->'gate'->'enabled','oldest_due_present',(q.v->'oldest_due') is not null) from q),
  'extended_members_expiring_7d_type',(select jsonb_typeof(e.v->'members'->'expiring_7d') from e),
  'extended_email_keys',(select jsonb_agg(k order by k) from e, jsonb_object_keys(e.v->'email') k),
  'registration_available',(select r.v->'available' from r),
  'registration_event_keys',(select jsonb_agg(distinct k) from r, jsonb_array_elements(r.v->'events') ev, jsonb_object_keys(ev) k),
  'payment_available',(select p.v->'available' from p),
  'payment_event_keys',(select jsonb_agg(distinct k) from p, jsonb_array_elements(p.v->'events') ev, jsonb_object_keys(ev) k)
)) as check_b;
rollback;
