import { sessionForRequest, setSessionCookies, clearSessionCookies } from './auth.js';
import { config } from './data.js';
import { visitorAnalytics } from './admin-visitors.js';
import { cachedEmailUsage, actionCenter } from './admin-health.js';
import {providerBalances} from './admin-balances.js';
import {QUICK_READ_CRON} from './quick-read-scheduled.js';

export function quickReadSchedule(checkedAt){
  const now=Date.parse(checkedAt);
  if(QUICK_READ_CRON!=='0-59 * * * *'||!Number.isFinite(now))return {available:false};
  let next=Math.floor(now/60000)*60000+60000;
  return {available:true,cron:QUICK_READ_CRON,interval_seconds:60,next_expected_at:new Date(next).toISOString(),estimated:true};
}


const snapshots=new Map(),limits=new Map();
function permitted(userId,now=Date.now()){
  for(const [key,value] of limits)if(value.end<=now)limits.delete(key);
  const value=limits.get(userId)||{end:now+60000,count:0};
  if(limits.size>=500&&!limits.has(userId))return false;
  limits.set(userId,value);return ++value.count<=30;
}

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
export async function adminEndpoint(request, env, {session=sessionForRequest, call=rpc, visitors=visitorAnalytics, usage=cachedEmailUsage, balances=providerBalances}={}) {
  const url=new URL(request.url), monitor=url.pathname==='/admin/api/quick-reads', api=monitor||url.pathname==='/admin/api/analytics';
  const headers=new Headers(privateHeaders);
  const reply=(body,status,type='text/html; charset=utf-8')=>{
    headers.set('content-type',type);
    return new Response(body,{status,headers});
  };
  if(!['/admin','/admin/','/admin/api/analytics','/admin/api/quick-reads'].includes(url.pathname)) return reply('Not found',404);
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
      if(!permitted(state.user.id)){headers.set('retry-after','60');return reply(JSON.stringify({error:'Please wait before refreshing again.'}),429,'application/json');}
      if(env.ADMIN_API_LIMITER){
        const limit=await env.ADMIN_API_LIMITER.limit({key:state.user.id});
        if(!limit.success){headers.set('retry-after','60');return reply(JSON.stringify({error:'Please wait before refreshing again.'}),429,'application/json');}
      }
      if(monitor){
        const data=await call(env,state.accessToken,'veeays_admin_quick_reads',{});
        data.runtime_enabled=env.QUICK_READ_AUTO_ENABLED==='true';
        data.schedule=quickReadSchedule(data.checked_at);
        return reply(JSON.stringify(data),200,'application/json');
      }
      let dates;
      try {dates=period(url.searchParams);} catch(error) {return reply(JSON.stringify({error:error.message}),400,'application/json');}
      const cacheKey=state.user.id+':'+dates.p_start+':'+dates.p_end;
      const cached=snapshots.get(cacheKey);
      const cacheHit=call===rpc&&cached&&cached.expires>Date.now();
      const data=cacheHit?structuredClone(cached.data):await call(env,state.accessToken,'veeays_admin_analytics',dates);
      // Cache hits must not extend the snapshot lifetime during regular polling.
      if(call===rpc&&!cacheHit){for(const [key,value] of snapshots)if(value.expires<=Date.now())snapshots.delete(key);if(snapshots.size<100)snapshots.set(cacheKey,{expires:Date.now()+60000,data:structuredClone(data)});}
      // Independent read-only integrations run together, so slow providers do not
      // stack their deadlines and blank the entire dashboard on mobile.
      const secured=await Promise.allSettled([
        Promise.resolve().then(()=>call(env,state.accessToken,'veeays_admin_traffic',dates)),
        Promise.resolve().then(()=>call===rpc&&cached?.extended&&cached.expires>Date.now()?structuredClone(cached.extended):call(env,state.accessToken,'veeays_admin_extended',dates)),
        Promise.resolve().then(()=>call(env,state.accessToken,'veeays_admin_registration_snapshot',{})),
        Promise.resolve().then(()=>call(env,state.accessToken,'veeays_admin_payment_snapshot',{}))
      ]);
      for(const result of secured)if(result.status==='rejected'&&[401,403].includes(result.reason?.status))throw result.reason;
      const providers=await Promise.allSettled([
        Promise.resolve().then(()=>visitors(env,dates)),
        Promise.resolve().then(()=>usage(env)),Promise.resolve().then(()=>balances(env))
      ]);
      const optional=[providers[0],secured[0],secured[1],providers[1],providers[2],secured[2],secured[3]];
      const value=(index,fallback)=>optional[index].status==='fulfilled'?optional[index].value:fallback;
      data.visitors=value(0,{available:false,reason:'provider_error'});
      data.traffic=value(1,{available:false,reason:'not_connected'});
      data.extended=value(2,{available:false});
      if(call===rpc&&data.extended?.available&&snapshots.has(cacheKey))snapshots.get(cacheKey).extended=structuredClone(data.extended);
      data.email_health={usage:value(3,{available:false,reason:'provider_error'}),auth_cap:{value:null,reported_value:100,unit:'per hour',verified:false}};
      data.provider_balances=value(4,{available:false});
      data.registrations=value(5,{available:false});
      data.confirmed_payments=value(6,{available:false});
      data.actions=actionCenter(data);
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
  const navigation=[['overview','Overview','M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],['action-center','Action Center','M12 3 2 21h20ZM12 9v5m0 3v1'],['email-health','Email Health','M3 5h18v14H3zM3 5l9 7 9-7'],['provider-usage','Provider Usage &amp; Balances','M3 6h18v14H3zM3 10h18m-6 5h3'],['members','Members','M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8m9 11a4 4 0 0 1 4 4v3'],['marketing','Traffic Sources','M3 10v4h4l10 5V5L7 10ZM7 14l2 7'],['system-health','System Health','M2 12h4l3-8 6 16 3-8h4'],['trends','Trends','M3 3v18h18M6 16l5-6 4 3 6-8'],['operations','Quick Reads','M13 2 4 14h7l-1 8 10-12h-7z'],['imports','Import health','M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5'],['payments','Payments','M3 5h18v14H3zM3 9h18M6 15h4']];
  const priority=["overview","action-center","members","marketing","payments","operations","imports","email-health","provider-usage","trends","system-health"];
  navigation.sort((a,b)=>priority.indexOf(a[0])-priority.indexOf(b[0]));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VeeAys · Admin</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/admin.css"><link rel="stylesheet" href="/admin-theme.css"><script src="/admin-theme.js" type="module"></script><script type="module" src="/admin-interactions.js"></script><script src="/admin.js" type="module"></script><link rel="stylesheet" href="/admin-quick-reads.css"><script src="/admin-quick-reads.js" type="module"></script></head>
<body><a class="skip-link" href="#main-content">Skip to dashboard</a><div class="reference-topbar"><div class="reference-brand"><a href="/"><img src="/veeays-logo.png" alt="VeeAys" width="150"></a><span>VeeAys<strong>Dashboard</strong></span></div><div class="reference-tools"><label>Appearance<select id="theme-mode"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></div></div><aside aria-label="Dashboard navigation"><nav aria-label="Dashboard sections">${navigation.map(([id,label,path])=>`<a href="#${id}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"/></svg><span>${label}</span></a>`).join('')}</nav></aside>
<main id="main-content"><header class="dashboard-header"><div class="reference-date"><span id="report-day">—</span><div><strong id="report-month">Manila time</strong><small>Production overview</small></div><a href="#action-center">Review activity <span aria-hidden="true">↗</span></a></div><div class="dashboard-title"><span>VEEAYS ADMIN</span><h1>Overview</h1></div><span id="platform-status" class="platform-status" role="status">Analytics awaiting refresh</span></header>
<div class="dashboard-toolbar"><form id="filters"><label>Timezone<select disabled aria-describedby="timezone-note"><option>Asia/Manila</option></select></label><span id="timezone-note" class="sr-only">Reporting dates are fixed to Manila time.</span><label>Period · Manila<select id="period" name="period"><option value="1">Today</option><option value="7" selected>Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="custom">Custom dates</option></select></label><label>From<input type="date" id="start" required></label><label>Through<input type="date" id="end" required></label><button type="submit">Refresh data</button></form></div>

<button id="signup-chime" class="sound-toggle" type="button" role="switch" aria-checked="true" aria-label="Notification sounds"><span>Sounds</span><i aria-hidden="true"></i></button>
<div id="signup-notifications" role="status" aria-live="polite" aria-atomic="false"></div>
<p id="status" role="status" aria-live="polite">Loading production metrics…</p><div id="dashboard" aria-busy="true">
<div class="reference-board">
<section id="overview" class="cards"></section>
<section id="action-center"><div class="section-heading"><h2>Action Center</h2><p>Read-only issues · follow links to inspect</p></div><article id="actions"></article></section>
<div class="growth-row"><section id="collection-panel" class="growth-panel"><div class="section-heading"><h2>Collection Health</h2><p>Job boards · latest arrivals</p></div><div id="collection-health"></div></section><section class="quick-stats-panel"><div class="section-heading"><h2>Operational snapshot</h2><p>Queue, access and delivery</p></div><div id="quick-stats" class="cards"></div></section><div id="overview-insights" class="overview-insights" aria-label="Member, traffic and email summaries"></div></div>
</div>
<section id="members"><div class="section-heading"><h2>Member Analytics</h2><p>Current access and registration cohorts</p></div><article id="member-detail"></article></section>
<section id="marketing"><link rel="stylesheet" href="/admin-traffic.css"><div class="section-heading"><h2>Site Visitors &amp; Traffic Sources</h2><p>Measured traffic · attribution coverage</p></div><article id="marketing-detail"></article></section>
<section id="payments"><div class="section-heading"><h2>Payment events</h2><p>Checkout records created in the selected period</p></div><article><p>Live confirmed payments contribute to revenue on their paid date. Test payments are excluded. Pro access includes grants and purchases; it is not a recurring subscriber count.</p><div id="payment-table" class="table-wrap"></div></article></section>
<section id="operations"><div class="section-heading"><h2>Quick Read operations</h2><p>Current state and selected-period results</p></div><div id="quick-live"></div><div id="quick" class="panels"></div><article><h3>Recent errors in period</h3><div id="errors" class="table-wrap"></div></article></section>
<section id="imports"><div class="section-heading"><h2>Import health</h2><p>Freshness inferred from job records</p></div><article><p><a href="/admin?view=job-health">Job Health metrics and review queue →</a></p><p>No importer run log is connected. A recent collection timestamp confirms data arrival; it does not prove every import succeeded. Sources over 24 hours old are marked for review.</p><div id="import-table" class="table-wrap"></div></article></section>
<section id="email-health"><div class="section-heading"><h2>Email Health</h2><p>Account quota and delivery visibility</p></div><article id="email"></article></section>
<section id="provider-usage"><div class="section-heading"><h2>Provider Usage &amp; Balances</h2><p>Remaining allowances, reported spend and merchant funds</p></div><div id="provider-balances"></div></section>
<section id="trends"><div class="section-heading"><h2>Detailed daily trends</h2><p>All metrics · selected period</p></div><details class="dashboard-details"><summary>Explore daily values and charts</summary><div class="charts" id="charts"></div></details></section>
<section id="system-health"><div class="section-heading"><h2>System Health</h2><p>Available evidence and monitoring coverage</p></div><article id="system"></article></section>
<footer>Site visits use Cloudflare Web Analytics when connected; they are not unique people and may be sampled or delayed. Geographic exclusions and beacon coverage have not been verified. Recurring-subscription tracking is not connected. Quick Read reservations are budget holds, not actual provider spend. Historical queue/error transitions are not stored; the dashboard reports current records.</footer>
</div></main></body></html>`;
}
