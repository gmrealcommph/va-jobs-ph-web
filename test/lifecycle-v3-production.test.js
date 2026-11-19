import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { lifecycleV3Unsubscribe, lifecycleV3Webhook, runLifecycleV3 } from '../src/lifecycle-v3.js';

const sql = file => readFile(new URL(file, import.meta.url), 'utf8');
const user = '10000000-0000-4000-8000-000000000001';
const email = 'member@example.invalid';
const env = {
  LIFECYCLE_MODE: 'production', LIFECYCLE_V3_ENABLED: 'true',
  LIFECYCLE_DAILY_CAP: '50', LIFECYCLE_MONTHLY_CAP: '1500',
  SUPABASE_URL: 'https://nwqmhqiymtqkdihjadrp.supabase.co',
  SITE_URL: 'https://veeays.com', SUPABASE_SERVICE_ROLE_KEY: 'fixture', RESEND_API_KEY: 'fixture'
};

test('production gates, exclusive Day 0 ownership, receipt retention and rollback', async () => {
  const db = new PGlite();
  try {
    const base = await sql('./fixtures/lifecycle-v3-base.sql');
    // Production has the base lifecycle ledger and no welcome schema or send RPC.
    await db.exec(base.slice(0, base.indexOf('create schema welcome_private;'))
      + base.slice(base.indexOf('alter table auth.users add column is_anonymous'), base.indexOf('-- Existing welcome RPC')));
    await db.exec(`
      create function public.claim_member_email(uuid) returns jsonb language sql as $$select null::jsonb$$;
      create function public.start_member_email(uuid,uuid,timestamptz) returns boolean language sql as $$select false$$;
      grant execute on function public.claim_member_email(uuid),
        public.start_member_email(uuid,uuid,timestamptz) to service_role;
      create function public.suppress_member_email(p_provider text) returns void language sql as $$
        insert into veeays_lifecycle.provider_events(provider_id) values(p_provider) on conflict do nothing;
        update veeays_lifecycle.preferences set suppressed=true where user_id in
          (select user_id from veeays_lifecycle.deliveries where provider_id=p_provider)
      $$;
      create schema veeays_campaign;
      create table veeays_campaign.deliveries(
        campaign text, provider_id text, user_id uuid, provider_event text, updated_at timestamptz
      );
      create function public.veeays_v4_provider_event(p_provider text,p_event text) returns boolean language plpgsql security definer set search_path='' as $$
      declare uid uuid;
      begin
        if p_event not in ('email.bounced','email.complained','email.suppressed','email.delivered','email.failed') then return false;end if;
        update veeays_campaign.deliveries set provider_event=p_event,updated_at=now() where campaign='refer-earn-v4-20261029' and provider_id=p_provider returning user_id into uid;
        if uid is not null and p_event in ('email.bounced','email.complained','email.suppressed') then
          update veeays_lifecycle.preferences set suppressed=true where user_id=uid;
        end if;
        return uid is not null;
      end $$;
      alter table veeays_lifecycle.control drop constraint control_daily_cap_check, drop constraint control_monthly_cap_check;
      update veeays_lifecycle.control set enabled=true, daily_cap=500, monthly_cap=10000;
      with users as (
        insert into auth.users (id,created_at) select gen_random_uuid(), now()-interval '90 days'
          from generate_series(1,9) returning id
      ) insert into veeays_lifecycle.deliveries (user_id,step,state,accepted_at,provider_id)
        select id,'getting-started','accepted',now()-interval '90 days',id::text from users;
    `);
    const receipts = () => db.query("select id,provider_id,accepted_at from veeays_lifecycle.deliveries where state='accepted' order by id");
    const originalReceipts = (await receipts()).rows;
    assert.equal(originalReceipts.length, 9);
    await db.exec(await sql('../sql/lifecycle-v3-continuity.sql'));
    const preReleaseBounce = (await db.query(`select
      public.record_member_email_v3_event('pre-release-bounce','bounced',null) as recorded,
      has_function_privilege('anon','public.record_member_email_v3_event(text,text,text)','execute') as public_access`)).rows[0];
    assert.deepEqual(preReleaseBounce, { recorded: true, public_access: false });
    assert.equal((await db.query("select count(*)::int as n from veeays_lifecycle.provider_events where provider_id='pre-release-bounce'")).rows[0].n, 1);
    await db.exec(await sql('../sql/lifecycle-v3-production.sql'));
    assert.deepEqual((await receipts()).rows, originalReceipts);
    assert.deepEqual((await db.query(`
      select enabled,v3_enabled,v3_start_at='infinity' as no_cutover,v3_daily_cap,v3_cycle_cap,
        has_function_privilege('service_role','public.claim_member_email(uuid)','execute') as legacy_claim,
        has_function_privilege('service_role','public.start_member_email(uuid,uuid,timestamptz)','execute') as legacy_start,
        has_function_privilege('anon','public.claim_member_email_v3(uuid)','execute') as public_claim,
        to_regprocedure('public.welcome_work(text,text,uuid,uuid,uuid,jsonb,text,text,text)') is not null as legacy_welcome
      from veeays_lifecycle.control
    `)).rows[0], {
      enabled: true, v3_enabled: false, no_cutover: true, v3_daily_cap: 50, v3_cycle_cap: 1500,
      legacy_claim: false, legacy_start: false, public_claim: false, legacy_welcome: false
    });
    await db.query("insert into auth.users(id,email,created_at,email_confirmed_at) values($1,$2,now()-interval '1 hour',now())", [user,email]);
    await db.query('insert into public.profiles(id) values($1)', [user]);
    await db.query('insert into veeays_lifecycle.preferences(user_id,tips,tips_at) select id,true,created_at from auth.users where id=$1', [user]);
    const call = async (_env, name, args) => {
      const params = Object.keys(args).map((arg, index) => `${arg} => $${index + 1}`);
      return (await db.query(`select public.${name}(${params.join(',')}) as result`, Object.values(args))).rows[0].result;
    };
    const neverSend = async () => assert.fail('unexpected provider request');
    const run = (config = env, request = neverSend, rpc = call) => runLifecycleV3(config, { call: rpc, request });
    assert.equal((await run({ ...env, LIFECYCLE_V3_ENABLED: 'false' }, neverSend, neverSend)).status, 'disabled');
    assert.equal((await run({ ...env, SITE_URL: 'https://other.example' }, neverSend, neverSend)).status, 'configuration_blocked');
    assert.equal((await run({ ...env, LIFECYCLE_DAILY_CAP: '2001' }, neverSend, neverSend)).status, 'configuration_blocked');
    assert.equal((await run()).status, 'idle');

    await db.exec("update veeays_lifecycle.control set v3_enabled=true, v3_start_at=now()");
    assert.equal((await run()).status, 'idle');
    await db.exec(`update veeays_lifecycle.control set v3_start_at=now(),v3_cycle_start=now()-interval '1 day',
      v3_cycle_end=now()+interval '29 days'`);
    assert.equal((await run()).status, 'idle');
    await db.exec("update veeays_lifecycle.control set v3_start_at=now()-interval '2 hours'");
    await db.query("insert into welcome_private.deliveries(user_id,state,provider_id) values($1,'accepted','legacy-receipt')", [user]);
    assert.equal((await run()).status, 'idle');
    assert.equal((await db.query('select provider_id from welcome_private.deliveries')).rows[0].provider_id, 'legacy-receipt');
    await db.exec("update welcome_private.deliveries set state='held', provider_id=null");
    assert.equal((await run()).status, 'idle');
    await db.exec('truncate welcome_private.deliveries');
    // Recent historical accepted receipts count even when they lack a first-attempt timestamp.
    await db.exec("update veeays_lifecycle.control set v3_daily_cap=5");
    await db.exec("update veeays_lifecycle.deliveries set accepted_at=now() where state='accepted'");
    assert.equal((await run({ ...env, LIFECYCLE_DAILY_CAP: '5' })).status, 'deferred');
    await db.exec("update veeays_lifecycle.control set v3_daily_cap=50");
    await db.exec("update veeays_lifecycle.deliveries set accepted_at=now()-interval '90 days' where state='accepted'");
    await db.query("update auth.users set email='delivered@resend.dev' where id=$1", [user]);
    assert.equal((await run()).status, 'idle');
    await db.query('update auth.users set email=$2 where id=$1', [user,email]);
    let attempted = 0;
    const sending = await run(env, async (_url, options) => {
      attempted++;
      const payload = JSON.parse(options.body);
      assert.deepEqual(payload.to, [email]);
      assert.match(payload.text, /https:\/\/veeays\.com\/member-emails\/unsubscribe\?token=/);
      return Response.json({ id: 'unknown-receipt' });
    }, async (...args) => {
      if (['finish_member_email','hold_member_email'].includes(args[1])) throw Error('database unavailable');
      return call(...args);
    }).catch(error => error.message);
    assert.equal(sending, 'database unavailable');
    assert.equal(attempted, 1);
    assert.equal((await db.query('select last_reason from welcome_private.deliveries')).rows[0].last_reason, 'lifecycle_v3_day_0');

    await db.exec(await sql('../sql/lifecycle-v3-production-rollback.sql'));
    assert.equal((await run()).status, 'idle');
    assert.equal((await db.query("select state from veeays_lifecycle.deliveries where step='welcome'")).rows[0].state, 'sending');
    await db.exec("update veeays_lifecycle.deliveries set lease_until=now()-interval '1 minute' where step='welcome'");
    await db.exec(await sql('../sql/lifecycle-v3-production-rollback.sql'));
    assert.deepEqual((await db.query("select state,code,payload is not null as frozen from veeays_lifecycle.deliveries where step='welcome'")).rows[0],
      { state: 'held', code: 'ambiguous_after_start', frozen: true });
    const finalReceipts = (await receipts()).rows;
    assert.deepEqual(finalReceipts.map(({ id, provider_id }) => [id, provider_id]), originalReceipts.map(({ id, provider_id }) => [id, provider_id]));
    await db.exec('update veeays_lifecycle.control set v3_enabled=true');
    assert.equal((await run()).status, 'idle');

    await db.query("update welcome_private.deliveries set provider_id='welcome-a' where user_id=$1", [user]);
    const secret = new Uint8Array(32).fill(7);
    const webhookEnv = { ...env, LIFECYCLE_V3_ENABLED: 'false',
      LIFECYCLE_WEBHOOK_SECRET: 'whsec_' + Buffer.from(secret).toString('base64') };
    const webhook = async (kind, signed = true, data = { email_id: 'welcome-a' }) => {
      const body = JSON.stringify({ type: 'email.' + kind, data });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const id = 'receipt-' + kind;
      const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(id + '.' + timestamp + '.' + body));
      return lifecycleV3Webhook(new Request('https://veeays.com/webhooks/member-emails', {
        method: 'POST', body, headers: { 'svix-id': id, 'svix-timestamp': timestamp,
          'svix-signature': signed ? 'v1,' + Buffer.from(signature).toString('base64') : 'v1,AAAA' }
      }), webhookEnv, { call });
    };
    assert.equal((await webhook('bounced', false)).status, 401);
    await db.query("insert into veeays_campaign.deliveries(campaign,provider_id,user_id) values('refer-earn-v4-20261029','campaign-fixture',$1)", [user]);
    assert.equal((await webhook('delivered', false, {email_id:'campaign-fixture'})).status,401);
    assert.equal((await db.query("select provider_event from veeays_campaign.deliveries")).rows[0].provider_event,null);
    for (const kind of ['delivered','failed','delivered']) {
      assert.equal((await webhook(kind, true, {email_id:'campaign-fixture'})).status,204);
      assert.equal((await db.query("select provider_event from veeays_campaign.deliveries")).rows[0].provider_event,'email.'+kind);
    }
    assert.equal((await webhook('bounced')).status, 204);
    assert.equal((await webhook('suppressed')).status, 204);
    assert.equal((await webhook('complained')).status, 204);
    assert.deepEqual((await db.query("select v3_enabled,(select outcome from welcome_private.deliveries) as outcome from veeays_lifecycle.control")).rows[0],
      { v3_enabled: false, outcome: 'complained' });
    await db.exec('update veeays_lifecycle.control set v3_enabled=true');
    assert.equal((await webhook('complained')).status, 204);
    assert.equal((await db.query("select v3_enabled from veeays_lifecycle.control")).rows[0].v3_enabled, true);
    assert.equal((await webhook('bounced', true, { email_id: 'other-sender', from: 'VeeAys <jobs@veeays.com>', to: [email] })).status, 204);
    assert.equal((await db.query('select suppressed from veeays_lifecycle.preferences')).rows[0].suppressed, false);
    assert.equal((await webhook('bounced', true, { email_id: 'auth-confirmation', from: 'VeeAys <no-reply@veeays.com>', to: [email] })).status, 204);
    assert.equal((await db.query('select suppressed from veeays_lifecycle.preferences')).rows[0].suppressed, true);

    const token = (await db.query('select token from veeays_lifecycle.preferences')).rows[0].token;
    const url = `https://veeays.com/member-emails/unsubscribe?token=${token}`;
    const disabled = { ...env, LIFECYCLE_V3_ENABLED: 'false' };
    const confirmation = await lifecycleV3Unsubscribe(new Request(url), disabled, { call: neverSend });
    assert.equal(confirmation.status, 200);
    assert.match(await confirmation.text(), /<form method="post">/);
    assert.equal((await db.query('select tips from veeays_lifecycle.preferences')).rows[0].tips, true);
    const response = await lifecycleV3Unsubscribe(new Request(url, {
      method: 'POST', body: new URLSearchParams({ 'List-Unsubscribe': 'One-Click' })
    }), { ...env, LIFECYCLE_V3_ENABLED: 'false' }, { call });
    assert.equal(response.status, 200);
    assert.equal((await db.query('select tips from veeays_lifecycle.preferences')).rows[0].tips, false);
    const oneClick = link => lifecycleV3Unsubscribe(new Request(link, {
      method: 'POST', body: new URLSearchParams({ 'List-Unsubscribe': 'One-Click' })
    }), disabled, { call });
    assert.equal((await oneClick(url.replace(token, 'malformed'))).status, 400);
    assert.equal((await oneClick(url.replace(token, crypto.randomUUID()))).status, 200);
    assert.equal((await db.query('select suppressed from veeays_lifecycle.preferences')).rows[0].suppressed, true);
  } finally {
    await db.close();
  }
});
