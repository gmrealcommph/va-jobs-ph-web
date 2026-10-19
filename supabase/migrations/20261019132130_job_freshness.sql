-- Read-time visibility only: never update/delete jobs or verification evidence.
-- Preserve the public view's columns, grants, eligibility and deduplication.
begin;
create or replace view public.public_jobs as
with eligible as (
 select j.*, coalesce(j.original_posted_at, d.original_posted_at, j.posted_at) as freshness_date,
   (r.state='evergreen' and r.expires_at>now()) as evergreen,
   exists (
     select 1 from veeays_job_health.observations o
     where o.job_id=j.id and o.source=j.source and o.source_job_id=j.source_job_id and o.job_url=j.job_url
       and o.status='open' and o.checked_at<=now()
       and not exists (
         select 1 from veeays_job_health.observations c
         where c.job_id=j.id and c.source=j.source and c.source_job_id=j.source_job_id and c.job_url=j.job_url
           and c.status='closed' and c.checked_at>=o.checked_at and c.checked_at<=now()
       )
   ) as verified_open
 from public.jobs j
 left join veeays_job_health.reviews r on r.job_id=j.id
 left join lateral (
   select o.original_posted_at from veeays_job_health.observations o
   where o.job_id=j.id and o.source=j.source and o.source_job_id=j.source_job_id and o.job_url=j.job_url
     and o.original_posted_at is not null and o.date_provenance='employer_original' and o.checked_at<=now()
   order by o.checked_at desc limit 1
 ) d on true
 where j.status='active' and j.philippines_eligible=true
), ranked_jobs as (
 select *, row_number() over (
   partition by lower(trim(company)),lower(trim(title))
   order by case when source in ('workable','lever','greenhouse','ashby') then 1 when source='himalayas' then 2 else 3 end,
     freshness_date desc nulls last,collected_at desc nulls last,id desc
 ) as duplicate_rank
 from eligible
 -- Whole-day ages: day 45 stays visible, day 46 is hidden unless excepted.
 where freshness_date is null or freshness_date>now()-interval '46 days' or evergreen or verified_open
)
select id,title,company,description,category,location,remote,workplace_type,source,job_url,
 freshness_date as posted_at,collected_at,company_logo_url
from ranked_jobs where duplicate_rank=1;
commit;
