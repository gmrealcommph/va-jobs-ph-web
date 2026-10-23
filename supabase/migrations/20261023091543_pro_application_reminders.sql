-- Additive only. Existing applications, notes, stages and payments are untouched.
create table public.job_application_reminders (
 user_id uuid not null,
 job_id bigint not null,
 remind_on date not null check (remind_on between date '2020-01-01' and date '2100-12-31'),
 label text not null default 'Follow up on application' check (length(label) between 1 and 120),
 primary key (user_id,job_id),
 foreign key (user_id,job_id) references public.job_applications(user_id,job_id) on delete cascade
);
alter table public.job_application_reminders enable row level security;
-- Supabase default privileges may include TRUNCATE, which bypasses row-level security.
-- Clear defaults before granting only the intended row operations.
revoke all on public.job_application_reminders from public,anon,authenticated;
grant select,insert,update,delete on public.job_application_reminders to authenticated;
create policy reminder_read on public.job_application_reminders for select to authenticated using ((select auth.uid())=user_id);
create policy reminder_delete on public.job_application_reminders for delete to authenticated using ((select auth.uid())=user_id);
create policy reminder_insert on public.job_application_reminders for insert to authenticated with check (
 (select auth.uid())=user_id and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.plan='pro' and p.plan_status='active' and (p.pro_expires_at is null or p.pro_expires_at>now()))
);
create policy reminder_update on public.job_application_reminders for update to authenticated using ((select auth.uid())=user_id) with check (
 (select auth.uid())=user_id and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.plan='pro' and p.plan_status='active' and (p.pro_expires_at is null or p.pro_expires_at>now()))
);
-- Preserve the existing production suspension guard when present.
do $$ begin if to_regprocedure('veeays_admin.member_active()') is not null then
 execute 'create policy member_suspension_guard on public.job_application_reminders as restrictive for all to authenticated using ((select veeays_admin.member_active())) with check ((select veeays_admin.member_active()))';
end if; end $$;
