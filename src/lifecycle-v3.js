import { templates } from './lifecycle-v3-templates.js';

const STAGING_DB = 'https://megedmsfdwtjxjejrxaq.supabase.co';
const STAGING_ORIGIN = 'https://veeays-member-emails-staging.gm-realcommph.workers.dev';
const FAKE_RECIPIENT = 'delivered@resend.dev';
const SLOT = '{{{UNSUBSCRIBE_URL}}}';
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stagingTarget(env) {
  return [STAGING_DB, STAGING_DB + '/'].includes(env.SUPABASE_URL)
    && [STAGING_ORIGIN, STAGING_ORIGIN + '/'].includes(env.SITE_URL)
    && !!env.SUPABASE_SERVICE_ROLE_KEY;
}

async function rpc(env, name, args) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${STAGING_DB}/rest/v1/rpc/${name}`, {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(12_000),
    headers: {
      apikey: key,
      ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  if (!response.ok) throw new Error('staging_database_unavailable');
  return response.json();
}

export async function runLifecycleV3(env, { call = rpc, request = fetch } = {}) {
  if (env.LIFECYCLE_MODE !== 'staging-v3') return { status: 'disabled' };

  const dailyCap = Number(env.LIFECYCLE_DAILY_CAP);
  const monthlyCap = Number(env.LIFECYCLE_MONTHLY_CAP);
  if (!stagingTarget(env) || env.LIFECYCLE_TEST_EMAIL !== FAKE_RECIPIENT || !env.RESEND_API_KEY
      || !Number.isSafeInteger(dailyCap) || dailyCap < 1
      || !Number.isSafeInteger(monthlyCap) || monthlyCap < dailyCap) {
    return { status: 'configuration_blocked' };
  }

  const lease = crypto.randomUUID();
  const claim = await call(env, 'claim_member_email_v3', { p_token: lease });
  if (!claim) return { status: 'idle' };
  const args = { p_id: claim.id, p_token: lease };
  let started = false;
  try {
    const candidate = await call(env, 'check_member_email_v3', args);
    const template = candidate && Object.hasOwn(templates, claim.step)
      && ['free', 'pro'].includes(candidate.variant) && templates[claim.step][candidate.variant];
    if (!template || candidate.email !== FAKE_RECIPIENT || !TOKEN.test(candidate.token)) {
      await call(env, 'defer_member_email', args);
      return { status: 'ineligible' };
    }

    const unsubscribe = `${STAGING_ORIGIN}/member-emails/unsubscribe?token=${candidate.token}`;
    const payload = {
      from: 'VeeAys <jobs@veeays.com>',
      reply_to: 'support@veeays.com',
      to: [FAKE_RECIPIENT],
      subject: template.subject,
      html: template.html.replace(SLOT, unsubscribe),
      text: template.text.replace(SLOT, unsubscribe),
      headers: {
        'List-Unsubscribe': `<${unsubscribe}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    };
    if (await call(env, 'start_member_email_v3', {
      ...args, p_variant: candidate.variant, p_daily_cap: dailyCap, p_monthly_cap: monthlyCap, p_payload: payload
    }) !== true) {
      await call(env, 'defer_member_email', args);
      return { status: 'deferred' };
    }
    started = true;
    const result = await request('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `veeays-member-email-${claim.id}`
      },
      body: JSON.stringify(payload)
    });
    if (!result.ok) throw new Error('provider_unknown');
    const receipt = await result.json();
    if (typeof receipt?.id !== 'string' || !receipt.id
        || await call(env, 'finish_member_email', { ...args, p_provider: receipt.id }) !== true) {
      throw new Error('settlement_unknown');
    }
    return { status: 'accepted' };
  } catch {
    await call(env, 'hold_member_email', { ...args, p_code: started ? 'ambiguous_after_start' : 'eligibility_or_preflight' });
    return { status: 'held' };
  }
}

export async function scheduledLifecycleV3(env) {
  let result;
  try { result = await runLifecycleV3(env); } catch { result = { status: 'unavailable' }; }
  console.info(JSON.stringify({ event: 'member_email_sequence_v3', ...result }));
}

export async function lifecycleV3Unsubscribe(request, env, { call = rpc } = {}) {
  const url = new URL(request.url);
  const headers = {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'Content-Type': 'text/plain; charset=utf-8'
  };
  if (!stagingTarget(env) || url.origin !== STAGING_ORIGIN) {
    return new Response('Not found', { status: 404, headers });
  }
  const token = url.searchParams.get('token') || '';
  if (!TOKEN.test(token)) return new Response('Invalid link', { status: 400, headers });
  if (request.method === 'GET') {
    // Link scanners may follow GET. Only an intentional form or one-click POST changes consent.
    return new Response(`<!doctype html><meta charset="utf-8"><title>Unsubscribe from VeeAys emails</title>
      <h1>Unsubscribe from optional VeeAys emails</h1>
      <form method="post"><button name="List-Unsubscribe" value="One-Click">Unsubscribe</button></form>`,
      { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'" } });
  }
  if (request.method !== 'POST') return new Response('Method not allowed', {
    status: 405, headers: { ...headers, Allow: 'GET, POST' }
  });
  let form;
  try { form = await request.formData(); } catch {
    return new Response('Invalid request', { status: 400, headers });
  }
  if (form.get('List-Unsubscribe') !== 'One-Click') {
    return new Response('Invalid request', { status: 400, headers });
  }
  try {
    if (await call(env, 'unsubscribe_member_email', { p_token: token }) === true) {
      return new Response('You are unsubscribed.', { headers });
    }
  } catch {
    // A temporary database failure uses the same retry response as an active send.
  }
  return new Response('Please retry shortly.', { status: 503, headers: { ...headers, 'Retry-After': '120' } });
}
