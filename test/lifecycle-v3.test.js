import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { lifecycleV3Unsubscribe, runLifecycleV3 } from '../src/lifecycle-v3.js';
import { STEPS } from '../emails/lifecycle/v3/schedule.mjs';

const db = new PGlite();
const user = '00000000-0000-4000-8000-000000000001';
const welcomeLease = '00000000-0000-4000-8000-000000000002';
const fake = 'delivered@resend.dev';
const env = {
  LIFECYCLE_MODE: 'staging-v3', LIFECYCLE_DAILY_CAP: '5', LIFECYCLE_MONTHLY_CAP: '50',
  LIFECYCLE_TEST_EMAIL: fake, SUPABASE_URL: 'https://megedmsfdwtjxjejrxaq.supabase.co',
  SITE_URL: 'https://veeays-member-emails-staging.gm-realcommph.workers.dev',
  SUPABASE_SERVICE_ROLE_KEY: 'local', RESEND_API_KEY: 'local'
};

async function call(_env, name, args) {
  const params = Object.keys(args).map((arg, index) => `${arg} => $${index + 1}`);
  const { rows } = await db.query(`select public.${name}(${params.join(', ')}) as result`, Object.values(args));
  return rows[0].result;
}

async function setup(hours, { email = fake, pro = true } = {}) {
  await db.exec(`truncate auth.users cascade;
    truncate public.profiles, welcome_private.deliveries, veeays_alerts.settings,
      veeays_alerts.deliveries, veeays_alerts.provider_suppressions, veeays_lifecycle.provider_events;
    update veeays_lifecycle.control set enabled=true, start_at=now()-interval '60 days', daily_cap=5, monthly_cap=50;
    update welcome_private.control set enabled=true, start_at=now()-interval '60 days', mode='production';`);
  await db.query(`insert into auth.users(id,email,created_at,email_confirmed_at)
    values ($1,$2,now()-$3*interval '1 hour',now())`, [user,email,hours]);
  await db.query('insert into public.profiles(id) values ($1)', [user]);
  await db.query(`insert into veeays_lifecycle.preferences(user_id,tips,pro,tips_at,pro_at)
    select id,true,$2,created_at,created_at from auth.users where id=$1`, [user,pro]);
}

async function run({ config = env, rpc = call, provider } = {}) {
  const sends = [];
  const result = await runLifecycleV3(config, {
    call: rpc,
    async request(url, options) {
      assert.equal(url, 'https://api.resend.com/emails');
      sends.push({ key: options.headers['Idempotency-Key'], ...JSON.parse(options.body) });
      if (provider) return provider();
      return Response.json({ id: crypto.randomUUID() });
    }
  });
  return { status: result.status, sends };
}

before(async () => {
  for (const file of ['./fixtures/lifecycle-v3-base.sql', '../sql/lifecycle-v3-staging.sql']) {
    await db.exec(await readFile(new URL(file, import.meta.url), 'utf8'));
  }
});
after(() => db.close());

test('all ten windows select their own lesson, serialize starts, and settle only once', async () => {
  for (const { day, subject } of STEPS) {
    await setup(day * 24);
    const concurrently = await Promise.all([run(), run()]);
    const [message] = concurrently.flatMap(({ sends }) => sends);
    assert.equal(concurrently.filter(({ status }) => status === 'accepted').length, 1);
    assert.equal(concurrently.flatMap(({ sends }) => sends).length, 1);
    assert.equal(message.subject, subject);
    assert.deepEqual(message.to, [fake]);
    assert.match(message.html, /<h1 class="heading"/);
    assert.match(message.key, /^veeays-member-email-/);
    assert.equal(message.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.match(message.text, /member-emails\/unsubscribe\?token=/);
    assert.equal((await run()).status, 'idle');
  }
});

test('Day 3 follows Day 2 within 48 hours and expired milestones are never replayed', async () => {
  await setup(50);
  assert.equal((await run()).status, 'accepted');
  await db.exec(`update auth.users set created_at=created_at-interval '24 hours';
    update veeays_lifecycle.deliveries set first_attempt_at=now()-interval '24 hours';
    update veeays_lifecycle.send_slots set reserved_at=now()-interval '24 hours',lease_until=now()-interval '23 hours';`);
  const dayThree = await run();
  assert.equal(dayThree.sends[0]?.subject, STEPS.find(step => step.day === 3).subject);
  for (const age of [24, 96, 744, 1_440]) {
    await setup(age);
    assert.equal((await run()).status, 'idle');
  }
});

test('fake-only guard, cap mismatch, exhausted caps, and ambiguous provider outcomes', async () => {
  await setup(48, { email: 'someone@example.invalid' });
  assert.equal((await run()).status, 'idle');
  assert.equal((await run({ config: { ...env, SUPABASE_URL: 'https://production.example' } })).status, 'configuration_blocked');
  await setup(48);
  assert.equal((await run({ config: { ...env, LIFECYCLE_DAILY_CAP: '4' } })).status, 'deferred');
  assert.equal((await run({ provider: () => { throw Error('timeout'); } })).status, 'held');
  assert.equal((await run()).status, 'idle');
  await setup(48);
  await db.exec(`update veeays_lifecycle.control set daily_cap=1,monthly_cap=1;
    insert into veeays_lifecycle.deliveries(user_id,step,state,first_attempt_at)
     select id,'welcome','held',now() from auth.users;`);
  assert.equal((await run({ config: { ...env, LIFECYCLE_DAILY_CAP: '1', LIFECYCLE_MONTHLY_CAP: '1' } })).status, 'deferred');
});

test('consent, Pro fallback, suppression and unsubscribe are checked at start', async () => {
  for (const setupVariant of [
    async () => db.exec("update public.profiles set plan='pro'"),
    async () => db.exec('update veeays_lifecycle.preferences set pro=false'),
    async () => db.exec("update veeays_lifecycle.preferences set pro_at=now()-interval '1 hour'")
  ]) {
    await setup(50);
    await setupVariant();
    assert.doesNotMatch((await run()).sends[0].html, /https:\/\/veeays\.com\/pro/);
  }
  await setup(50);
  assert.match((await run()).sends[0].html, /https:\/\/veeays\.com\/pro/);

  for (const sql of [
    "update veeays_lifecycle.preferences set tips_at=now()-interval '1 hour'",
    'update veeays_lifecycle.preferences set suppressed=true',
    'insert into veeays_alerts.settings select id,true from auth.users',
    'update auth.users set email_confirmed_at=null'
  ]) {
    await setup(50);
    await db.exec(sql);
    assert.equal((await run()).status, 'idle');
  }

  await setup(50);
  const { rows: [{ token }] } = await db.query('select token from veeays_lifecycle.preferences');
  const unsubscribeUrl = `${env.SITE_URL}/member-emails/unsubscribe?token=${token}`;
  const opts = { call };
  assert.equal((await lifecycleV3Unsubscribe(new Request(unsubscribeUrl), env, opts)).status, 200);
  const result = await run({ rpc: async (config, name, args) => {
    if (name === 'start_member_email_v3') {
      const response = await lifecycleV3Unsubscribe(new Request(unsubscribeUrl, {
        method: 'POST', body: new URLSearchParams({ 'List-Unsubscribe': 'One-Click' })
      }), env, opts);
      assert.equal(await response.text(), 'You are unsubscribed.');
    }
    return call(config, name, args);
  } });
  assert.deepEqual(result, { status: 'deferred', sends: [] });
});

test('Day 0 and the separate welcome RPC cannot both prepare a provider attempt', async () => {
  const prepare = () => call(env, 'welcome_work', {
    p_action: 'prepare', p_mode: 'production', p_user: user, p_token: welcomeLease, p_payload: { to: [fake] }
  });
  for (const first of ['legacy', 'lifecycle']) {
    await setup(1);
    await db.query(`insert into welcome_private.deliveries(user_id,state,token,lease_until)
      values ($1,'sending',$2,now()+interval '5 minutes')`, [user,welcomeLease]);
    if (first === 'legacy') {
      assert.deepEqual((await prepare()).payload.to, [fake]);
      assert.equal((await run()).status, 'idle');
    } else {
      await db.exec('update veeays_lifecycle.preferences set tips_at=now()');
      assert.equal((await run()).status, 'accepted');
      assert.equal(await prepare(), null);
    }
  }
});
