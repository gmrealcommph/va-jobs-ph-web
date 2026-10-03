-- Run manually in Supabase SQL Editor. No existing views, jobs or taxonomy altered.
begin;
create extension if not exists pgcrypto with schema extensions;
create table public.job_quick_reads (
  job_id text primary key,
  source_hash text not null,
  formatter_version text not null,
  schema_version integer,
  status text not null check(status in ('running','ready','failed')),
  payload jsonb,
  model text,
  claim_token uuid,
  lease_until timestamptz,
  retry_after timestamptz,
  error_code text,
  generated_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.job_quick_reads enable row level security;
revoke all on public.job_quick_reads from public,anon,authenticated;
create table public.quick_read_control (id boolean primary key default true check(id),next_claim_at timestamptz not null default '-infinity');
insert into public.quick_read_control(id) values(true);
alter table public.quick_read_control enable row level security;
revoke all on public.quick_read_control from public,anon,authenticated;

-- Safe detail-only projection. The existing public_jobs view remains the visibility/dedupe gate.
create function public.public_job_detail_enrichment(p_job_id text) returns jsonb
language sql stable security definer set search_path=pg_catalog,public,extensions as $$
 select jsonb_build_object(
   'employment_type',to_jsonb(j)->'employment_type',
   'engagement_type',to_jsonb(j)->'engagement_type',
   'salary_min',to_jsonb(j)->'salary_min','salary_max',to_jsonb(j)->'salary_max',
   'salary_currency',to_jsonb(j)->'salary_currency','salary_period',to_jsonb(j)->'salary_period',
   'schedule_region',to_jsonb(j)->'schedule_region','experience_level',to_jsonb(j)->'experience_level',
   'quick_read',case when q.status='ready' and q.formatter_version='source-organizer-v2' and q.schema_version=2
     and q.source_hash=encode(extensions.digest(convert_to(j.description,'UTF8'),'sha256'),'hex') then q.payload else null end,
   'quick_read_source_hash',case when q.status='ready' then q.source_hash else null end)
 from public.jobs j left join public.job_quick_reads q on q.job_id=j.id::text
 where j.id::text=p_job_id and j.status='active' and j.philippines_eligible is true
 and exists(select 1 from public.public_jobs v where v.id=j.id)
 limit 1
$$;
revoke all on function public.public_job_detail_enrichment(text) from public;
grant execute on function public.public_job_detail_enrichment(text) to anon,authenticated,service_role;

create function public.claim_job_quick_read(p_job_id text,p_formatter text,p_token uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare source text; fingerprint text; cached public.job_quick_reads%rowtype; gate timestamptz;
begin
 if p_formatter<>'source-organizer-v2' or p_job_id!~'^[1-9][0-9]{0,18}$' then return jsonb_build_object('status','invalid'); end if;
 -- A global serialized rate gate also protects concurrent manual/batch callers.
 select next_claim_at into gate from public.quick_read_control where id=true for update;
 select j.description into source from public.jobs j where j.id::text=p_job_id
   and j.status='active' and j.philippines_eligible is true
   and exists(select 1 from public.public_jobs v where v.id=j.id);
 if source is null or length(btrim(source))<100 or length(source)>40000 then return jsonb_build_object('status','ineligible'); end if;
 fingerprint:=encode(extensions.digest(convert_to(source,'UTF8'),'sha256'),'hex');
 select * into cached from public.job_quick_reads where job_id=p_job_id for update;
 if found then
   if cached.status='running' and cached.lease_until>now() then return jsonb_build_object('status','busy'); end if;
   if cached.source_hash=fingerprint and cached.formatter_version=p_formatter then
     if cached.status='ready' and cached.schema_version=2 then return jsonb_build_object('status','unchanged'); end if;
     if cached.status='failed' and cached.retry_after>now() then return jsonb_build_object('status','retry_later'); end if;
   end if;
 end if;
 if gate>now() then return jsonb_build_object('status','rate_limited'); end if;
 update public.quick_read_control set next_claim_at=now()+interval '10 seconds' where id=true;
 insert into public.job_quick_reads(job_id,source_hash,formatter_version,status,claim_token,lease_until)
 values(p_job_id,fingerprint,p_formatter,'running',p_token,now()+interval '3 minutes')
 on conflict(job_id) do update set source_hash=excluded.source_hash,formatter_version=excluded.formatter_version,
 status='running',claim_token=excluded.claim_token,lease_until=excluded.lease_until,payload=null,error_code=null,updated_at=now();
 return jsonb_build_object('status','claimed','description',source,'source_hash',fingerprint);
end $$;

create function public.finish_job_quick_read(p_job_id text,p_token uuid,p_payload jsonb,p_model text,p_schema integer,p_error text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare cached public.job_quick_reads%rowtype; fingerprint text;
begin
 select * into cached from public.job_quick_reads where job_id=p_job_id for update;
 if not found or cached.status<>'running' or cached.claim_token is distinct from p_token or cached.lease_until<now() then return jsonb_build_object('status','claim_expired'); end if;
 select encode(extensions.digest(convert_to(j.description,'UTF8'),'sha256'),'hex') into fingerprint
 from public.jobs j where j.id::text=p_job_id and j.status='active' and j.philippines_eligible is true
 and exists(select 1 from public.public_jobs v where v.id=j.id);
 if fingerprint is distinct from cached.source_hash then
   update public.job_quick_reads set status='failed',payload=null,error_code='source_changed',retry_after=now(),claim_token=null,lease_until=null,updated_at=now() where job_id=p_job_id;
   return jsonb_build_object('status','source_changed');
 end if;
 if p_error is null and (p_schema<>2 or p_schema is null or p_payload is null or jsonb_typeof(p_payload)<>'object'
   or p_payload->>'formatter'<>'source-organizer-v2' or p_payload->>'version'<>'2') then raise exception 'Invalid payload'; end if;
 update public.job_quick_reads set status=case when p_error is null then 'ready' else 'failed' end,
   payload=case when p_error is null then p_payload else null end,model=left(p_model,100),schema_version=p_schema,
   error_code=left(p_error,100),generated_at=case when p_error is null then now() else null end,
   retry_after=case when p_error is null then null else now()+interval '1 hour' end,
   claim_token=null,lease_until=null,updated_at=now() where job_id=p_job_id;
 return jsonb_build_object('status',case when p_error is null then 'ready' else 'failed' end);
end $$;

create function public.quick_read_candidates(p_after_id text,p_limit integer,p_formatter text)
returns table(id text) language sql stable security definer set search_path=pg_catalog,public,extensions as $$
 select j.id::text from public.jobs j left join public.job_quick_reads q on q.job_id=j.id::text
 where j.id::numeric>p_after_id::numeric and j.status='active' and j.philippines_eligible is true
 and exists(select 1 from public.public_jobs v where v.id=j.id)
 and length(btrim(j.description)) between 100 and 40000
 and (q.job_id is null or (q.status<>'running' or q.lease_until<=now()) and
   (q.status<>'failed' or q.retry_after<=now() or q.source_hash<>encode(extensions.digest(convert_to(j.description,'UTF8'),'sha256'),'hex') or q.formatter_version<>p_formatter) and
   (q.source_hash<>encode(extensions.digest(convert_to(j.description,'UTF8'),'sha256'),'hex')
    or q.formatter_version<>p_formatter or q.schema_version is distinct from 2
    or q.status='failed' and q.retry_after<=now()))
 order by j.id::numeric limit greatest(1,least(p_limit,5))
$$;
revoke all on function public.claim_job_quick_read(text,text,uuid) from public,anon,authenticated;
revoke all on function public.finish_job_quick_read(text,uuid,jsonb,text,integer,text) from public,anon,authenticated;
revoke all on function public.quick_read_candidates(text,integer,text) from public,anon,authenticated;
grant execute on function public.claim_job_quick_read(text,text,uuid) to service_role;
grant execute on function public.finish_job_quick_read(text,uuid,jsonb,text,integer,text) to service_role;
grant execute on function public.quick_read_candidates(text,integer,text) to service_role;
commit;
