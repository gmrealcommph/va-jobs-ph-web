-- Enforce a Quick Reads-only USD daily limit from OpenAI's Costs API.
-- The Worker reports the dedicated API key's UTC-day aggregate before every claim.
-- A $0.14 hold covers one in-flight request while Costs API aggregation catches up.
begin;

create table if not exists quick_read_ops.quick_read_actual_daily_spend (
  spend_day date primary key,
  api_key_id text not null,
  actual_usd numeric(12,8) not null default 0 check (actual_usd >= 0),
  held_usd numeric(12,8) not null default 0 check (held_usd >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists quick_read_ops.quick_read_actual_spend_holds (
  token uuid primary key,
  spend_day date not null references quick_read_ops.quick_read_actual_daily_spend(spend_day) on delete cascade,
  job_id text not null,
  hold_usd numeric(12,8) not null check (hold_usd >= 0),
  created_at timestamptz not null default now()
);

alter table quick_read_ops.quick_read_actual_daily_spend enable row level security;
alter table quick_read_ops.quick_read_actual_spend_holds enable row level security;
revoke all on quick_read_ops.quick_read_actual_daily_spend from public, anon, authenticated;
revoke all on quick_read_ops.quick_read_actual_spend_holds from public, anon, authenticated;

create or replace function public.quick_read_actual_spend_reserve(
  p_job_id text,
  p_token uuid,
  p_day date,
  p_api_key_id text,
  p_actual_usd numeric,
  p_hold_usd numeric
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'quick_read_ops'
as $function$
declare
  v_actual numeric(12,8);
  v_held numeric(12,8);
  v_delta numeric(12,8);
  v_release numeric(12,8);
  h record;
begin
  if p_job_id is null or p_job_id !~ '^[1-9][0-9]{0,18}$' or p_token is null
     or p_day is distinct from (now() at time zone 'UTC')::date
     or p_api_key_id is null or length(p_api_key_id) not between 1 and 200
     or p_actual_usd is null or p_actual_usd < 0 or p_actual_usd > 100000
     or p_hold_usd is distinct from 0.14::numeric then
    return jsonb_build_object('status','invalid');
  end if;

  insert into quick_read_ops.quick_read_actual_daily_spend(spend_day,api_key_id,actual_usd)
    values(p_day,p_api_key_id,p_actual_usd)
    on conflict(spend_day) do nothing;

  select actual_usd,held_usd into v_actual,v_held
  from quick_read_ops.quick_read_actual_daily_spend
  where spend_day=p_day and api_key_id=p_api_key_id
  for update;
  if not found then
    return jsonb_build_object('status','spend_key_mismatch');
  end if;

  if exists(select 1 from quick_read_ops.quick_read_actual_spend_holds
            where token=p_token and spend_day=p_day and job_id=p_job_id) then
    return jsonb_build_object('status','reserved','actual_usd',v_actual,'held_usd',v_held);
  end if;

  v_delta:=greatest(0,p_actual_usd-v_actual);
  for h in
    select token,hold_usd from quick_read_ops.quick_read_actual_spend_holds
    where spend_day=p_day and hold_usd>0 order by created_at,token for update
  loop
    exit when v_delta<=0;
    v_release:=least(h.hold_usd,v_delta);
    update quick_read_ops.quick_read_actual_spend_holds set hold_usd=hold_usd-v_release where token=h.token;
    v_held:=greatest(0,v_held-v_release);
    v_delta:=v_delta-v_release;
  end loop;

  v_actual:=greatest(v_actual,p_actual_usd);
  update quick_read_ops.quick_read_actual_daily_spend
    set actual_usd=v_actual,held_usd=v_held,updated_at=now()
    where spend_day=p_day;

  if v_actual+v_held+0.14::numeric>0.50::numeric then
    return jsonb_build_object('status','spending_stopped','actual_usd',v_actual,'held_usd',v_held,'limit_usd',0.50);
  end if;

  insert into quick_read_ops.quick_read_actual_spend_holds(token,spend_day,job_id,hold_usd)
    values(p_token,p_day,p_job_id,0.14);
  update quick_read_ops.quick_read_actual_daily_spend
    set held_usd=held_usd+0.14,updated_at=now() where spend_day=p_day;

  return jsonb_build_object('status','reserved','actual_usd',v_actual,'held_usd',v_held+0.14,'limit_usd',0.50);
end
$function$;

create or replace function public.quick_read_actual_spend_release(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'quick_read_ops'
as $function$
declare
  h quick_read_ops.quick_read_actual_spend_holds%rowtype;
begin
  if p_token is null then return jsonb_build_object('status','invalid'); end if;
  delete from quick_read_ops.quick_read_actual_spend_holds where token=p_token returning * into h;
  if not found then return jsonb_build_object('status','released'); end if;
  update quick_read_ops.quick_read_actual_daily_spend
    set held_usd=greatest(0,held_usd-h.hold_usd),updated_at=now()
    where spend_day=h.spend_day;
  return jsonb_build_object('status','released');
end
$function$;

create or replace function public.claim_job_quick_read_auto(p_job_id text, p_formatter text, p_token uuid, p_source_rules text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
 a public.quick_read_auto_queue%rowtype;
 c public.quick_read_rollout_stop%rowtype;
 result jsonb;
begin
 if p_token is null or p_job_id is null or p_job_id!~'^[1-9][0-9]{0,18}$' then
   return jsonb_build_object('status','invalid');
 end if;
 if not exists(
   select 1 from quick_read_ops.quick_read_actual_spend_holds h
   where h.token=p_token and h.job_id=p_job_id
     and h.spend_day=(now() at time zone 'UTC')::date
 ) then
   return jsonb_build_object('status','spend_guard_required');
 end if;
 perform 1 from public.quick_read_control where id for update;
 select * into c from public.quick_read_rollout_stop where id for update;
 if not found or not c.enabled then
   return jsonb_build_object('status','rollout_disabled');
 end if;
 if c.cooldown_until>now() then return jsonb_build_object('status','credit_paused'); end if;
 if not c.ongoing and c.claims>=993 then return jsonb_build_object('status','rollout_exhausted'); end if;

 if not exists(select 1 from public.quick_read_auto_control where id and enabled and activated_at is not null)
 then return jsonb_build_object('status','disabled'); end if;
 select * into a from public.quick_read_auto_queue where job_id=p_job_id for update;
 if not found or a.state not in ('pending','running') or a.attempts>=3 or a.next_attempt_at>now()
 or a.inserted_at<(select activated_at from public.quick_read_auto_control where id)
 then return jsonb_build_object('status','not_due'); end if;
 if not a.recovery and exists(select 1 from public.job_quick_reads where job_id=p_job_id and (a.attempts=0 or updated_at>a.updated_at)) then
   update public.quick_read_auto_queue set state='stopped',last_status='previously_attempted',updated_at=now() where job_id=p_job_id;
   return jsonb_build_object('status','previously_attempted');
 end if;
 if not exists (
 select 1 from quick_read_ops.resume_allowlist approved join public.jobs j on j.id::text=approved.job_id
 where approved.job_id=p_job_id and approved.claimed_at is null
 and approved.source_hash=encode(extensions.digest(convert_to(j.description,'UTF8'),'sha256'),'hex')
 and approved.source_key=case when j.source is not null and j.source_job_id is not null then jsonb_build_array(j.source,j.source_job_id)::text else 'job:'||j.id::text end
 and not exists(select 1 from quick_read_ops.paid_exclusions e where e.job_id=p_job_id or e.source_key=approved.source_key)
 and not exists(select 1 from quick_read_ops.paid_hashes e where e.source_hash=approved.source_hash)
 ) then return jsonb_build_object('status','resume_excluded'); end if;
 result:=public.claim_job_quick_read_recovery(p_job_id,p_formatter,p_token,p_source_rules);
 if result->>'status'='claimed' then
   update quick_read_ops.resume_allowlist set claimed_at=now() where job_id=p_job_id and claimed_at is null;
   update public.quick_read_auto_queue set state='running',attempts=attempts+1,claim_token=p_token,
    next_attempt_at=now()+interval '1 hour'*power(2,a.attempts),last_status='claimed',updated_at=now() where job_id=p_job_id;
   update public.quick_read_rollout_stop set claims=claims+1 where id;
 elsif result->>'status' in ('unchanged','unsupported','invalid') then
   update public.quick_read_auto_queue set state='stopped',last_status=result->>'status',updated_at=now() where job_id=p_job_id;
 else
   update public.quick_read_auto_queue set next_attempt_at=now()+interval '5 minutes',updated_at=now() where job_id=p_job_id;
 end if;
 return result;
end
$function$;

revoke all on function public.quick_read_actual_spend_reserve(text,uuid,date,text,numeric,numeric) from public, anon, authenticated;
revoke all on function public.quick_read_actual_spend_release(uuid) from public, anon, authenticated;
revoke all on function public.claim_job_quick_read_auto(text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.quick_read_actual_spend_reserve(text,uuid,date,text,numeric,numeric) to service_role;
grant execute on function public.quick_read_actual_spend_release(uuid) to service_role;
grant execute on function public.claim_job_quick_read_auto(text,text,uuid,text) to service_role;

commit;
