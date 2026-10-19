create table public.saved_job_searches (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null check (slot between 1 and 5),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  keyword text not null default '' check (char_length(keyword)<=120),
  category text not null default '' check (char_length(category)<=120),
  sort text not null default 'newest' check (sort in ('newest','oldest')),
  primary key(user_id,slot)
);
alter table public.saved_job_searches enable row level security;
revoke all on public.saved_job_searches from public,anon,authenticated;
grant select,insert,update,delete on public.saved_job_searches to authenticated;
create policy saved_search_read on public.saved_job_searches for select to authenticated
  using ((select auth.uid())=user_id);
create policy saved_search_delete on public.saved_job_searches for delete to authenticated
  using ((select auth.uid())=user_id);
create policy saved_search_insert on public.saved_job_searches for insert to authenticated
  with check ((select auth.uid())=user_id and exists (
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.plan='pro' and p.plan_status='active'
      and (p.pro_expires_at is null or p.pro_expires_at>now())
  ));
create policy saved_search_update on public.saved_job_searches for update to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id and exists (
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.plan='pro' and p.plan_status='active'
      and (p.pro_expires_at is null or p.pro_expires_at>now())
  ));
create policy member_suspension_guard on public.saved_job_searches as restrictive for all to authenticated
  using ((select veeays_admin.member_active())) with check ((select veeays_admin.member_active()));
comment on table public.saved_job_searches is 'Five account-owned keyword/category slots; retained on Pro expiry, deleted with account; no email consent implied.';
