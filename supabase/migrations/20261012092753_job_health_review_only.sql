-- Additive, review-only release. No jobs status updates, view changes or cron.
begin;
create schema if not exists veeays_job_health;
revoke all on schema veeays_job_health from public, anon;
grant usage on schema veeays_job_health to authenticated, service_role;

alter table public.jobs add column if not exists original_posted_at timestamptz;
alter table public.jobs add column if not exists original_date_provenance text;
alter table public.jobs add column if not exists first_imported_at timestamptz;
create function veeays_job_health.preserve_import_date() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then new.first_imported_at:=coalesce(new.first_imported_at,new.created_at,now());
 else new.first_imported_at:=coalesce(old.first_imported_at,old.created_at); end if;
 return new;
end $$;
create trigger preserve_job_first_import before insert or update on public.jobs for each row execute function veeays_job_health.preserve_import_date();

create table veeays_job_health.reports (
 id bigint generated always as identity primary key,
 job_id bigint not null references public.jobs(id) on delete restrict,
 user_id uuid references auth.users(id) on delete set null,
 category text not null check(category in ('closed_filled','broken_link','suspicious','inaccurate')),
 details text not null default '' check(length(details)<=1000),
 status text not null default 'open' check(status in ('open','resolved','dismissed')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz, review_note text, reviewer uuid references auth.users(id) on delete set null,
 revision integer not null default 0
);
create index job_reports_user_time on veeays_job_health.reports(user_id,created_at desc);
create index job_reports_queue on veeays_job_health.reports(job_id,status,created_at desc);
alter table veeays_job_health.reports enable row level security;

create table veeays_job_health.reviews (
 job_id bigint primary key references public.jobs(id) on delete restrict,
 state text not null check(state in ('needs_review','reviewed','evergreen')),
 reason text not null check(length(reason) between 3 and 1000),
 expires_at timestamptz, updated_at timestamptz not null default now(),
 reviewer uuid references auth.users(id) on delete set null, revision integer not null default 1
);
alter table veeays_job_health.reviews enable row level security;
create table veeays_job_health.observations (
 id bigint generated always as identity primary key,
 job_id bigint not null references public.jobs(id) on delete restrict,
 source text not null, source_job_id text not null, job_url text not null,
 checked_at timestamptz not null,
 status text not null check(status in ('open','unknown','closed')),
 reason text not null check(length(reason)<=200),
 evidence_url text, original_posted_at timestamptz, source_published_at timestamptz, date_provenance text not null default 'unknown',
 unique(job_id,checked_at), check(original_posted_at is null or original_posted_at<=checked_at)
);
create index job_observations_latest on veeays_job_health.observations(job_id,checked_at desc);
alter table veeays_job_health.observations enable row level security;
create table veeays_job_health.audit (
 id bigint generated always as identity primary key,
 actor uuid references auth.users(id) on delete set null,
 job_id bigint not null references public.jobs(id) on delete restrict,
 report_id bigint references veeays_job_health.reports(id) on delete restrict,
 action text not null, reason text not null, created_at timestamptz not null default now()
);
alter table veeays_job_health.audit enable row level security;
create table veeays_job_health.verification_leases(job_id bigint primary key references public.jobs(id) on delete restrict,lease_until timestamptz not null);
alter table veeays_job_health.verification_leases enable row level security;
revoke all on all tables in schema veeays_job_health from public, anon, authenticated;

-- Server authentication validates the user; SQL also checks current account existence.
create function veeays_job_health.report(p_job_id bigint,p_category text,p_details text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); found_id bigint;
begin
 if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null) then raise sqlstate 'PT401' using message='Sign in with a confirmed account.'; end if;
 if p_category is null or p_category not in ('closed_filled','broken_link','suspicious','inaccurate') or p_details is null or length(p_details)>1000 then raise sqlstate 'PT400' using message='Invalid report.'; end if;
 if not exists(select 1 from public.public_jobs where id=p_job_id) then raise sqlstate 'PT404' using message='Job unavailable.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,8712));
 select id into found_id from veeays_job_health.reports where user_id=u and job_id=p_job_id and created_at>now()-interval '24 hours' order by id desc limit 1;
 if found_id is not null then return jsonb_build_object('accepted',true,'duplicate',true); end if;
 if (select count(*) from veeays_job_health.reports where user_id=u and created_at>now()-interval '24 hours')>=5
 or exists(select 1 from veeays_job_health.reports where user_id=u and created_at>now()-interval '1 minute') then raise sqlstate 'PT429' using message='Please wait before reporting another job.'; end if;
 insert into veeays_job_health.reports(job_id,user_id,category,details) values(p_job_id,u,p_category,btrim(p_details));
 return jsonb_build_object('accepted',true,'duplicate',false);
end $$;

create function veeays_job_health.snapshot(p_after bigint default 0,p_filter text default 'all') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not coalesce(veeays_admin.has_access(),false) then raise sqlstate 'PT403' using message='Admin access required.'; end if;
 if p_after is null or p_after<0 or p_filter is null or p_filter not in ('all','reports','missing','missing_original','aging','old','failures') then raise sqlstate 'PT400' using message='Invalid filter.'; end if;
 with inventory as (
 select j.*, (v.id is not null) as visible,
 o.status as verification_status,o.reason as verification_reason,o.checked_at as last_checked_at,
 (select max(x.checked_at) from veeays_job_health.observations x where x.job_id=j.id and x.source=j.source and x.source_job_id=j.source_job_id and x.job_url=j.job_url and x.status='open') as last_verified_at,
 coalesce(j.original_posted_at,o.original_posted_at) as employer_date,
 o.date_provenance,o.evidence_url,o.source_published_at,
 r.state as review_state,r.reason as review_reason,r.expires_at,coalesce(r.revision,0) as review_revision,
 (select count(*) from veeays_job_health.reports x where x.job_id=j.id and x.status='open') as open_reports
 from public.jobs j left join public.public_jobs v on v.id=j.id
 left join lateral(select * from veeays_job_health.observations x where x.job_id=j.id and x.source=j.source and x.source_job_id=j.source_job_id and x.job_url=j.job_url order by checked_at desc limit 1)o on true
 left join veeays_job_health.reviews r on r.job_id=j.id
 ), queue as (
 select * from inventory where id>p_after and (
 case p_filter when 'reports' then open_reports>0 when 'missing' then posted_at is null when 'missing_original' then employer_date is null
 when 'aging' then employer_date<=now()-interval '31 days' and employer_date>now()-interval '46 days'
 when 'old' then coalesce(employer_date,posted_at)<now()-interval '45 days'
 when 'failures' then verification_status='unknown'
 else open_reports>0 or employer_date is null or coalesce(employer_date,posted_at)<=now()-interval '31 days' or verification_status in ('unknown','closed') end)
 order by id limit 50
 ) select jsonb_build_object('checked_at',now(),'automatic_hiding_enabled',false,
 'metrics',(select jsonb_build_object('active',count(*) filter(where status='active'),'member_visible',count(*) filter(where visible),
 'aging',count(*) filter(where employer_date<=now()-interval '31 days' and employer_date>now()-interval '46 days'),
 'provisional_aging',count(*) filter(where visible and posted_at<=now()-interval '31 days' and posted_at>=now()-interval '45 days'),
 'over_45',count(*) filter(where visible and coalesce(employer_date,posted_at)<now()-interval '45 days'),
 'hidden_expired',count(*) filter(where status<>'active'),'missing_original_dates',count(*) filter(where visible and employer_date is null),
 'missing_legacy_dates',count(*) filter(where visible and posted_at is null),
 'verification_failures',count(*) filter(where verification_status='unknown'),
 'unverified',count(*) filter(where last_verified_at is null or last_verified_at<now()-interval '7 days'),
 'member_reports',(select count(*) from veeays_job_health.reports where status='open')) from inventory),
 'queue',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'title',q.title,'company',q.company,'source',q.source,'status',q.status,'visible',q.visible,
 'job_url',q.job_url,'original_posted_at',q.employer_date,'legacy_posted_at',q.posted_at,'imported_at',coalesce(q.first_imported_at,q.created_at),
 'last_verified_at',q.last_verified_at,'last_checked_at',q.last_checked_at,'verification_status',q.verification_status,'verification_reason',q.verification_reason,'evidence_url',q.evidence_url,
 'date_provenance',q.date_provenance,'source_published_at',q.source_published_at,'review_state',q.review_state,'review_reason',q.review_reason,'expires_at',q.expires_at,'revision',q.review_revision,
 'open_reports',q.open_reports,'reports',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,category,details,created_at,revision from veeays_job_health.reports where job_id=q.id and status='open' order by id limit 20)x),'[]'::jsonb)) order by q.id) from queue q),'[]'::jsonb),
 'next_after',case when (select count(*) from queue)=50 then (select max(id) from queue) else null end) into result;
 return result;
end $$;

create function veeays_job_health.review(p_job_id bigint,p_report_id bigint,p_action text,p_reason text,p_revision integer,p_expires_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_revision integer;
begin
 if not coalesce(veeays_admin.has_access(),false) then raise sqlstate 'PT403' using message='Admin access required.'; end if;
 if p_action is null or p_action not in ('needs_review','reviewed','evergreen','resolved','dismissed') or p_reason is null or length(btrim(p_reason)) not between 3 and 1000 or p_revision is null then raise sqlstate 'PT400' using message='Invalid review.'; end if;
 if not exists(select 1 from public.jobs where id=p_job_id) then raise sqlstate 'PT404' using message='Job unavailable.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(p_job_id);
 if p_action in ('resolved','dismissed') then
 select revision into current_revision from veeays_job_health.reports where id=p_report_id and job_id=p_job_id and status='open' for update;
 if current_revision is null or current_revision<>p_revision then raise sqlstate 'PT409' using message='Review changed. Reload.'; end if;
 update veeays_job_health.reports set status=p_action,review_note=btrim(p_reason),reviewer=auth.uid(),reviewed_at=now(),revision=revision+1 where id=p_report_id;
 else
 if p_report_id is not null then raise sqlstate 'PT400' using message='Invalid review target.'; end if;
 if p_action='evergreen' and (p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '90 days') then raise sqlstate 'PT400' using message='Evergreen review must expire within 90 days.'; end if;
 select revision into current_revision from veeays_job_health.reviews where job_id=p_job_id for update;
 if coalesce(current_revision,0)<>p_revision then raise sqlstate 'PT409' using message='Review changed. Reload.'; end if;
 insert into veeays_job_health.reviews(job_id,state,reason,expires_at,reviewer) values(p_job_id,p_action,btrim(p_reason),case when p_action='evergreen' then p_expires_at else null end,auth.uid())
 on conflict(job_id) do update set state=excluded.state,reason=excluded.reason,expires_at=excluded.expires_at,reviewer=excluded.reviewer,updated_at=now(),revision=veeays_job_health.reviews.revision+1;
 end if;
 insert into veeays_job_health.audit(actor,job_id,report_id,action,reason) values(auth.uid(),p_job_id,p_report_id,p_action,btrim(p_reason));
 return jsonb_build_object('saved',true,'visibility_changed',false);
end $$;

-- Append only; credentials confined to an explicit evidence-import operation.
create function veeays_job_health.record_observation(p_job_id bigint,p_source text,p_source_job_id text,p_job_url text,p_checked_at timestamptz,p_status text,p_reason text,p_evidence_url text,p_original_posted_at timestamptz,p_date_provenance text,p_source_published_at timestamptz default null) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise sqlstate 'PT403' using message='Service access required.'; end if;
 if p_checked_at>now()+interval '5 minutes' or p_checked_at<now()-interval '7 days' then raise sqlstate 'PT400' using message='Evidence timestamp out of range.'; end if;
 if p_original_posted_at is not null and p_date_provenance is distinct from 'employer_original' then raise sqlstate 'PT400' using message='Original date requires explicit original-date provenance.'; end if;
 if not exists(select 1 from public.jobs where id=p_job_id and source=p_source and source_job_id=p_source_job_id and job_url=p_job_url) then raise sqlstate 'PT409' using message='Source identity changed.'; end if;
 insert into veeays_job_health.observations(job_id,source,source_job_id,job_url,checked_at,status,reason,evidence_url,original_posted_at,date_provenance,source_published_at)
 values(p_job_id,p_source,p_source_job_id,p_job_url,p_checked_at,p_status,p_reason,p_evidence_url,p_original_posted_at,p_date_provenance,p_source_published_at) on conflict(job_id,checked_at) do nothing;
 return true;
end $$;

create function veeays_job_health.erase_report_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin update veeays_job_health.reports set details='' where user_id=old.id; return old; end $$;
create trigger erase_job_report_identity before delete on auth.users for each row execute function veeays_job_health.erase_report_identity();

create function veeays_job_health.candidates() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise sqlstate 'PT403' using message='Service access required.'; end if;
 -- Serialize short claims, not network calls. Unsuccessful runs release via timeout.
 perform pg_catalog.pg_advisory_xact_lock(871234567);
 with eligible as (
 select j.id,j.source,j.source_board,j.source_job_id,j.job_url,j.original_posted_at,o.checked_at,
 case when j.posted_at is null or j.posted_at<now()-interval '45 days' then 0 else 1 end priority
 from public.jobs j left join lateral(select checked_at from veeays_job_health.observations x where x.job_id=j.id and x.source=j.source and x.source_job_id=j.source_job_id and x.job_url=j.job_url order by checked_at desc limit 1)o on true
 left join veeays_job_health.verification_leases l on l.job_id=j.id
 where j.status='active' and (o.checked_at is null or o.checked_at<now()-interval '7 days') and (l.lease_until is null or l.lease_until<now())
 order by o.checked_at nulls first,priority,j.id limit 8
 ), claimed as (
 insert into veeays_job_health.verification_leases(job_id,lease_until) select id,now()+interval '6 hours' from eligible
 on conflict(job_id) do update set lease_until=excluded.lease_until returning job_id
 ) select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'source',e.source,'source_board',e.source_board,'source_job_id',e.source_job_id,'job_url',e.job_url,'original_posted_at',e.original_posted_at)),'[]'::jsonb) into result from eligible e join claimed c on c.job_id=e.id;
 return result;
end $$;

revoke all on all functions in schema veeays_job_health from public,anon,authenticated,service_role;
grant execute on function veeays_job_health.report(bigint,text,text),veeays_job_health.snapshot(bigint,text),veeays_job_health.review(bigint,bigint,text,text,integer,timestamptz) to authenticated;
grant execute on function veeays_job_health.record_observation(bigint,text,text,text,timestamptz,text,text,text,timestamptz,text,timestamptz) to service_role;
grant execute on function veeays_job_health.candidates() to service_role;

create function public.veeays_report_job(p_job_id bigint,p_category text,p_details text) returns jsonb language sql security invoker set search_path='' as $$select veeays_job_health.report(p_job_id,p_category,p_details)$$;
create function public.veeays_job_health(p_after bigint default 0,p_filter text default 'all') returns jsonb language sql security invoker set search_path='' as $$select veeays_job_health.snapshot(p_after,p_filter)$$;
create function public.veeays_job_health_review(p_job_id bigint,p_report_id bigint,p_action text,p_reason text,p_revision integer,p_expires_at timestamptz default null) returns jsonb language sql security invoker set search_path='' as $$select veeays_job_health.review(p_job_id,p_report_id,p_action,p_reason,p_revision,p_expires_at)$$;
create function public.veeays_job_health_observation(p_job_id bigint,p_source text,p_source_job_id text,p_job_url text,p_checked_at timestamptz,p_status text,p_reason text,p_evidence_url text,p_original_posted_at timestamptz,p_date_provenance text,p_source_published_at timestamptz default null) returns boolean language sql security invoker set search_path='' as $$select veeays_job_health.record_observation(p_job_id,p_source,p_source_job_id,p_job_url,p_checked_at,p_status,p_reason,p_evidence_url,p_original_posted_at,p_date_provenance,p_source_published_at)$$;
create function public.veeays_job_health_candidates() returns jsonb language sql security invoker set search_path='' as $$select veeays_job_health.candidates()$$;
revoke all on function public.veeays_job_health_candidates() from public,anon,authenticated,service_role;
grant execute on function public.veeays_job_health_candidates() to service_role;
revoke all on function public.veeays_report_job(bigint,text,text),public.veeays_job_health(bigint,text),public.veeays_job_health_review(bigint,bigint,text,text,integer,timestamptz),public.veeays_job_health_observation(bigint,text,text,text,timestamptz,text,text,text,timestamptz,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.veeays_report_job(bigint,text,text),public.veeays_job_health(bigint,text),public.veeays_job_health_review(bigint,bigint,text,text,integer,timestamptz) to authenticated;
grant execute on function public.veeays_job_health_observation(bigint,text,text,text,timestamptz,text,text,text,timestamptz,text,timestamptz) to service_role;
commit;
