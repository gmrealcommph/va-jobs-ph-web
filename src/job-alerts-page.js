import {memberEmailUIEnabled} from './lifecycle-config.js';
import {sessionForRequest,setSessionCookies} from './auth.js';
import {healthRPC} from './job-health.js';
import {layout,esc} from './render.js';
import {config} from './data.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function alertForm(data={}) {
 const s=data.settings||{},choices=(values,name,selected)=>values.map(v=>`<label><input type="checkbox" name="${name}" value="${esc(v)}" ${selected?.includes(v)?'checked':''}> ${esc(v.replaceAll('_',' '))}</label>`).join('');
 return `<section class="wrap alerts-page"><p class="kicker">YOUR INBOX, YOUR WAY</p><h1>My Job Alerts</h1>${data.deliveryPaused?'<p role="status">Personalized digest delivery is not active yet. You can save your preferences now; emails will begin only after delivery is enabled.</p>':''}${s.suppressed?'<p role="status">Email delivery is paused after a bounce or complaint. Contact support@veeays.com before resuming.</p>':''}<p>Choose the jobs you want to hear about. Free members can receive a weekly digest. Active ₱499 Pro members can choose daily delivery.</p><form method="post"><fieldset><legend>Preferred job categories</legend><p>Leave all unchecked for any category.</p><div class="alerts-choices">${choices(data.categories||[],'categories',s.categories)}</div></fieldset><fieldset><legend>Employment type</legend><p>Leave unchecked for any type. Specific choices exclude jobs with an unknown type.</p>${choices(data.types||[],'types',s.employment_types)}</fieldset><fieldset><legend>Salary preference (optional)</legend><label>Minimum advertised USD salary<input name="minimum" type="number" min="0" max="1000000" step="1" value="${esc(s.minimum_usd??'')}"></label><label>For this pay period<select name="period">${['hourly','monthly','yearly'].map(p=>`<option ${s.salary_period===p?'selected':''}>${p}</option>`).join('')}</select></label><p>Only recorded USD salary data is compared, within the same pay period. No currency or pay-period estimates are made. A range must start at or above your minimum.</p><label class="va-switch"><input type="checkbox" role="switch" name="unknown" value="yes" ${s.include_unknown_salary!==false?'checked':''}><span class="va-switch-control" aria-hidden="true"><span class="va-switch-track"></span><span class="va-switch-state"></span></span><span class="va-switch-copy">Also include jobs without a known salary or pay period</span></label></fieldset><fieldset><legend>Delivery</legend><label>Frequency<select name="frequency"><option value="weekly" ${s.frequency!=='daily'?'selected':''}>Weekly · Monday, 8 AM Manila</option>${data.pro?`<option value="daily" ${s.frequency==='daily'?'selected':''}>Daily · 8 AM Manila</option>`:''}</select></label><p>Daily delivery requires active Pro access. When Pro expires, alerts fall back to weekly. Instant alerts are unavailable. Empty digests are skipped.</p><label class="va-switch"><input type="checkbox" role="switch" name="enabled" value="yes" ${s.enabled?'checked':''}><span class="va-switch-control" aria-hidden="true"><span class="va-switch-track"></span><span class="va-switch-state"></span></span><span class="va-switch-copy">I agree to receive personalized job digests by email based on these preferences.</span></label><p>You can withdraw consent here or unsubscribe from any digest without signing in. We use your account email, preferences and delivery history to send alerts through Resend. <a href="/privacy">Privacy Policy</a>.</p></fieldset><button type="submit">Save job alerts</button></form></section>`;
}
export async function jobAlertsEndpoint(request,env,{session=sessionForRequest,call=healthRPC}={}) {
 const url=new URL(request.url),h=new Headers({'cache-control':'private, no-store','referrer-policy':url.pathname==='/job-alerts/unsubscribe'?'no-referrer':'same-origin','x-robots-tag':'noindex','content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});
 const reply=(s,status=200)=>new Response(s,{status,headers:h});
 if(!['GET','POST'].includes(request.method))return reply('Method not allowed',405);
 try {
 if(url.pathname==='/job-alerts/unsubscribe') {
 const token=url.searchParams.get('token');if(!uuid.test(token||''))return reply('Invalid unsubscribe link.',400);
 if(request.method==='GET')return reply('<h1>Unsubscribe from job alerts</h1><form method="post"><button>Unsubscribe</button></form>');
 const {key,url:db}=config(env);const r=await fetch(new URL('/rest/v1/rpc/unsubscribe_job_alert',db),{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify({p_token:token}),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error();if(await r.json()!==true){h.set('Retry-After','30');return reply('<h1>A delivery is finishing</h1><p>Please retry in 30 seconds to complete unsubscribe.</p><form method="post"><button>Retry unsubscribe</button></form>',409);}
 return reply('<h1>You are unsubscribed</h1><p>Job alert emails are off.</p><a href="/job-alerts">My Job Alerts</a>');
 }
 if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return reply('Forbidden',403);
 const state=await session(request,env);if(!state.user||!state.accessToken){h.set('location','/login?return=%2Fjob-alerts');return reply('',303);}
 if(state.refreshed)setSessionCookies(h,state.refreshed);
 if(request.method==='POST') {
 if(request.headers.get('content-type')?.split(';')[0]!=='application/x-www-form-urlencoded')return reply('Unsupported form',415);
 const raw=await request.text();if(raw.length>8192)return reply('Form too large',413);
 const f=new URLSearchParams(raw);if([...f.keys()].some(k=>!['enabled','frequency','categories','types','minimum','period','unknown'].includes(k)))return reply('Invalid form',400);
 if(['enabled','frequency','minimum','period','unknown'].some(k=>f.getAll(k).length>1))return reply('Invalid form',400);
 const min=f.get('minimum')||'';if(min&&!/^\d{1,7}$/.test(min))return reply('Invalid salary',400);
 await call(env,state.accessToken,'save_my_job_alerts',{p_enabled:f.get('enabled')==='yes',p_frequency:f.get('frequency'),p_categories:f.getAll('categories'),p_types:f.getAll('types'),p_minimum:min?Number(min):null,p_period:min?f.get('period'):null,p_unknown:f.get('unknown')==='yes'});
 h.set('location','/job-alerts?saved=1');return reply('',303);
 }
 const data=await call(env,state.accessToken,'my_job_alerts',{});
 return reply(layout({title:'My Job Alerts',noindex:true,user:state.user,body:'<link rel="stylesheet" href="/job-alerts.css">'+(url.searchParams.get('saved')==='1'?'<p role="status">Job alert preferences saved.</p>':'')+alertForm({...data,deliveryPaused:env.JOB_ALERTS_MODE!=='enabled'})+(memberEmailUIEnabled(env)?'<p class="wrap"><a href="/member-emails">Choose onboarding, career tips and Pro introduction emails</a></p>':'')}));
 }catch(error){return reply(`<h1>Job alerts need another try</h1><p>${error.status===409?'A delivery is finishing. Please retry in 30 seconds.':'We could not confirm your settings. Please reopen this page and try again.'}</p><a href="/job-alerts">Reopen My Job Alerts</a>`,error.status===409?409:503);}
}
