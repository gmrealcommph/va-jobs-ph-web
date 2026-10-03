// Deliberately manual and restricted to runtime-allowlisted notifications.
// No scheduled handler, background work, or browser-accessible credentials.

const RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});
class ControlledError extends Error {
  constructor(code, status = 409) { super(code); this.status = status; }
}
const stop = (code, status) => { throw new ControlledError(code, status); };
const email = value => String(value || '').trim().toLowerCase();
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

async function tokenMatches(actual, expected) {
  const encoder = new TextEncoder();
  const digest = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(s)));
  const a = await digest(actual), b = await digest(expected);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function configuration(env) {
  const url = new URL(env.SUPABASE_URL);
  const site = new URL(env.SITE_URL);
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (url.protocol !== 'https:' || site.protocol !== 'https:' || site.username || site.password ||
      !key || !env.RESEND_API_KEY || !env.STRONG_MATCH_TEST_EMAIL) stop('missing_or_invalid_runtime_configuration', 503);
  const modernKey = key.startsWith('sb_secret_');
  if (!modernKey && !key.startsWith('eyJ')) stop('invalid_supabase_server_key', 503);
  return { url, site: site.origin, key, modernKey,
    testEmail: email(env.STRONG_MATCH_TEST_EMAIL) };
}

async function rest(config, table, filters = {}, init = {}) {
  const endpoint = new URL(`/rest/v1/${table}`, config.url);
  for (const [name, value] of Object.entries(filters)) endpoint.searchParams.set(name, value);
  const response = await fetch(endpoint, {
    ...init, headers: { apikey: config.key,
      // Modern sb_secret keys are not JWTs. Legacy service_role JWTs need Bearer.
      ...(!config.modernKey ? { Authorization: `Bearer ${config.key}` } : {}),
      'content-type': 'application/json', ...init.headers }, signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) stop(`supabase_${table}_${response.status}`, 502);
  if (response.status === 204) return null;
  try { return await response.json(); } catch { stop(`invalid_${table}_response`, 502); }
}

async function one(config, table, filters) {
  const rows = await rest(config, table, { ...filters, select: '*', limit: '2' });
  if (!Array.isArray(rows) || rows.length > 1) stop(`ambiguous_${table}_record`, 502);
  return rows[0] || null;
}

export function eligible(profile, preferences, now = Date.now()) {
  // Database entitlement: null expiry means no expiration.
  const expiry = profile?.pro_expires_at ? Date.parse(profile.pro_expires_at) : NaN;
  return profile?.plan === 'pro' && profile?.plan_status === 'active' &&
    (profile.pro_expires_at === null || (Number.isFinite(expiry) && expiry > now)) && preferences?.email_strong_matches === true;
}

async function recipient(config, userId) {
  if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) stop('invalid_notification_user_id');
  const profile = await one(config, 'profiles', { id: `eq.${userId}` });
  const preferences = await one(config, 'job_preferences', { user_id: `eq.${userId}` });
  if (!preferences || !Object.hasOwn(preferences, 'email_strong_matches')) stop('email_preference_schema_unverified');
  if (!eligible(profile, preferences)) stop('recipient_not_eligible');
  const endpoint = new URL(`/auth/v1/admin/users/${userId}`, config.url);
  const response = await fetch(endpoint, { headers: { apikey: config.key,
    ...(!config.modernKey ? { Authorization: `Bearer ${config.key}` } : {}) }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) stop(`supabase_auth_${response.status}`, 502);
  const user = await response.json();
  if (user.id !== userId || !user.email_confirmed_at || user.deleted_at ||
      (user.banned_until && Date.parse(user.banned_until) > Date.now()) || email(user.email) !== config.testEmail) stop('recipient_not_confirmed_test_address');
  if (!eligible(profile, preferences)) stop('recipient_not_eligible');
  return { profile, email: email(user.email) };
}

export function messageFor(config, notification, job, person) {
  const title = String(job.title || 'Job opportunity').replace(/[\r\n]/g, ' ').slice(0, 200);
  const scoreValue = notification.match_score;
  const score = typeof scoreValue === 'number' && Number.isFinite(scoreValue) && scoreValue >= 0 && scoreValue <= 100 ? `${scoreValue}% match` : '';
  const amount = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value.toLocaleString('en-US') : '';
  const min = amount(job.salary_min_usd), max = amount(job.salary_max_usd);
  const periods = { monthly: 'month', yearly: 'year', annually: 'year', hourly: 'hour', weekly: 'week' };
  const salary = (min || max) && periods[job.salary_period] ?
    `${min ? '$' + min : 'Up to $' + max}${min && max && min !== max ? '–$' + max : ''}/${periods[job.salary_period]}` : '';
  const meta = [job.location, job.employment_type?.replaceAll('_', ' '), salary, job.schedule_region].filter(v => typeof v === 'string' && v.trim());
  const link = `${config.site}/jobs/${encodeURIComponent(job.id)}`;
  const matches = `${config.site}/matches`;
  const greeting = person.profile.full_name ? `Hi ${person.profile.full_name},` : 'Hello,';
  const text = [greeting, 'You have a strong job match on VeeAys.', score, title, job.company, ...meta,
    `View job: ${link}`, `My Matches: ${matches}`, 'You received this because Strong Match Alerts are enabled for your VeeAys Pro account.'].filter(Boolean).join('\n\n');
  const html = `<!doctype html><html><body style="margin:0;background:#f6f4ef;color:#162c24;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:32px 16px"><table role="presentation" align="center" width="100%" style="max-width:580px;background:white;border-radius:16px" cellpadding="28"><tr><td><a href="${escape(config.site)}" style="color:#162c24;font-size:28px;font-weight:bold;text-decoration:none">VeeAys</a><p style="color:#58705c">STRONG MATCH ALERT</p><p>${escape(greeting)}</p><p>A new opportunity fits your preferences.</p>${score ? `<p style="color:#24704b;font-size:24px;font-weight:bold">${escape(score)}</p>` : ''}<h1 style="font-size:24px">${escape(title)}</h1>${job.company ? `<p><strong>${escape(job.company)}</strong></p>` : ''}${meta.map(v => `<p>${escape(v)}</p>`).join('')}<p style="padding:20px 0"><a href="${escape(link)}" style="background:#163f2c;color:white;padding:14px 22px;border-radius:8px;text-decoration:none">View this job →</a></p><p><a href="${escape(matches)}" style="color:#24704b">View My Matches</a></p><p style="font-size:12px;color:#647469">You received this because Strong Match Alerts are enabled for your VeeAys Pro account.</p></td></tr></table></td></tr></table></body></html>`;
  return { from: 'VeeAys Jobs <jobs@veeays.com>', to: [person.email], subject: `Your VeeAys strong match: ${title}`, html, text };
}

async function pending(config, notificationId) {
  const notification = await one(config, 'job_match_notifications', { id: `eq.${notificationId}`, notification_type: 'eq.strong_match', notified_at: 'is.null' });
  if (!notification) return null;
  const types = [notification.notification_type];
  if (!types.length || types.some(v => v !== 'strong_match')) stop('notification_not_strong_match');
  if (!/^\d+$/.test(String(notification.job_id))) stop('invalid_notification_job_id');
  return notification;
}

async function acknowledge(config, notificationId) {
  const rows = await rest(config, 'job_match_notifications', { id: `eq.${notificationId}`, notification_type: 'eq.strong_match', notified_at: 'is.null' }, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ notified_at: new Date().toISOString() })
  });
  if (!Array.isArray(rows)) stop('invalid_notification_acknowledgement', 502);
  if (rows.length === 1 && rows[0].notified_at) return;
  const current = await one(config, 'job_match_notifications', { id: `eq.${notificationId}` });
  if (!current?.notified_at) stop('notification_acknowledgement_failed', 502);
}

export async function manualNotification(request, env, notificationId) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST', 'cache-control': 'no-store' } });
  if (request.headers.has('origin')) return json({ error: 'browser_origin_not_allowed' }, 403);
  const token = env.MANUAL_NOTIFICATION_TOKEN;
  if (typeof token !== 'string' || token.length < 32) return json({ error: 'manual_processor_disabled' }, 503);
  const authorization = request.headers.get('authorization') || '';
  if (authorization.length > 2048 || !await tokenMatches(authorization, `Bearer ${token}`)) return json({ error: 'unauthorized' }, 401);
  const allowedIds = String(env.MANUAL_STRONG_MATCH_IDS || '').split(',').map(v => v.trim()).filter(v => /^[1-9]\d{0,18}$/.test(v));
  if (!allowedIds.includes(notificationId)) return json({ error: 'notification_id_not_allowlisted' }, 403);
  let accepted = false;
  let resendId = null;
  try {
    if (!request.headers.get('content-type')?.startsWith('application/json')) stop('json_required', 400);
    const raw = await request.text();
    if (raw.length > 4096) stop('request_too_large', 413);
    let body;
    try { body = JSON.parse(raw); } catch { stop('invalid_json', 400); }
    if (!body || !['preview', 'send'].includes(body.action) || String(body.notification_id) !== notificationId) stop('notification_id_must_match_route', 400);
    const config = configuration(env);
    if (email(body.expected_email) !== config.testEmail) stop('expected_email_must_match_configured_test_address', 400);
    if (body.action === 'send' && body.confirm !== `SEND_${notificationId}`) stop('explicit_send_confirmation_required', 400);
    const notification = await pending(config, notificationId);
    if (!notification) return json({ status: 'not_pending', notification_id: notificationId });
    let delivery = await one(config, 'manual_strong_match_deliveries', { notification_id: `eq.${notificationId}` });
    if (delivery?.resend_id) {
      if (body.action === 'preview') return json({ status: 'accepted_needs_acknowledgement', notification_id: notificationId, resend_id: delivery.resend_id });
      accepted = true; resendId = delivery.resend_id;
      await acknowledge(config, notificationId);
      return json({ status: 'acknowledged_existing_acceptance', notification_id: notificationId, resend_id: resendId });
    }
    const jobId = String(notification.job_id);
    const publicJob = await one(config, 'public_jobs', { id: `eq.${jobId}` });
    if (!publicJob) stop('job_no_longer_public');
    const job = await one(config, 'jobs', { id: `eq.${jobId}` });
    if (!job) stop('job_data_missing');
    let person = await recipient(config, notification.user_id);
    const payload = messageFor(config, notification, { ...publicJob, ...job }, person);
    if (delivery && JSON.stringify(delivery.payload) !== JSON.stringify(payload)) {
      // JSONB key order is not stable: compare each top-level payload value.
      if (Object.keys(payload).some(k => JSON.stringify(delivery.payload?.[k]) !== JSON.stringify(payload[k])) || Object.keys(delivery.payload || {}).length !== Object.keys(payload).length)
        stop('frozen_delivery_payload_changed_manual_review_required');
    }
    if (delivery && (!Number.isFinite(Date.parse(delivery.created_at)) || Date.now() - Date.parse(delivery.created_at) >= RETRY_WINDOW_MS)) stop('retry_window_expired_manual_review_required');
    if (body.action === 'preview') return json({ status: 'ready', notification_id: notificationId, recipient: person.email,
      payload: delivery?.payload || payload, existing_attempt: Boolean(delivery) });
    if (!delivery) {
      const rows = await rest(config, 'manual_strong_match_deliveries', { on_conflict: 'notification_id' }, {
        method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify({ notification_id: notificationId, payload })
      });
      if (!Array.isArray(rows)) stop('invalid_delivery_reservation', 502);
      delivery = rows[0];
      // A concurrent invocation owns the frozen payload. Retry explicitly later.
      if (!delivery) stop('concurrent_attempt_retry_later');
    }
    // Fresh checks after reservation, immediately before the external side effect.
    const fresh = await pending(config, notificationId);
    if (!fresh) return json({ status: 'not_pending', notification_id: notificationId });
    if (fresh.user_id !== notification.user_id || String(fresh.job_id) !== jobId || fresh.match_score !== notification.match_score) stop('notification_changed');
    if (!await one(config, 'public_jobs', { id: `eq.${jobId}` })) stop('job_no_longer_public');
    person = await recipient(config, fresh.user_id);
    if (person.email !== delivery.payload.to[0]) stop('recipient_changed');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json',
        'Idempotency-Key': `veeays-strong-match-${config.url.hostname}-${notificationId}` },
      body: JSON.stringify(delivery.payload), signal: AbortSignal.timeout(15000)
    });
    let data;
    try { data = await response.json(); } catch { stop('resend_result_unknown_retry_same_request_within_23_hours', 502); }
    if (!response.ok || typeof data?.id !== 'string' || !data.id) stop(`resend_not_accepted_${response.status}`, 502);
    accepted = true; resendId = data.id;
    // Persist provider acceptance before acknowledging the original notification.
    await rest(config, 'manual_strong_match_deliveries', { notification_id: `eq.${notificationId}` }, {
      method: 'PATCH', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ resend_id: resendId, accepted_at: new Date().toISOString() })
    }).then(rows => { if (!Array.isArray(rows) || rows.length !== 1 || rows[0].resend_id !== resendId) stop('delivery_receipt_not_persisted', 502); });
    await acknowledge(config, notificationId);
    return json({ status: 'accepted_and_notified', notification_id: notificationId, resend_id: resendId });
  } catch (error) {
    // Never return upstream bodies, keys, raw exception messages or auth user data.
    return json({ error: error instanceof ControlledError ? error.message : 'processor_failed_or_result_unknown',
      notification_id: notificationId, resend_accepted: accepted, ...(resendId ? { resend_id: resendId } : {}),
      instruction: accepted ? 'Check Resend and the ledger; retry the same request to finish acknowledgement. Do not reset the ledger.' : 'Notification is not acknowledged by this attempt. Preview before retry; never reset an existing delivery record without reconciliation.'
    }, error instanceof ControlledError ? error.status : 502);
  }
}
