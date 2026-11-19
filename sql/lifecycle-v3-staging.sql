-- Staging sender. Existing control stays disabled until an explicit staging test.
alter table veeays_lifecycle.deliveries drop constraint deliveries_step_check;
alter table veeays_lifecycle.deliveries add constraint deliveries_step_check check (step in (
 'verify-day-2','verify-day-5','welcome','getting-started','va-skills-lab','profile-tip',
 'pro-introduction','safer-search','interview-tip','resume-tip','follow-up-tip','first-month'
));

create function veeays_lifecycle.v3_steps()
returns table(step text, age_hours integer)
language sql immutable set search_path = pg_catalog as $$
 values ('welcome',0),('getting-started',48),('va-skills-lab',72),('profile-tip',120),
 ('pro-introduction',168),('safer-search',240),('interview-tip',336),
 ('resume-tip',456),('follow-up-tip',576),('first-month',720)
$$;

create function veeays_lifecycle.v3_candidate(p_user uuid, p_step text, p_ignore uuid default null)
returns table(email text, token uuid, variant text)
language sql stable set search_path = pg_catalog as $$
 select u.email, s.token,
   case when p.plan='free' and s.pro and s.pro_at between u.created_at and timing.consent_cutoff
        then 'free' else 'pro' end
 from auth.users u
 join public.profiles p on p.id=u.id
 join veeays_lifecycle.preferences s on s.user_id=u.id
 join veeays_lifecycle.control c on c.id
 join veeays_lifecycle.v3_steps() v on v.step=p_step
 cross join lateral (select u.created_at+v.age_hours*interval '1 hour' as opens) window_start
 cross join lateral (select case when v.age_hours=0 then now() else window_start.opens end as consent_cutoff) timing
 where u.id=p_user and c.enabled and u.created_at>=c.start_at
   and u.email='delivered@resend.dev' and u.deleted_at is null and not coalesce(u.is_anonymous,false)
   and coalesce(u.banned_until<=now(),true)
   and u.email_confirmed_at between u.created_at and now()
   and now()>=window_start.opens and now()<window_start.opens+interval '24 hours'
   and p.plan in ('free','pro') and s.tips and not s.suppressed and s.token is not null
   and s.tips_at between u.created_at and timing.consent_cutoff
   and not exists(select 1 from veeays_alerts.settings a where a.user_id=u.id and a.suppressed)
   and not exists(select 1 from veeays_alerts.deliveries a join veeays_alerts.provider_suppressions e using(provider_id) where a.user_id=u.id)
   and not exists(select 1 from veeays_lifecycle.deliveries d join veeays_lifecycle.provider_events e using(provider_id) where d.user_id=u.id)
   and not exists(select 1 from welcome_private.deliveries w where w.user_id=u.id and w.outcome in ('bounced','complained','suppressed'))
   and not exists(select 1 from veeays_lifecycle.deliveries d where d.user_id=u.id and d.id is distinct from p_ignore
     and ((d.step=p_step and (d.first_attempt_at is not null or d.state in ('accepted','held','skipped')))
       or (d.state in ('leased','sending') and d.lease_until>now())))
   and (p_step<>'welcome' or not exists(select 1 from welcome_private.deliveries w where w.user_id=u.id
     and (w.first_attempt_at is not null or w.state='accepted')))
   and not exists(select 1 from veeays_lifecycle.send_slots slot where slot.user_id=u.id
     and (slot.lease_until>now() or (slot.kind='legacy' and slot.reserved_at>now()-interval '24 hours')))
   and not exists(select 1 from public.daily_digest_deliveries d where d.user_id=u.id and (d.first_attempt_at>now()-interval '24 hours' or d.lease_until>now()))
   and not exists(select 1 from public.job_match_notifications n where n.user_id=u.id and n.notified_at>now()-interval '24 hours')
   and not exists(select 1 from veeays_alerts.deliveries d where d.user_id=u.id and (d.first_attempt_at>now()-interval '24 hours' or d.lease_until>now()))
$$;

create function public.claim_member_email_v3(p_token uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare d veeays_lifecycle.deliveries; recipient record;
begin
 if p_token is null or not exists(select 1 from veeays_lifecycle.control where id and enabled) then return null; end if;
 update veeays_lifecycle.deliveries d1
 set state=case when first_attempt_at is null then 'pending' else 'held' end, code='lease_expired'
 where state in ('leased','sending') and lease_until<=now()
   and exists(select 1 from auth.users u where u.id=d1.user_id and u.email='delivered@resend.dev');
 select u.id, v.step into recipient
 from auth.users u cross join veeays_lifecycle.v3_steps() v
 cross join lateral veeays_lifecycle.v3_candidate(u.id,v.step) eligibility
 where u.email='delivered@resend.dev'
 order by u.created_at limit 1;
 if not found then return null; end if;
 insert into veeays_lifecycle.deliveries(user_id,step) values(recipient.id,recipient.step)
 on conflict(user_id,step) do nothing;
 select * into d from veeays_lifecycle.deliveries where user_id=recipient.id and step=recipient.step
   and state='pending' and first_attempt_at is null for update skip locked;
 if not found then return null; end if;
 update veeays_lifecycle.deliveries set state='leased',lease_token=p_token,lease_until=now()+interval '2 minutes'
 where id=d.id;
 return jsonb_build_object('id',d.id,'step',d.step);
end;
$$;

create function public.check_member_email_v3(p_id uuid,p_token uuid)
returns jsonb language sql security definer set search_path = pg_catalog as $$
 select to_jsonb(eligible)
 from veeays_lifecycle.deliveries d
 cross join lateral veeays_lifecycle.v3_candidate(d.user_id,d.step,d.id) eligible
 where d.id=p_id and d.lease_token=p_token and d.state='leased' and d.lease_until>now()
$$;

create function public.start_member_email_v3(p_id uuid,p_token uuid,p_variant text,p_daily_cap integer,p_monthly_cap integer,p_payload jsonb)
returns boolean language plpgsql security definer set search_path = pg_catalog as $$
declare d veeays_lifecycle.deliveries; c veeays_lifecycle.control; eligible record;
begin
 select * into d from veeays_lifecycle.deliveries
 where id=p_id and lease_token=p_token and state='leased' and lease_until>now()
 for update;
 if not found or p_payload is null or d.first_attempt_at is not null then return false; end if;
 select * into c from veeays_lifecycle.control where id for update;
 if not found or not c.enabled or p_daily_cap is distinct from c.daily_cap or p_monthly_cap is distinct from c.monthly_cap
   or c.daily_cap<1 or c.monthly_cap<1 then return false; end if;
 if (select count(*) from veeays_lifecycle.deliveries where first_attempt_at>=date_trunc('day',now(),'UTC'))>=c.daily_cap
   or (select count(*) from veeays_lifecycle.deliveries where first_attempt_at>=date_trunc('month',now(),'UTC'))>=c.monthly_cap
 then return false; end if;
 -- Serialize with preference writes and legacy send-slot reservations.
 perform 1 from veeays_lifecycle.preferences where user_id=d.user_id for update;
 select * into eligible from veeays_lifecycle.v3_candidate(d.user_id,d.step,d.id);
 if not found or eligible.variant is distinct from p_variant
   or p_payload->'to' is distinct from jsonb_build_array(eligible.email)
   or (d.payload is not null and d.payload is distinct from p_payload) then return false; end if;
 -- Use the existing welcome ledger as the arbiter for the staging simulator.
 -- The welcome RPC locks this row and checks its state before preparing a send.
 if d.step='welcome' then
   insert into welcome_private.deliveries as w(user_id,state,last_reason)
   values(d.user_id,'skipped','lifecycle_v3_day_0')
   on conflict(user_id) do update
     set state='skipped',last_reason='lifecycle_v3_day_0',token=null,lease_until=null,updated_at=now()
     where w.first_attempt_at is null and w.state<>'accepted'
       and coalesce(w.outcome,'') not in ('bounced','complained','suppressed');
   if not found then return false; end if;
 end if;
 insert into veeays_lifecycle.send_slots(key,user_id,kind) values('sequence:'||d.id::text,d.user_id,'sequence');
 update veeays_lifecycle.deliveries set state='sending',first_attempt_at=now(),payload=p_payload where id=d.id;
 return true;
end;
$$;

revoke all on function veeays_lifecycle.v3_steps(),veeays_lifecycle.v3_candidate(uuid,text,uuid)
 from public,anon,authenticated;
revoke all on function public.claim_member_email_v3(uuid), public.check_member_email_v3(uuid,uuid),
 public.start_member_email_v3(uuid,uuid,text,integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.claim_member_email_v3(uuid), public.check_member_email_v3(uuid,uuid),
 public.start_member_email_v3(uuid,uuid,text,integer,integer,jsonb) to service_role;
