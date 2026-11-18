-- Apply before routing the safety Worker. This migration has no sending controls.
begin;

create or replace function public.record_member_email_v3_event(
  p_provider text, p_kind text, p_recipient text
) returns boolean language plpgsql security definer set search_path = pg_catalog as $$
declare
  member_id uuid;
begin
  if p_provider is null or length(p_provider) not between 1 and 128
    or p_kind is null or p_kind not in ('bounced','complained','suppressed') then
    return false;
  end if;

  -- The release migration adds the two-argument implementation. It serializes
  -- with admission and handles complaint pauses and welcome delivery outcomes.
  if to_regprocedure('public.record_member_email_v3_event(text,text)') is null then
    perform public.suppress_member_email(p_provider);
  elsif not public.record_member_email_v3_event(p_provider,p_kind) then
    return false;
  end if;

  -- Auth messages have no lifecycle delivery record. Suppress only the
  -- lifecycle preferences for a unique, current recipient match.
  if p_recipient is not null and length(p_recipient) between 3 and 320 then
    select (array_agg(u.id))[1] into member_id
    from auth.users u where lower(u.email)=lower(p_recipient) and u.deleted_at is null
    having count(*)=1;
    if member_id is not null then
      insert into veeays_lifecycle.preferences as prefs(user_id,suppressed)
      values (member_id,true)
      on conflict (user_id) do update set suppressed=true,updated_at=clock_timestamp()
      where not prefs.suppressed;
    end if;
  end if;
  return true;
end;
$$;

revoke all on function public.record_member_email_v3_event(text,text,text)
  from public,anon,authenticated;
grant execute on function public.record_member_email_v3_event(text,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
