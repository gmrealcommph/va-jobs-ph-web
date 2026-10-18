-- Review/apply only after approval. Requires admin-dashboard.sql and account-deletion.sql.
begin;
create table if not exists veeays_admin.member_audit(
 id bigint generated always as identity primary key,
 actor uuid not null, target uuid not null, action text not null,
 reason text not null, request_id uuid not null, created_at timestamptz not null default now(),
 unique(request_id,action)
);
alter table veeays_admin.member_audit enable row level security;
revoke all on veeays_admin.member_audit from public,anon,authenticated;

create or replace function veeays_admin.members(p_query text,p_filter text,p_offset integer,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='5s' as $$
declare result jsonb;
begin
 if not veeays_admin.has_access() then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_filter not in ('all','verified','unverified','suspended','review') or p_offset<0 or p_offset>100000 or length(p_query)>100 then raise exception 'Invalid filter'; end if;
 select jsonb_build_object('members',coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb)) into result from (
  select u.id,u.email,u.created_at,u.email_confirmed_at,u.last_sign_in_at,
   u.banned_until,coalesce(u.banned_until>now(),false) suspended,
   p.full_name,p.plan,p.plan_status,p.pro_expires_at,
   exists(select 1 from veeays_admin.accounts a where a.user_id=u.id) protected,
   case when lower(split_part(u.email,'@',2))=any(array['mailinator.com','guerrillamail.com','10minutemail.com','tempmail.com','yopmail.com']) then 'Known disposable domain (limited list)'
    when u.email_confirmed_at is null and u.created_at<now()-interval '7 days' then 'Unverified for over 7 days' else null end review_reason,
   (select count(*) from public.pro_payments r where r.user_id=u.id and r.status='confirmed') confirmed_receipts
  from auth.users u left join public.profiles p on p.id=u.id
  where (p_id is null or u.id=p_id) and (coalesce(p_query,'')='' or position(lower(p_query) in lower(coalesce(u.email,'')||' '||coalesce(p.full_name,'')||' '||u.id::text))>0)
   and (p_filter='all' or p_filter='verified' and u.email_confirmed_at is not null or p_filter='unverified' and u.email_confirmed_at is null
    or p_filter='suspended' and u.banned_until>now()
    or p_filter='review' and (lower(split_part(u.email,'@',2))=any(array['mailinator.com','guerrillamail.com','10minutemail.com','tempmail.com','yopmail.com']) or u.email_confirmed_at is null and u.created_at<now()-interval '7 days'))
  order by u.created_at desc,u.id limit 51 offset p_offset
 ) m;
 if p_id is not null then
  result:=result||jsonb_build_object('audit',coalesce((select jsonb_agg(to_jsonb(a)) from (select actor,action,reason,created_at from veeays_admin.member_audit where target=p_id order by id desc limit 50) a),'[]'::jsonb));
 end if;
 return result;
end $$;
revoke all on function veeays_admin.members(text,text,integer,uuid) from public,anon;
grant execute on function veeays_admin.members(text,text,integer,uuid) to authenticated;
create or replace function public.veeays_admin_members(p_query text default '',p_filter text default 'all',p_offset integer default 0,p_id uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select veeays_admin.members(p_query,p_filter,p_offset,p_id)$$;
revoke all on function public.veeays_admin_members(text,text,integer,uuid) from public,anon;
grant execute on function public.veeays_admin_members(text,text,integer,uuid) to authenticated;

-- Existing access JWTs may survive session revocation. Restrictive policies also
-- block direct Data API access to member-owned rows while the account is banned.
create or replace function veeays_admin.member_active() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id
  where u.id=auth.uid() and (u.banned_until is null or u.banned_until<=now())
   and s.id::text=current_setting('request.jwt.claims',true)::jsonb->>'session_id'
   and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function veeays_admin.member_active() from public,anon;
grant execute on function veeays_admin.member_active() to authenticated;
create or replace function public.veeays_member_active() returns boolean
language sql stable security invoker set search_path='' as $$select veeays_admin.member_active()$$;
revoke all on function public.veeays_member_active() from public,anon;
grant execute on function public.veeays_member_active() to authenticated;
do $$
declare target text;
begin
 foreach target in array array['profiles','job_preferences','saved_jobs','job_applications','job_match_notifications','pro_payments'] loop
  execute format('drop policy if exists member_suspension_guard on public.%I',target);
  execute format('create policy member_suspension_guard on public.%I as restrictive for all to authenticated using ((select veeays_admin.member_active())) with check ((select veeays_admin.member_active()))',target);
 end loop;
end $$;

create or replace function public.veeays_admin_member_action(p_actor uuid,p_target uuid,p_action text,p_reason text,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if current_setting('request.jwt.claims',true)::jsonb->>'role' is distinct from 'service_role'
  or not exists(select 1 from veeays_admin.accounts where user_id=p_actor)
  or p_actor=p_target or exists(select 1 from veeays_admin.accounts where user_id=p_target)
  then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_request is null or p_target is null or p_reason is null or length(trim(p_reason))<5 or length(p_reason)>500 or p_action is null or p_action not in ('suspend','reactivate','delete','finish_delete') then raise exception 'Invalid action'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request::text,0));
 if exists(select 1 from veeays_admin.member_audit where request_id=p_request and (actor<>p_actor or target<>p_target)) then raise exception 'Confirmation mismatch'; end if;
 if exists(select 1 from veeays_admin.member_audit where request_id=p_request and action<>p_action and not (p_action='finish_delete' and action='delete') and not (p_action='delete' and action='finish_delete')) then raise exception 'Action mismatch'; end if;
 if exists(select 1 from veeays_admin.member_audit where request_id=p_request and action=p_action) then
  if p_action='delete' then
   if exists(select 1 from veeays_admin.member_audit where request_id=p_request and action='finish_delete') then return jsonb_build_object('deleted',true); end if;
   return public.prepare_account_deletion(p_target);
  end if;
  return jsonb_build_object('ok',true);
 end if;
 perform 1 from auth.users where id=p_target for update;
 if not found then raise exception 'Member unavailable'; end if;
 if p_action='delete' then result:=public.prepare_account_deletion(p_target);
 elsif p_action='finish_delete' then
  if not exists(select 1 from veeays_admin.member_audit where request_id=p_request and actor=p_actor and target=p_target and action='delete') then raise exception 'Deletion not confirmed'; end if;
  result:=public.finish_account_deletion(p_target);
 else
  if exists(select 1 from veeays_private.deletion_requests where user_id=p_target) then raise exception 'Deletion in progress'; end if;
  update auth.users set banned_until=case when p_action='suspend' then 'infinity'::timestamptz else null end where id=p_target;
  -- Remove refresh sessions. The Worker also checks banned_until on every user lookup.
  delete from auth.refresh_tokens where user_id=p_target::text;
  delete from auth.sessions where user_id=p_target;
  result:=jsonb_build_object('ok',true);
 end if;
 insert into veeays_admin.member_audit(actor,target,action,reason,request_id) values(p_actor,p_target,p_action,p_reason,p_request);
 return result;
end $$;
revoke all on function public.veeays_admin_member_action(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.veeays_admin_member_action(uuid,uuid,text,text,uuid) to service_role;
commit;
