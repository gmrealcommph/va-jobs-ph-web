import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { eligible, messageFor } from '../src/notifications.js';

const userId = '12345678-1234-1234-1234-123456789abc';
const env = { SUPABASE_URL: 'https://test-project.supabase.co', SITE_URL: 'https://veeays.example',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_fake_test_only', RESEND_API_KEY: 're_fake_test_only',
  MANUAL_NOTIFICATION_TOKEN: 'test-only-token-with-at-least-32-characters',
  MANUAL_STRONG_MATCH_IDS: '165', STRONG_MATCH_TEST_EMAIL: 'owner@example.com' };
const profile = { id: userId, full_name: 'Test Owner', plan: 'pro', plan_status: 'active', pro_expires_at: null };
const job = { id: 101, title: 'Digital Marketing & Social Media Manager', company: 'Assist World', location: 'Philippines',
  employment_type: 'full_time', salary_min_usd: 1500, salary_max_usd: 2000, salary_period: 'monthly' };
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
function request(action = 'preview', extra = {}, overrides = {}) {
  return new Request(`${env.SITE_URL}/internal/strong-match/165`, { method: 'POST',
    headers: { authorization: `Bearer ${env.MANUAL_NOTIFICATION_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ action, notification_id: 165, expected_email: env.STRONG_MATCH_TEST_EMAIL, confirm: 'SEND_165', ...extra }), ...overrides });
}
function mock(options = {}) {
  const state = { notification: { id: 165, user_id: userId, job_id: 101, match_score: 100,
    notification_type: 'strong_match', notified_at: null, ...options.notification },
    profile: { ...profile, ...options.profile }, prefs: { user_id: userId, email_strong_matches: true, ...options.prefs },
    delivery: options.delivery || null, requests: [], resendCalls: 0, acceptedEmails: 0, profileReads: 0, failAck: options.failAck };
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method || 'GET';
    state.requests.push({ url, method, headers: init.headers, body: init.body });
    if (url.hostname === 'api.resend.com') {
      state.resendCalls++;
      assert.equal(init.headers['Idempotency-Key'], `veeays-strong-match-test-project.supabase.co-${state.notification.id}`);
      assert.equal(state.notification.notified_at, null, 'must stay pending before provider acceptance');
      if (options.resendStatus) return response({ message: 'provider private error' }, options.resendStatus);
      state.acceptedEmails = 1; // Provider returns the same receipt for the same key/payload.
      if (options.timeoutOnce && state.resendCalls === 1) throw new Error('Timeout with sensitive upstream data');
      return response({ id: 'resend-receipt' });
    }
    assert.equal(init.headers.apikey, env.SUPABASE_SERVICE_ROLE_KEY);
    assert.equal(init.headers.Authorization, undefined, 'modern key must never be used as JWT');
    if (url.pathname.startsWith('/auth/v1/admin/users/')) return response({ id: userId,
      email: options.recipientEmail || env.STRONG_MATCH_TEST_EMAIL, email_confirmed_at: '2026-01-01T00:00:00Z' });
    const table = url.pathname.split('/').at(-1);
    if (table === 'job_match_notifications') {
      assert.equal(url.searchParams.get('id'), `eq.${state.notification.id}`);
      if (method === 'PATCH') {
        assert.ok(state.delivery?.resend_id, 'receipt must be durable before notified_at');
        if (state.failAck) return response({ error: 'db error' }, 500);
        Object.assign(state.notification, JSON.parse(init.body));
        return response([state.notification]);
      }
      if ((url.searchParams.get('notified_at') === 'is.null' && state.notification.notified_at) ||
        (url.searchParams.get('notification_type') && state.notification.notification_type !== 'strong_match')) return response([]);
      return response([state.notification]);
    }
    if (table === 'manual_strong_match_deliveries') {
      if (method === 'POST') {
        if (options.concurrentReservation || state.delivery) return response([]);
        state.delivery = { ...JSON.parse(init.body), created_at: new Date().toISOString(), resend_id: null, accepted_at: null };
        return response([state.delivery]);
      }
      if (method === 'PATCH') {
        if (options.failReceiptOnce && state.resendCalls === 1) return response({ error: 'db error' }, 500);
        Object.assign(state.delivery, JSON.parse(init.body));
        return response([state.delivery]);
      }
      return response(state.delivery ? [state.delivery] : []);
    }
    if (table === 'profiles') {
      state.profileReads++;
      if (options.expireBeforeSend && state.profileReads === 2) state.profile.pro_expires_at = '2000-01-01T00:00:00Z';
      return response([state.profile]);
    }
    if (table === 'job_preferences') return response([state.prefs]);
    if (table === 'public_jobs') return response(options.missingJob ? [] : [job]);
    if (table === 'jobs') return response([job]);
    throw new Error(`Unexpected request: ${url}`);
  };
  return state;
}

test('Pro eligibility matches confirmed DB rules and rejects invalid expiry or non-boolean opt-in', () => {
  assert.equal(eligible(profile, { email_strong_matches: true }), true);
  assert.equal(eligible({ ...profile, pro_expires_at: new Date(Date.now() + 60000).toISOString() }, { email_strong_matches: true }), true);
  for (const patch of [{ plan: 'free' }, { plan_status: 'inactive' }, { pro_expires_at: '2000-01-01' },
    { pro_expires_at: 'bad' }, { pro_expires_at: undefined }]) assert.equal(eligible({ ...profile, ...patch }, { email_strong_matches: true }), false);
  for (const value of [false, undefined, null, 'true', 1]) assert.equal(eligible(profile, { email_strong_matches: value }), false);
});

test('unauthorized, disabled, browser, wrong ID, wrong email and missing confirmation never fetch or send', async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; throw new Error('No network allowed'); };
  assert.equal((await handle(request(), { ...env, MANUAL_NOTIFICATION_TOKEN: undefined })).status, 503);
  assert.equal((await handle(request(), { ...env, MANUAL_STRONG_MATCH_IDS: '' })).status, 403);
  assert.equal((await handle(request('preview', {}, { headers: { authorization: 'Bearer wrong' } }), env)).status, 401);
  assert.equal((await handle(request('preview', {}, { headers: { origin: env.SITE_URL } }), env)).status, 403);
  for (const extra of [{ notification_id: 166 }, { expected_email: 'somebody@example.com' }, { confirm: '' }])
    assert.equal((await handle(request('send', extra), env)).status, 400);
  for (const method of ['GET', 'HEAD']) assert.equal((await handle(new Request(`${env.SITE_URL}/internal/strong-match/165`, { method }), env)).status, 405);
  assert.equal(calls, 0);
});

test('preview produces branded email with no ledger writes, notification updates or Resend calls', async () => {
  const state = mock(); const result = await handle(request(), env); const data = await result.json();
  assert.equal(result.status, 200); assert.equal(data.status, 'ready');
  assert.equal(data.payload.from, 'VeeAys Jobs <jobs@veeays.com>');
  assert.match(data.payload.text, /100% match/); assert.match(data.payload.text, /\$1,500–\$2,000\/month/);
  assert.equal(state.resendCalls, 0); assert.equal(state.delivery, null);
  assert.ok(state.requests.every(r => r.method === 'GET'));
});

test('acceptance is persisted before notified_at, and repeated send is a no-op', async () => {
  const state = mock(); let result = await handle(request('send'), env);
  assert.equal(result.status, 200); assert.equal((await result.json()).status, 'accepted_and_notified');
  assert.ok(state.notification.notified_at); assert.equal(state.profileReads, 2);
  result = await handle(request('send'), env);
  assert.equal((await result.json()).status, 'not_pending'); assert.equal(state.resendCalls, 1);
});

test('free, inactive, expired, opted out, wrong recipient and removed job do not send', async () => {
  for (const options of [{ profile: { plan: 'free' } }, { profile: { plan_status: 'inactive' } },
    { profile: { pro_expires_at: '2000-01-01' } }, { prefs: { email_strong_matches: false } },
    { recipientEmail: 'someone@example.com' }, { missingJob: true }]) {
    const state = mock(options); assert.equal((await handle(request('send'), env)).status, 409);
    assert.equal(state.resendCalls, 0); assert.equal(state.notification.notified_at, null);
  }
});

test('expiry is rechecked at send time after reservation', async () => {
  const state = mock({ expireBeforeSend: true });
  assert.equal((await handle(request('send'), env)).status, 409);
  assert.ok(state.delivery); assert.equal(state.resendCalls, 0); assert.equal(state.notification.notified_at, null);
});

test('daily digest and already-notified records are skipped', async () => {
  for (const notification of [{ notification_type: 'daily_digest' }, { notified_at: '2026-01-01' }]) {
    const state = mock({ notification });
    assert.equal((await (await handle(request('send'), env)).json()).status, 'not_pending');
    assert.equal(state.resendCalls, 0);
  }
});

test('Resend rejection leaves notification pending and response hides provider details', async () => {
  const state = mock({ resendStatus: 429 }); const result = await handle(request('send'), env);
  assert.equal(result.status, 502); assert.equal(state.notification.notified_at, null);
  assert.doesNotMatch(await result.text(), /provider private error|sb_secret|re_fake/);
});

test('unknown timeout retries frozen payload with identical idempotency key', async () => {
  const state = mock({ timeoutOnce: true });
  assert.equal((await handle(request('send'), env)).status, 502);
  assert.equal(state.notification.notified_at, null);
  assert.equal((await handle(request('send'), env)).status, 200);
  assert.equal(state.resendCalls, 2); assert.equal(state.acceptedEmails, 1);
  const sent = state.requests.filter(r => r.url.hostname === 'api.resend.com');
  assert.equal(sent[0].body, sent[1].body);
});

test('acknowledgement failure recovers using durable receipt without resending', async () => {
  const state = mock({ failAck: true });
  const failed = await handle(request('send'), env); assert.equal(failed.status, 502);
  assert.equal((await failed.json()).resend_accepted, true);
  assert.equal(state.notification.notified_at, null); assert.ok(state.delivery.resend_id);
  state.failAck = false;
  assert.equal((await (await handle(request('send'), env)).json()).status, 'acknowledged_existing_acceptance');
  assert.equal(state.resendCalls, 1);
});

test('receipt write failure recovers by replaying frozen provider request', async () => {
  const state = mock({ failReceiptOnce: true });
  assert.equal((await handle(request('send'), env)).status, 502);
  assert.equal(state.notification.notified_at, null); assert.equal(state.delivery.resend_id, null);
  assert.equal((await handle(request('send'), env)).status, 200);
  assert.equal(state.acceptedEmails, 1);
});

test('unresolved attempts beyond 23 hours and payload changes require manual review', async () => {
  const state = mock({ resendStatus: 503 });
  await handle(request('send'), env);
  state.delivery.created_at = new Date(Date.now() - 24 * 3600000).toISOString();
  assert.equal((await handle(request('send'), env)).status, 409);
  assert.equal(state.resendCalls, 1);
  state.delivery.created_at = new Date().toISOString(); state.profile.full_name = 'Changed';
  assert.equal((await handle(request('send'), env)).status, 409);
  assert.equal(state.resendCalls, 1);
});

test('concurrent ledger reservation loser sends nothing', async () => {
  const state = mock({ concurrentReservation: true });
  assert.equal((await handle(request('send'), env)).status, 409);
  assert.equal(state.resendCalls, 0); assert.equal(state.notification.notified_at, null);
});

test('general processor can handle another explicitly allowlisted ID', async () => {
  const state = mock({ notification: { id: 166 } });
  const req = new Request(`${env.SITE_URL}/internal/strong-match/166`, { method: 'POST',
    headers: { authorization: `Bearer ${env.MANUAL_NOTIFICATION_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'send', notification_id: 166, expected_email: env.STRONG_MATCH_TEST_EMAIL, confirm: 'SEND_166' }) });
  assert.equal((await handle(req.clone(), env)).status, 403);
  assert.equal((await handle(req, { ...env, MANUAL_STRONG_MATCH_IDS: '166' })).status, 200);
  assert.ok(state.notification.notified_at);
});

test('email escapes database text and omits absent fields', () => {
  const result = messageFor({ site: env.SITE_URL }, {}, { id: 101, title: '<img src=x onerror=alert(1)>' },
    { email: env.STRONG_MATCH_TEST_EMAIL, profile: { full_name: '<script>bad</script>' } });
  assert.doesNotMatch(result.html, /<script>|<img src=x|undefined|null|\/month/);
  assert.match(result.html, /&lt;img/); assert.match(result.html, /&lt;script&gt;/);
});
