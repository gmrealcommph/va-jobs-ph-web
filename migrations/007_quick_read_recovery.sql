-- Additive recovery migration. Prepare locally; apply once only after review.
-- No existing jobs or ready/failed cache rows are rewritten.
begin;
alter table public.job_quick_reads add column failure_diagnostics jsonb;
alter table public.job_quick_reads add column source_rules_version text;

-- One eligibility/state definition shared by batch selection and completion.
create function public.quick_read_recovery_jobs(p_formatter text,p_source_rules text,p_run_started_at timestamptz)
returns table(id text,status text,error_code text,is_ready boolean,is_terminal boolean,attempted_in_run boolean,is_candidate boolean,deferred_until timestamptz)
language sql stable security definer set search_path=pg_catalog,public,extensions as $$
 with eligible as (
   select j.id::text as id,q.status,q.error_code,q.schema_version,q.lease_until,q.retry_after,q.updated_at,q.job_id,
     q.source_hash=encode(extensions.digest(convert_to(j.description,'UTF8'),'sha256'),'hex')
       and q.formatter_version=p_formatter as same_revision,
     q.source_rules_version is null or q.source_rules_version=p_source_rules as same_rules
   from public.jobs j left join public.job_quick_reads q on q.job_id=j.id::text
   where j.status='active' and j.philippines_eligible is true
     and exists(select 1 from public.public_jobs v where v.id=j.id)
     and length(btrim(j.description))>=100 and length(j.description)<=40000
 ), flags as (
   select *,coalesce(status='ready' and same_revision and schema_version=2,false) as ready,
     coalesce(status='failed' and same_revision and same_rules and error_code in ('unsupported_source','unsafe_source'),false) as terminal,
     coalesce(status='failed' and same_revision and same_rules and updated_at>=p_run_started_at,false) as attempted,
     case when status='running' and lease_until>now() then lease_until
       when status='failed' and same_revision and retry_after>now()
         and (error_code not in ('unsupported_source','unsafe_source') or same_rules) then retry_after
       else null end as deferred
   from eligible
 ) select id,status,error_code,ready,terminal,attempted,
   not ready and not terminal and not attempted and deferred is null,deferred
 from flags
$$;

create function public.quick_read_candidates_recovery(p_after_id text,p_limit integer,p_formatter text,p_source_rules text,p_run_started_at timestamptz)
returns table(id text) language sql stable security definer set search_path=pg_catalog,public,extensions as $$
 select r.id from public.quick_read_recovery_jobs(p_formatter,p_source_rules,p_run_started_at) r
 where r.is_candidate and r.id::numeric>p_after_id::numeric
 order by r.id::numeric limit greatest(1,least(p_limit,5))
$$;

-- Retain the original RPC signature for older operators/workers.
create or replace function public.quick_read_candidates(p_after_id text,p_limit integer,p_formatter text)
returns table(id text) language sql stable security definer set search_path=pg_catalog,public,extensions as $$
 select * from public.quick_read_candidates_recovery(p_after_id,p_limit,p_formatter,'source-limits-v1',null)
$$;

create function public.quick_read_recovery_state(p_formatter text,p_source_rules text,p_run_started_at timestamptz)
returns jsonb language sql stable security definer set search_path=pg_catalog,public,extensions as $$
 select jsonb_build_object('protocol_version',1,'checked_at',now(),
   'eligible',count(*),'ready',count(*) filter(where is_ready),'missing',count(*) filter(where not is_ready),
   'candidates',count(*) filter(where is_candidate),
   'terminal',count(*) filter(where is_terminal),
   'attempted_failed',count(*) filter(where attempted_in_run and not is_terminal),
   'deferred',count(*) filter(where not is_ready and not is_terminal and not attempted_in_run and deferred_until>now()),
   'next_check_at',min(deferred_until) filter(where not is_ready and not is_terminal and not attempted_in_run and deferred_until>now()))
 from public.quick_read_recovery_jobs(p_formatter,p_source_rules,p_run_started_at)
$$;

create function public.claim_job_quick_read_recovery(p_job_id text,p_formatter text,p_token uuid,p_source_rules text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare source text; fingerprint text; cached public.job_quick_reads%rowtype; gate timestamptz;
begin
 if p_source_rules is null or p_source_rules!~'^[a-z0-9-]{1,64}$' then return jsonb_build_object('status','invalid'); end if;
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
     if cached.status='failed' and cached.error_code in ('unsupported_source','unsafe_source') and (cached.source_rules_version is null or cached.source_rules_version=p_source_rules) then return jsonb_build_object('status','unsupported'); end if;
     if cached.status='ready' and cached.schema_version=2 then return jsonb_build_object('status','unchanged'); end if;
     if cached.status='failed' and cached.retry_after>now() and (cached.error_code not in ('unsupported_source','unsafe_source') or cached.source_rules_version is null or cached.source_rules_version=p_source_rules) then return jsonb_build_object('status','retry_later'); end if;
   end if;
 end if;
 if gate>now() then return jsonb_build_object('status','rate_limited'); end if;
 update public.quick_read_control set next_claim_at=now()+interval '10 seconds' where id=true;
 insert into public.job_quick_reads(job_id,source_hash,formatter_version,status,claim_token,lease_until,source_rules_version)
 values(p_job_id,fingerprint,p_formatter,'running',p_token,now()+interval '3 minutes',p_source_rules)
 on conflict(job_id) do update set source_hash=excluded.source_hash,formatter_version=excluded.formatter_version,
 status='running',claim_token=excluded.claim_token,lease_until=excluded.lease_until,payload=null,error_code=null,failure_diagnostics=null,source_rules_version=p_source_rules,updated_at=now();
 return jsonb_build_object('status','claimed','description',source,'source_hash',fingerprint);
end $$;

create or replace function public.claim_job_quick_read(p_job_id text,p_formatter text,p_token uuid)
returns jsonb language sql volatile security definer set search_path=pg_catalog,public,extensions as $$
 select public.claim_job_quick_read_recovery(p_job_id,p_formatter,p_token,'source-limits-v1')
$$;

-- Defense in depth: the private diagnostic column accepts numbers/references
-- only, with fixed names and bounded size, even for direct service RPC callers.
create function public.quick_read_valid_diagnostics(d jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,public as $$
declare field text; section text; item jsonb; total integer:=0;
begin
 if d is null then return true; end if;
 if jsonb_typeof(d)<>'object' or octet_length(d::text)>16384 or d->'version' is distinct from '1'::jsonb
    or jsonb_typeof(d->'selection') is distinct from 'object'
    or jsonb_typeof(d->'truncated') is distinct from 'boolean'
    or jsonb_typeof(d->'missing_ids') is distinct from 'array' then return false; end if;
 for field in select jsonb_object_keys(d) loop
   if field not in ('version','source_unit_count','selection','truncated','invalid_reference_count','duplicate_reference_count','invalid_section_count','missing_ids','unknown_field_count') then return false; end if;
 end loop;
 foreach field in array array['source_unit_count','invalid_reference_count','duplicate_reference_count','invalid_section_count','unknown_field_count'] loop
   if jsonb_typeof(d->field) is distinct from 'number' or (d->>field)!~'^[0-9]{1,7}$' or (d->>field)::numeric>1000000 then return false; end if;
 end loop;
 if (d->>'source_unit_count')::integer>250 or jsonb_array_length(d->'missing_ids')>250 then return false; end if;
 for section in select jsonb_object_keys(d->'selection') loop
   if section not in ('about_role','responsibilities','requirements','nice_to_have','important_requirements','benefits','company_overview','application_notes','other_details')
      or jsonb_typeof(d->'selection'->section)<>'array' then return false; end if;
   for item in select value from jsonb_array_elements(d->'selection'->section) loop
     total:=total+1;
     if total>512 then return false; end if;
     if item<>'null'::jsonb and (jsonb_typeof(item)<>'number' or item::text!~'^-?[0-9]{1,7}$' or abs(item::text::numeric)>1000000) then return false; end if;
   end loop;
 end loop;
 for item in select value from jsonb_array_elements(d->'missing_ids') loop
   if jsonb_typeof(item)<>'number' or item::text!~'^[0-9]{1,3}$' or item::text::integer>=250 then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;

create function public.finish_job_quick_read_with_diagnostics(p_job_id text,p_token uuid,p_payload jsonb,p_model text,p_schema integer,p_error text,p_diagnostics jsonb,p_source_rules text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare result jsonb;
begin
 if p_source_rules is null or p_source_rules!~'^[a-z0-9-]{1,64}$' or not public.quick_read_valid_diagnostics(p_diagnostics) then raise exception 'Invalid diagnostic metadata'; end if;
 -- Existing finish keeps the row locked through this transaction and checks the
 -- claim token, lease, visibility and source revision before saving anything.
 result:=public.finish_job_quick_read(p_job_id,p_token,p_payload,p_model,p_schema,p_error);
 if result->>'status' in ('ready','failed') then
   update public.job_quick_reads set failure_diagnostics=case when result->>'status'='failed' then p_diagnostics else null end,
     source_rules_version=p_source_rules,
     retry_after=case when result->>'status'='failed' and p_error in ('unsupported_source','unsafe_source') then 'infinity'::timestamptz else retry_after end
   where job_id=p_job_id;
 end if;
 return result;
end $$;

revoke all on function public.quick_read_recovery_jobs(text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.quick_read_candidates_recovery(text,integer,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.quick_read_recovery_state(text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.claim_job_quick_read_recovery(text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.finish_job_quick_read_with_diagnostics(text,uuid,jsonb,text,integer,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.quick_read_valid_diagnostics(jsonb) from public,anon,authenticated;
grant execute on function public.quick_read_recovery_jobs(text,text,timestamptz),
 public.quick_read_candidates_recovery(text,integer,text,text,timestamptz),public.quick_read_recovery_state(text,text,timestamptz),
 public.claim_job_quick_read_recovery(text,text,uuid,text),public.finish_job_quick_read_with_diagnostics(text,uuid,jsonb,text,integer,text,jsonb,text)
 to service_role;
commit;
