import { sessionForRequest, setSessionCookies } from './auth.js';
import { layout, esc } from './render.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const resourceId = (value, prefix) => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]{1,100}$`).test(value);
const fail = (code, status = 422) => { throw Object.assign(new Error(code), { status }); };
const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export function testUserAllowed(env, userId) {
  return env.PAYMONGO_MODE === 'test' && String(env.PAYMONGO_TEST_USER_IDS || '').split(',').map(x => x.trim()).filter(x => UUID.test(x)).includes(userId);
}
function configuration(env) {
  const secret = env.PAYMONGO_TEST_SECRET_KEY;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (env.PAYMONGO_MODE !== 'test' || !/^sk_test_[A-Za-z0-9]+$/.test(secret || '') ||
      !env.PAYMONGO_TEST_WEBHOOK_SECRET || !key || !(key.startsWith('sb_secret_') || key.startsWith('eyJ')))
    fail('Test checkout is not configured.', 503);
  const db = new URL(env.SUPABASE_URL), site = new URL(env.SITE_URL);
  if (db.protocol !== 'https:' || site.protocol !== 'https:' || db.username || db.password || site.username || site.password)
    fail('Invalid test checkout configuration.', 503);
  return { secret, key, db, site: site.origin };
}
async function rest(c, path, init = {}) {
  const response = await fetch(new URL(`/rest/v1/${path}`, c.db), { ...init,
    headers: { apikey: c.key, ...(!c.key.startsWith('sb_secret_') ? { Authorization: `Bearer ${c.key}` } : {}),
      'content-type': 'application/json', ...init.headers }, signal: AbortSignal.timeout(6000) });
  if (!response.ok) {
    let errorCode = 'unknown';
    try {
      const payload = await response.json();
      if (/^[A-Za-z0-9_]{1,40}$/.test(String(payload?.code || ''))) errorCode = payload.code;
    } catch {}
    console.error('TEST payment storage failed', JSON.stringify({status: response.status, code: errorCode}));
    fail('Payment storage unavailable.', 503);
  }
  const responseText = await response.text();
  return responseText.trim() ? JSON.parse(responseText) : null;
}
async function paymongo(c, path, attributes) {
  console.info('TEST PayMongo request started', JSON.stringify({method: attributes ? 'POST' : 'GET'}));
  const response = await fetch(`https://api.paymongo.com/${path}`, {
    method: attributes ? 'POST' : 'GET', redirect: 'manual',
    headers: { Authorization: `Basic ${btoa(c.secret + ':')}`, 'content-type': 'application/json' },
    ...(attributes ? { body: JSON.stringify({ data: { attributes } }) } : {}), signal: AbortSignal.timeout(6000) });
  console.info('TEST PayMongo response received', JSON.stringify({status: response.status}));
  if (!response.ok) {
    let codes = [];
    try {
      const payload = await response.json();
      codes = (Array.isArray(payload?.errors) ? payload.errors : []).map(e => String(e.code || '')).filter(code => /^[A-Za-z0-9_]{1,60}$/.test(code));
    } catch {}
    console.error('TEST PayMongo request failed', JSON.stringify({status: response.status, codes}));
    fail('PayMongo test service unavailable.', 503);
  }
  const body = await response.json();
  console.info('TEST PayMongo response shape', JSON.stringify({hasData: !!body?.data, hasAttributes: !!body?.data?.attributes, hasCheckoutUrl: typeof body?.data?.attributes?.checkout_url === 'string'}));
  return body.data;
}
async function row(c, id, userId) {
  const rows = await rest(c, `pro_test_payments?id=eq.${id}${userId ? `&user_id=eq.${encodeURIComponent(userId)}` : ''}&select=*&limit=1`);
  return rows?.[0] || null;
}

export async function verifySignature(raw, header, secret, now = Date.now()) {
  const parts = (header || '').split(',').map(x => x.trim().split('='));
  if (parts.some(x => x.length !== 2) || new Set(parts.map(x => x[0])).size !== parts.length) return false;
  const values = Object.fromEntries(parts);
  if (!/^\d{1,12}$/.test(values.t || '') || !/^[a-f0-9]{64}$/i.test(values.te || '') || values.li ||
      Math.abs(now / 1000 - Number(values.t)) > 300) return false;
  const bytes = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', bytes.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signature = Uint8Array.from(values.te.match(/../g), x => parseInt(x, 16));
  return crypto.subtle.verify('HMAC', key, signature, bytes.encode(`${values.t}.${raw}`));
}

export function confirmedPayment(session, record, now = Date.now()) {
  const a = session?.attributes;
  if (!resourceId(session?.id, 'cs') || session.type !== 'checkout_session' || a?.livemode !== false ||
      session.id !== record.checkout_id || a.reference_number !== record.id || record.amount !== 49900 || record.currency !== 'PHP')
    fail('Checkout ownership or mode mismatch.');
  const items = a.line_items;
  if (!Array.isArray(items) || items.length !== 1 || items[0].amount !== 49900 || items[0].currency !== 'PHP' || items[0].quantity !== 1)
    fail('Invalid checkout amount or currency.');
  const paid = (a.payments || []).filter(p => p?.attributes?.status === 'paid');
  if (paid.length !== 1) fail('Checkout has no unique successful payment.');
  const p = paid[0], v = p.attributes;
  if (!resourceId(p.id, 'pay') || v.livemode !== false || v.amount !== 49900 || v.currency !== 'PHP' ||
      v.source?.type !== 'qrph' || v.disputed === true || (v.refunds || []).length ||
      !Number.isInteger(v.paid_at) || v.paid_at <= 0 || v.paid_at * 1000 > now + 300000 ||
      v.paid_at * 1000 < Date.parse(record.created_at) - 300000)
    fail('Invalid successful payment.');
  return { id: p.id, paidAt: new Date(v.paid_at * 1000).toISOString() };
}

async function webhook(request, env, c) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (Number(request.headers.get('content-length')) > 131072) return json({ error: 'Payload too large' }, 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 131072) return json({ error: 'Payload too large' }, 413);
  if (!await verifySignature(raw, request.headers.get('paymongo-signature'), env.PAYMONGO_TEST_WEBHOOK_SECRET))
    return json({ error: 'Invalid test signature' }, 400);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON' }, 400); }
  // PayMongo documents both the classic event resource and the newer send.webhook envelope.
  const envelope = body?.data;
  const event = envelope?.type === 'event' ? envelope.attributes : envelope;
  if (event?.livemode !== false) fail('Only test events are accepted.');
  if (event.type !== 'checkout_session.payment.paid') return json({ ignored: true });
  const incoming = event.data;
  const id = incoming?.attributes?.reference_number;
  if (!UUID.test(id || '')) fail('Unknown payment reference.');
  const record = await row(c, id);
  if (!record || !testUserAllowed(env, record.user_id)) fail('Unknown or unauthorized test checkout.');
  if (incoming.id !== record.checkout_id) fail('Checkout ownership mismatch.');
  // Fetch the merchant-owned resource with the test secret. Synthetic dashboard events
  // and browser returns cannot stand in for an actual successful test payment.
  const authoritative = await paymongo(c, `v1/checkout_sessions/${encodeURIComponent(record.checkout_id)}`);
  const payment = confirmedPayment(authoritative, record);
  const outcome = await rest(c, 'rpc/accept_pro_test_payment', { method: 'POST', body: JSON.stringify({
    p_id: record.id, p_checkout_id: record.checkout_id, p_payment_id: payment.id,
    p_event_id: resourceId(envelope.id, 'evt') ? envelope.id : null,
    p_amount: 49900, p_currency: 'PHP', p_state: 'paid', p_livemode: false, p_paid_at: payment.paidAt
  }) });
  return json({ received: true, outcome });
}

export async function proCheckoutEndpoint(request, env) {
  const url = new URL(request.url);
  try {
    if (url.pathname === '/webhooks/paymongo') return await webhook(request, env, configuration(env));
    const state = await sessionForRequest(request, env);
    if (!state.user || !state.accessToken) return json({ error: 'Log in to continue.' }, 401);
    if (!testUserAllowed(env, state.user.id)) return json({ error: 'Test checkout is unavailable for this account.' }, 403);
    const c = configuration(env);
    if (url.pathname === '/pro/checkout') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      if (request.headers.get('origin') !== c.site || url.origin !== c.site) return json({ error: 'Forbidden' }, 403);
      const id = crypto.randomUUID();
      await rest(c, 'pro_test_payments', { method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ id, user_id: state.user.id, amount: 49900, currency: 'PHP', status: 'creating' }) });
      // Never accept amount, user, reference, plan or redirect URLs from the browser.
      let session;
      try {
        session = await paymongo(c, 'v2/checkout_sessions', {
          line_items: [{ name: 'VeeAys Pro — 30 days (TEST)', amount: 49900, currency: 'PHP', quantity: 1 }],
          payment_method_types: ['qrph'], reference_number: id, pass_on_fees: false,
          success_url: `${c.site}/pro/return?payment=${id}`, cancel_url: `${c.site}/pro/return?payment=${id}&cancelled=1`
        });
        if (typeof session?.attributes?.checkout_url !== 'string') fail('Invalid test checkout response.', 503);
        const checkoutUrl = new URL(session.attributes.checkout_url);
        if (!resourceId(session?.id, 'cs') || session?.attributes?.livemode !== false || checkoutUrl.protocol !== 'https:' ||
            checkoutUrl.hostname !== 'checkout.paymongo.com' || checkoutUrl.username || checkoutUrl.password || checkoutUrl.port)
          fail('Invalid test checkout response.', 503);
        await rest(c, `pro_test_payments?id=eq.${id}&status=eq.creating`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ checkout_id: session.id, checkout_url: checkoutUrl.href, status: 'pending', updated_at: new Date().toISOString() }) });
        const h = new Headers({ location: checkoutUrl.href, 'cache-control': 'no-store' });
        if (state.refreshed) setSessionCookies(h, state.refreshed);
        return new Response(null, { status: 303, headers: h });
      } catch (error) {
        // No automatic provider retry: a timeout may already have created a session.
        await rest(c, `pro_test_payments?id=eq.${id}&status=eq.creating`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'creation_failed', updated_at: new Date().toISOString() }) });
        throw error;
      }
    }
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    const id = url.searchParams.get('payment');
    if (!UUID.test(id || '')) return json({ error: 'Invalid payment reference' }, 400);
    const record = await row(c, id, state.user.id);
    if (!record) return json({ error: 'Payment not found' }, 404);
    const confirmed = record.status === 'confirmed';
    const text = confirmed ? (record.entitlement_outcome === 'unlimited_preserved'
      ? 'Test payment confirmed. Your existing unlimited Pro access is preserved.'
      : `Test payment confirmed. Your Pro access runs through ${record.entitlement_expires_at}.`)
      : record.status === 'creation_failed' ? 'The test checkout could not be created. Return to Pro to try again.'
      : 'Payment confirmation is pending. Returning here does not activate Pro. Refresh this page after PayMongo confirms the test payment.';
    const h = new Headers({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow',
      'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
      'content-security-policy': "default-src 'none'; style-src 'self'; img-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" });
    if (state.refreshed) setSessionCookies(h, state.refreshed);
    return new Response(layout({ title: 'Pro test payment', canonical: c.site + '/pro/return', description: 'Check the status of your VeeAys Pro test payment.', user: state.user, noindex: true,
      body: `<section class="wrap"><div class="kicker">VEEAYS PRO · TEST MODE</div><h1>${confirmed ? 'Payment confirmed' : 'Checking your payment'}</h1><p role="status">${esc(text)}</p><p>No real money is charged. This is a one-time 30-day test purchase.</p><a class="button" href="/pro/return?payment=${id}">Refresh payment status</a> <a href="/pro">Back to Pro</a></section>` }), { headers: h });
  } catch (error) {
    // Log only a safe error classification, never messages or raw payloads.
    const errorName = /^[A-Za-z]{1,40}$/.test(String(error?.name || '')) ? error.name : 'UnknownError';
    const errorText = String(error?.message || '').toLowerCase();
    const category = errorText.includes('redirect') ? 'redirect' : errorText.includes('header') ? 'header' : errorText.includes('url') ? 'url' : errorText.includes('fetch') ? 'fetch' : errorText.includes('network') ? 'network' : errorText.includes('timeout') ? 'timeout' : 'unclassified';
    console.error('TEST checkout failed', JSON.stringify({type: errorName, category, status: Number(error?.status) || 503}));
    return json({ error: error.status ? error.message : 'Test payment service unavailable. Please try again later.' }, error.status || 503);
  }
}





