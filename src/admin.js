import { sessionForRequest, setSessionCookies, clearSessionCookies } from './auth.js';
import { config } from './data.js';

const privateHeaders = {
  'cache-control': 'private, no-store', 'vary': 'Cookie', 'x-robots-tag': 'noindex, nofollow',
  'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
export function period(params, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const end = params.get('end') || today;
  const days = Number(params.get('days') || 7);
  if (!params.has('start') && ![1,7,30,90].includes(days)) throw new Error('Choose 1, 7, 30 or 90 days.');
  const start = params.get('start') || new Date(Date.parse(end+'T00:00:00Z')-(days-1)*86400000).toISOString().slice(0,10);
  for (const date of [start,end]) if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) throw new Error('Choose valid dates.');
  const span = (Date.parse(end)-Date.parse(start))/86400000;
  if (span<0 || span>90 || end>today) throw new Error('Choose a period up to 91 days ending today or earlier.');
  return {p_start:start,p_end:end};
}
async function rpc(env, token, name, body) {
  const {key,url} = config(env);
  const response = await fetch(new URL('/rest/v1/rpc/'+name,url),{
    method:'POST', headers:{apikey:key,Authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(12000)
  });
  if(!response.ok) throw Object.assign(new Error('Analytics unavailable'),{status:response.status});
  return response.json();
}
export async function adminEndpoint(request, env, {session=sessionForRequest, call=rpc}={}) {
  const url=new URL(request.url), api=url.pathname==='/admin/api/analytics';
  const headers=new Headers(privateHeaders);
  const reply=(body,status,type='text/html; charset=utf-8')=>{
    headers.set('content-type',type);
    return new Response(body,{status,headers});
  };
  if(!['/admin','/admin/','/admin/api/analytics'].includes(url.pathname)) return reply('Not found',404);
  if(request.method!=='GET') {headers.set('allow','GET'); return reply('Method not allowed',405);}
  try {
    const state=await session(request,env);
    if(state.refreshed && typeof state.refreshed==='object') setSessionCookies(headers,state.refreshed);
    else if(state.refreshed===false) clearSessionCookies(headers);
    if(!state.user || !state.accessToken) {
      if(api) return reply(JSON.stringify({error:'Please sign in again.'}),401,'application/json');
      headers.set('location','/login?return=%2Fadmin');
      return reply('',303);
    }
    if(await call(env,state.accessToken,'veeays_admin_access',{})!==true)
      return reply(api ? JSON.stringify({error:'Admin access required.'}) : '<h1>Admin access required</h1><p>This account does not have dashboard access.</p><a href="/">Back to VeeAys</a>',403,api?'application/json':'text/html; charset=utf-8');
    if(api) {
      let dates;
      try {dates=period(url.searchParams);} catch(error) {return reply(JSON.stringify({error:error.message}),400,'application/json');}
      const data=await call(env,state.accessToken,'veeays_admin_analytics',dates);
      data.runtime={quick_read_enabled:env.QUICK_READ_AUTO_ENABLED==='true',payment_mode:env.PAYMONGO_MODE || 'not configured'};
      return reply(JSON.stringify(data),200,'application/json');
    }
    return reply(adminPage(),200);
  } catch(error) {
    const status=[401,403].includes(error.status)?error.status:503;
    return reply(api?JSON.stringify({error:status===503?'Analytics are temporarily unavailable. Please retry.':'Admin access required.'}):'<h1>Dashboard temporarily unavailable</h1><p>Please refresh to retry.</p>',status,api?'application/json':'text/html; charset=utf-8');
  }
}
export function adminPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VeeAys · Admin</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/admin.css"><script src="/admin.js" defer></script></head>
<body><aside><a href="/"><img src="/veeays-logo.png" alt="VeeAys" width="150"></a><span class="badge">PRIVATE ADMIN</span><nav><a href="#overview">Overview</a><a href="#trends">Trends</a><a href="#operations">Quick Reads</a><a href="#imports">Import health</a><a href="#payments">Payments</a></nav><p>Production analytics<br>Read-only access</p><a href="/">↗ View job board</a></aside>
<main><header><div><p class="eyebrow">VEEAYS / OPERATIONS</p><h1>Your business, at a glance.</h1><p>Members, jobs and operations — from real production records.</p></div><span class="badge">Production</span></header>
<form id="filters"><label>Period<select id="period" name="period"><option value="1">Today</option><option value="7" selected>Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="custom">Custom dates</option></select></label><label>From<input type="date" id="start" required></label><label>Through<input type="date" id="end" required></label><button type="submit">Refresh data</button><span>Asia/Manila</span></form>
<p id="status" role="status" aria-live="polite">Loading production metrics…</p><div id="dashboard" aria-busy="true">
<section id="overview" class="cards"></section>
<section id="trends"><div class="section-heading"><h2>Daily trends</h2><p>Selected period · Manila dates</p></div><div class="charts" id="charts"></div></section>
<section id="operations"><div class="section-heading"><h2>Quick Read operations</h2><p>Current state and selected-period results</p></div><div id="quick" class="panels"></div><article><h3>Recent errors in period</h3><div id="errors" class="table-wrap"></div></article></section>
<section id="imports"><div class="section-heading"><h2>Import health</h2><p>Freshness inferred from job records</p></div><article><p>No importer run log is connected. A recent collection timestamp confirms data arrival; it does not prove every import succeeded. Sources over 24 hours old are marked for review.</p><div id="import-table" class="table-wrap"></div></article></section>
<section id="payments"><div class="section-heading"><h2>Payment events</h2><p>Checkout records created in the selected period</p></div><article><p>Live confirmed payments contribute to revenue on their paid date. Test payments are excluded. Pro access includes grants and purchases; it is not a recurring subscriber count.</p><div id="payment-table" class="table-wrap"></div></article></section>
<footer>Visitor analytics and recurring-subscription tracking are not connected. Quick Read reservations are budget holds, not actual provider spend. Historical queue/error transitions are not stored; the dashboard reports current records.</footer>
</div></main></body></html>`;
}
