-- Stage 1 only: read-only member UI. Apply only with separate approval.
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

commit;
