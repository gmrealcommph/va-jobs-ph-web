-- Candidate installation SQL. Run only after rollout approval; no scheduler is installed.
begin;
create schema veeays_alerts;
revoke all on schema veeays_alerts from public,anon,authenticated;
create table veeays_alerts.settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false, frequency text not null default 'weekly' check(frequency in ('weekly','daily')),
 categories text[] not null default '{}', employment_types text[] not null default '{}',
 minimum_usd integer check(minimum_usd between 0 and 1000000), salary_period text check(salary_period in ('hourly','monthly','yearly')),
 include_unknown_salary boolean not null default true,
 consent_at timestamptz, consent_version text, updated_at timestamptz not null default now(),
 token uuid not null default gen_random_uuid(), suppressed boolean not null default false,
 check(minimum_usd is null or salary_period is not null)
);
create table veeays_alerts.deliveries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 day date not null, frequency text not null check(frequency in ('weekly','daily')), state text not null default 'pending' check(state in ('pending','retry','sending','accepted','held','cancelled','empty')),
 items jsonb not null, payload jsonb, first_attempt_at timestamptz, attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(), lease_token uuid, lease_until timestamptz,
 provider_id text, error text, created_at timestamptz not null default now(), unique(user_id,day)
);
create table veeays_alerts.notified (
 user_id uuid references auth.users(id) on delete cascade, job_key text, recorded_at timestamptz not null default now(), outcome text not null default 'attempted',
 primary key(user_id,job_key)
);
create table veeays_alerts.events (
 id bigint generated always as identity primary key,user_id uuid references auth.users(id) on delete cascade,
 delivery_id uuid references veeays_alerts.deliveries(id) on delete cascade,code text not null,created_at timestamptz not null default now()
);
create index job_alert_due on veeays_alerts.deliveries(day,state,next_attempt_at);
create index job_alert_member_state on veeays_alerts.deliveries(user_id,state);
create index job_alert_event_time on veeays_alerts.events(created_at);
create table veeays_alerts.provider_suppressions(provider_id text primary key,created_at timestamptz not null default now());
alter table veeays_alerts.provider_suppressions enable row level security;
revoke all on veeays_alerts.provider_suppressions from public,anon,authenticated;
create table veeays_alerts.control (
 id boolean primary key default true check(id), enabled boolean not null default false,
 daily_cap integer not null default 40 check(daily_cap between 1 and 80),
 monthly_cap integer not null default 1000 check(monthly_cap between 1 and 2000),next_send_at timestamptz
);
insert into veeays_alerts.control default values;
alter table veeays_alerts.settings enable row level security;
alter table veeays_alerts.deliveries enable row level security;
alter table veeays_alerts.notified enable row level security;
alter table veeays_alerts.events enable row level security;
alter table veeays_alerts.control enable row level security;
revoke all on all tables in schema veeays_alerts from public,anon,authenticated;

create function veeays_alerts.pro(p_user uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.profiles where id=p_user and plan='pro' and plan_status='active' and (pro_expires_at is null or pro_expires_at>now()))
$$;
create function veeays_alerts.eligible(p_user uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from auth.users u join veeays_alerts.settings s on s.user_id=u.id
 where u.id=p_user and u.email_confirmed_at is not null and u.email is not null and u.deleted_at is null
 and (u.banned_until is null or u.banned_until<=now()) and s.enabled and not s.suppressed and s.consent_at is not null
 and not exists(select 1 from veeays_private.deletion_requests where user_id=u.id))
$$;
create function public.my_job_alerts() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 return jsonb_build_object('settings',coalesce((select to_jsonb(s)-'token'-'user_id' from veeays_alerts.settings s where user_id=auth.uid()),'{}'::jsonb),
 'pro',veeays_alerts.pro(auth.uid()),'categories',(select coalesce(jsonb_agg(category order by category),'[]') from (select distinct category from public.public_jobs where category is not null)c),
 'types',(select coalesce(jsonb_agg(employment_type order by employment_type),'[]') from (select distinct j.employment_type from public.jobs j join public.public_jobs v using(id) where j.employment_type is not null)t));
end $$;
create function public.save_my_job_alerts(p_enabled boolean,p_frequency text,p_categories text[],p_types text[],p_minimum integer,p_period text,p_unknown boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or exists(select 1 from veeays_private.deletion_requests where user_id=u) then raise exception 'Account unavailable'; end if;
 perform pg_advisory_xact_lock(78236421);
 if p_enabled is null or p_unknown is null or p_frequency not in ('weekly','daily') or p_frequency is null
 or (p_frequency='daily' and not veeays_alerts.pro(u)) or coalesce(array_length(p_categories,1),0)>32 or coalesce(array_length(p_types,1),0)>10
 or p_categories is null or p_types is null or (p_minimum is not null and (p_minimum<0 or p_minimum>1000000 or p_period is null))
 or (p_period is not null and p_period not in ('hourly','monthly','yearly')) then raise exception 'Invalid preferences'; end if;
 if exists(select 1 from unnest(p_categories)c where c is null or not exists(select 1 from public.public_jobs where category=c))
 or exists(select 1 from unnest(p_types)t where t is null or not exists(select 1 from public.jobs j join public.public_jobs v using(id) where j.employment_type=t)) then raise exception 'Unknown preference'; end if;
 -- Brief send barrier: a successful save never races a provider request already authorized.
 if exists(select 1 from veeays_alerts.deliveries where user_id=u and state='sending' and lease_until>now()) then raise sqlstate 'PT409' using message='Delivery finishing; please retry shortly'; end if;
 insert into veeays_alerts.settings(user_id,enabled,frequency,categories,employment_types,minimum_usd,salary_period,include_unknown_salary,consent_at,consent_version)
 values(u,p_enabled,p_frequency,p_categories,p_types,p_minimum,p_period,p_unknown,case when p_enabled then now() end,case when p_enabled then 'job-alerts-v1' end)
 on conflict(user_id) do update set enabled=excluded.enabled,frequency=excluded.frequency,categories=excluded.categories,
 employment_types=excluded.employment_types,minimum_usd=excluded.minimum_usd,salary_period=excluded.salary_period,
 include_unknown_salary=excluded.include_unknown_salary,consent_at=case when excluded.enabled then coalesce(veeays_alerts.settings.consent_at,now()) else null end,
 consent_version=excluded.consent_version,updated_at=now();
 update veeays_alerts.deliveries set state='cancelled',payload=null,error='preferences_changed' where user_id=u and state in ('pending','retry','sending');
 insert into veeays_alerts.events(user_id,code) values(u,case when p_enabled then 'preferences_consented_v1' else 'opt_out' end);
 -- Retire both legacy opt-ins for this member, without modifying matching preferences.
 update public.job_preferences set daily_digest=false,email_strong_matches=false where user_id=u;
 return true;
end $$;
create function veeays_alerts.matches(p_user uuid,p_end timestamptz,p_delivery uuid default null) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.imported_at desc,x.job_id),'[]') from (
 select j.id::text job_id,j.title,j.company,j.category,j.employment_type,j.location,
 j.salary_min_usd,j.salary_max_usd,j.salary_period,coalesce(j.first_imported_at,j.created_at) imported_at,
 lower(btrim(j.company))||'|'||lower(btrim(j.title)) job_key
 from public.jobs j join public.public_jobs v using(id) join veeays_alerts.settings s on s.user_id=p_user
 where j.status='active' and j.philippines_eligible is true
 and coalesce(j.first_imported_at,j.created_at)>=greatest(s.consent_at,p_end-interval '7 days')
 and coalesce(j.first_imported_at,j.created_at)<p_end
 and (coalesce(j.original_posted_at,j.posted_at) is null or coalesce(j.original_posted_at,j.posted_at)>p_end-interval '45 days')
 and not exists(select 1 from veeays_job_health.observations o where o.job_id=j.id and o.source=j.source and o.source_job_id=j.source_job_id and o.job_url=j.job_url
 and o.status='closed' and not exists(select 1 from veeays_job_health.observations n where n.job_id=o.job_id and n.source=o.source and n.source_job_id=o.source_job_id and n.job_url=o.job_url and n.checked_at>o.checked_at))
 and (cardinality(s.categories)=0 or j.category=any(s.categories))
 and (cardinality(s.employment_types)=0 or j.employment_type=any(s.employment_types))
 and (s.minimum_usd is null or (j.salary_period=s.salary_period and j.salary_min_usd>=s.minimum_usd)
 or (s.include_unknown_salary and (j.salary_min_usd is null or j.salary_period is null)))
 and (not exists(select 1 from veeays_alerts.notified n where n.user_id=p_user and n.job_key=lower(btrim(j.company))||'|'||lower(btrim(j.title))) or exists(select 1 from veeays_alerts.deliveries d,jsonb_array_elements(d.items)i where d.id=p_delivery and d.user_id=p_user and i->>'job_key'=lower(btrim(j.company))||'|'||lower(btrim(j.title))))
 order by coalesce(j.first_imported_at,j.created_at) desc,j.id desc limit 10)x
$$;
create function public.claim_job_alert(p_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d veeays_alerts.deliveries; s veeays_alerts.settings; c veeays_alerts.control; e timestamptz:=date_trunc('day',now()); f text; items jsonb;
begin
 perform pg_advisory_xact_lock(78236421);
 select * into c from veeays_alerts.control where id for update;
 if not c.enabled then return null; end if;
 if c.next_send_at>now() then return null; end if;
 if (select count(*) from veeays_alerts.events where code='provider_attempt' and created_at>=e)>=c.daily_cap
 or (select count(*) from veeays_alerts.events where code='provider_attempt' and created_at>=date_trunc('month',now()))>=c.monthly_cap then return null; end if;
 update veeays_alerts.deliveries set state='held',payload=null,error='retry_window_expired' where state in ('sending','retry','pending') and (first_attempt_at<=now()-interval '23 hours' or day<e::date) and (lease_until is null or lease_until<now());
 select * into d from veeays_alerts.deliveries where state in ('pending','retry','sending') and day=e::date and next_attempt_at<=now()
 and (lease_until is null or lease_until<now()) and attempts<4 order by attempts,created_at limit 1 for update;
 if d.id is null then
 for s in select * from veeays_alerts.settings where enabled and not suppressed and not exists(select 1 from veeays_alerts.deliveries where user_id=settings.user_id and day=e::date) order by user_id loop
 if not veeays_alerts.eligible(s.user_id) then continue; end if;
 f:=case when s.frequency='daily' and veeays_alerts.pro(s.user_id) then 'daily' else 'weekly' end;
 -- Weekly Monday 08:00 Manila = Monday 00:00 UTC. Daily sends at 08:00 Manila.
 if f='weekly' and extract(isodow from e)<>1 then continue; end if;
 items:=veeays_alerts.matches(s.user_id,e);
 insert into veeays_alerts.deliveries(user_id,day,frequency,items,state) values(s.user_id,e::date,f,items,case when jsonb_array_length(items)=0 then 'empty' else 'pending' end) returning * into d;
 if d.state='pending' then exit; end if; d.id:=null;
 end loop;
 end if;
 if d.id is null then return null; end if;
 update veeays_alerts.deliveries set state='pending',lease_token=p_token,lease_until=now()+interval '2 minutes' where id=d.id returning * into d;
 update veeays_alerts.control set next_send_at=now()+interval '1 second' where id;
 return to_jsonb(d);
end $$;
create function public.check_job_alert(p_id uuid,p_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d veeays_alerts.deliveries; s veeays_alerts.settings; candidate jsonb; email text;
begin
 select * into d from veeays_alerts.deliveries where id=p_id and lease_token=p_token and lease_until>now() and state in ('pending','retry','sending');
 if d.id is null or not veeays_alerts.eligible(d.user_id) then return jsonb_build_object('error','recipient_ineligible'); end if;
 select * into s from veeays_alerts.settings where user_id=d.user_id;
 if d.frequency='daily' and not veeays_alerts.pro(d.user_id) then return jsonb_build_object('error','entitlement_changed'); end if;
 candidate:=veeays_alerts.matches(d.user_id,d.day::timestamptz,d.id);
 if exists(select 1 from jsonb_array_elements(d.items)i where not exists(select 1 from jsonb_array_elements(candidate)n where i=n)) then return jsonb_build_object('error','jobs_changed'); end if;
 select lower(btrim(u.email)) into email from auth.users u where u.id=d.user_id;
 return jsonb_build_object('email',email,'items',d.items,'token',s.token,'frequency',d.frequency);
end $$;
create function public.freeze_job_alert(p_id uuid,p_token uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 update veeays_alerts.deliveries set payload=coalesce(payload,p_payload) where id=p_id and lease_token=p_token and lease_until>now() returning payload into result;
 if result is null then raise exception 'Lease lost'; end if; return result;
end $$;
create function public.start_job_alert(p_id uuid,p_token uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare person jsonb; d veeays_alerts.deliveries;
begin
 perform pg_advisory_xact_lock(78236421);
 if not (select enabled from veeays_alerts.control where id) then return false; end if;
 if (select count(*) from veeays_alerts.events where code='provider_attempt' and created_at>=date_trunc('day',now())) >= (select daily_cap from veeays_alerts.control where id) or (select count(*) from veeays_alerts.events where code='provider_attempt' and created_at>=date_trunc('month',now())) >= (select monthly_cap from veeays_alerts.control where id) then return false; end if;
 person:=public.check_job_alert(p_id,p_token); if person ? 'error' then return false; end if;
 select * into d from veeays_alerts.deliveries where id=p_id for update;
 if d.payload->'to'<>jsonb_build_array(person->>'email') or d.payload is null or d.attempts>=4
 or d.first_attempt_at<=now()-interval '23 hours' then return false; end if;
 update veeays_alerts.deliveries set state='sending',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),lease_until=now()+interval '30 seconds' where id=p_id;
 insert into veeays_alerts.notified(user_id,job_key) select d.user_id,i->>'job_key' from jsonb_array_elements(d.items)i on conflict do nothing;
 insert into veeays_alerts.events(user_id,delivery_id,code) values(d.user_id,d.id,'provider_attempt');
 return true;
end $$;
create function public.finish_job_alert(p_id uuid,p_token uuid,p_provider text,p_error text,p_retry boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare d veeays_alerts.deliveries;
begin
 select * into d from veeays_alerts.deliveries where id=p_id and lease_token=p_token for update;
 if d.id is null or d.state not in ('pending','retry','sending') then return false; end if;
 if p_provider is not null then
 if exists(select 1 from veeays_alerts.provider_suppressions where provider_id=p_provider) then update veeays_alerts.settings set suppressed=true,enabled=false where user_id=d.user_id; end if;
 update veeays_alerts.notified set outcome='accepted' where user_id=d.user_id and job_key in (select i->>'job_key' from jsonb_array_elements(d.items)i);
 end if;
 update veeays_alerts.deliveries set state=case when p_provider is not null then 'accepted' when p_retry and attempts<4 then 'retry' else 'held' end,
 provider_id=p_provider,error=p_error,lease_token=null,lease_until=null,next_attempt_at=now()+make_interval(secs=>60*power(2,least(d.attempts,4))::integer+floor(random()*30)::integer),
 payload=case when p_provider is not null or not p_retry or attempts>=4 then null else payload end where id=p_id;
 insert into veeays_alerts.events(user_id,delivery_id,code) values(d.user_id,d.id,case when p_provider is not null then 'accepted' else coalesce(p_error,'unknown_outcome') end);
 return true;
end $$;
create function public.unsubscribe_job_alert(p_token uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 perform pg_advisory_xact_lock(78236421);
 select user_id into u from veeays_alerts.settings where token=p_token for update;
 if u is null then return true; end if;
 if exists(select 1 from veeays_alerts.deliveries where user_id=u and state='sending' and lease_until>now()) then return false; end if;
 update veeays_alerts.settings set enabled=false,consent_at=null,updated_at=now() where user_id=u;
 update veeays_alerts.deliveries set state='cancelled',payload=null,error='opt_out' where user_id=u and state in ('pending','retry','sending');
 update public.job_preferences set daily_digest=false,email_strong_matches=false where user_id=u;
 insert into veeays_alerts.events(user_id,code) values(u,'unsubscribe');return true;
end $$;
create function public.suppress_job_alert(p_provider text) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 perform pg_advisory_xact_lock(78236421);
 insert into veeays_alerts.provider_suppressions(provider_id) values(p_provider) on conflict do nothing;
 select user_id into u from veeays_alerts.deliveries where provider_id=p_provider;
 if u is null then return false; end if;
 update veeays_alerts.settings set enabled=false,suppressed=true,updated_at=now() where user_id=u;
 update veeays_alerts.deliveries set state='cancelled',payload=null where user_id=u and state in ('pending','retry');
 insert into veeays_alerts.events(user_id,code) values(u,'provider_suppression'); return true;
end $$;
create function public.cleanup_job_alerts() returns void language plpgsql security definer set search_path='' as $$
begin
 delete from veeays_alerts.provider_suppressions where created_at<now()-interval '90 days';
 delete from veeays_alerts.events where created_at<now()-interval '90 days';
 delete from veeays_alerts.deliveries where created_at<now()-interval '90 days' and state not in ('pending','retry','sending');
end $$;
revoke all on function public.suppress_job_alert(text),public.cleanup_job_alerts() from public,anon,authenticated;
grant execute on function public.suppress_job_alert(text),public.cleanup_job_alerts() to service_role;
-- Fence completed account deletion while an email request is in flight. Prepared deletion
-- already excludes all future claims and send-time checks; existing deletion UI retries safely.
create function veeays_alerts.deletion_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(78236421);
 if exists(select 1 from veeays_alerts.deliveries where user_id=old.id and state='sending' and lease_until>now()) then raise exception 'Email delivery in progress; retry shortly'; end if;
 return old;
end $$;
create trigger job_alert_deletion_guard before delete on auth.users for each row execute function veeays_alerts.deletion_guard();
revoke all on all functions in schema veeays_alerts from public,anon,authenticated;
revoke all on function public.my_job_alerts(),public.save_my_job_alerts(boolean,text,text[],text[],integer,text,boolean),public.unsubscribe_job_alert(uuid),
 public.claim_job_alert(uuid),public.check_job_alert(uuid,uuid),public.freeze_job_alert(uuid,uuid,jsonb),public.start_job_alert(uuid,uuid),public.finish_job_alert(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.my_job_alerts(),public.save_my_job_alerts(boolean,text,text[],text[],integer,text,boolean) to authenticated;
grant execute on function public.unsubscribe_job_alert(uuid) to anon,authenticated,service_role;
grant execute on function public.claim_job_alert(uuid),public.check_job_alert(uuid,uuid),public.freeze_job_alert(uuid,uuid,jsonb),public.start_job_alert(uuid,uuid),public.finish_job_alert(uuid,uuid,text,text,boolean) to service_role;
commit;
