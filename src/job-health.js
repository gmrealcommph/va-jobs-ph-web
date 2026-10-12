import {sessionForRequest,setSessionCookies,clearSessionCookies} from './auth.js';
import {config,getJob} from './data.js';
import {layout,esc,jobPath} from './render.js';

const headers={'cache-control':'private, no-store','vary':'Cookie','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff','referrer-policy':'same-origin','content-security-policy':"default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
export async function healthRPC(env,token,name,body) {
 const {key,url}=config(env);const r=await fetch(new URL('/rest/v1/rpc/'+name,url),{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Object.assign(new Error('Job health unavailable'),{status:r.status});return r.json();
}
async function boundedForm(request) {
 if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))throw Object.assign(Error(),{status:415});
 const reader=request.body?.getReader();if(!reader)throw Object.assign(Error(),{status:400});const parts=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>16000){await reader.cancel();throw Object.assign(Error(),{status:413});}parts.push(value);}
 const data=new Uint8Array(length);let at=0;for(const p of parts){data.set(p,at);at+=p.length;}return new URLSearchParams(new TextDecoder().decode(data));
}
export async function jobHealthEndpoint(request,env,{session=sessionForRequest,call=healthRPC,job=getJob}={}) {
 const url=new URL(request.url),report=url.pathname.match(/^\/jobs\/([1-9]\d{0,18})\/report$/),api=url.pathname==='/admin/api/job-health';
 const h=new Headers(headers);const reply=(body,status=200,type='text/html; charset=utf-8')=>{h.set('content-type',type);return new Response(body,{status,headers:h});};
 const json=(data,status=200)=>reply(JSON.stringify(data),status,'application/json');
 const desktopPage=url.pathname==='/admin'&&url.searchParams.get('view')==='job-health';
 if(!report&&!api&&url.pathname!=='/admin/job-health'&&!desktopPage)return reply('Not found',404);
 if(!['GET','POST'].includes(request.method)||(!api&&!report&&request.method!=='GET')){h.set('allow',api||report?'GET, POST':'GET');return reply('Method not allowed',405);}
 // All cookie-authenticated mutations require a browser's exact same-origin header.
 if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return reply('Forbidden',403);
 if(report&&env.JOB_REPORTS_ENABLED!=='true')return reply('Job reports are not available yet.',503);
 try {
  const state=await session(request,env);
  if(state.refreshed&&typeof state.refreshed==='object')setSessionCookies(h,state.refreshed);
  else if(state.refreshed===false)clearSessionCookies(h);
  if(!state.user||!state.accessToken){if(api)return json({error:'Please sign in again.'},401);h.set('location','/login?return='+encodeURIComponent(report?'/jobs/'+report[1]:'/admin'));return reply('',303);}
  if(!report&&await call(env,state.accessToken,'veeays_admin_access',{})!==true)return json({error:'Admin access required.'},403);
  if(report) {
   const record=await job(env,report[1]);if(!record)return reply('Job unavailable.',404);
   const path=jobPath(record);
   if(request.method==='POST'){
    const form=await boundedForm(request),category=form.get('category'),details=form.get('details')||'';
    if(form.get('website')||!['closed_filled','broken_link','suspicious','inaccurate'].includes(category)||details.length>1000)return reply('Invalid report.',400);
    await call(env,state.accessToken,'veeays_report_job',{p_job_id:report[1],p_category:category,p_details:details});
    h.set('location',path+'?reported=1');return reply('',303);
   }
   return reply(layout({title:'Report this job',body:`<link rel="stylesheet" href="/job-report.css"><section class="wrap job-report"><h1>Report this job</h1><p>${esc(record.title)} at ${esc(record.company)}</p><p>Your report goes to our review team. Please leave out personal or sensitive information.</p><form method="post"><label>What is wrong?<select name="category" required><option value="closed_filled">Closed or filled</option><option value="broken_link">Broken application link</option><option value="suspicious">Suspicious</option><option value="inaccurate">Inaccurate information</option></select></label><label>Details (optional)<textarea name="details" maxlength="1000"></textarea></label><div hidden><label>Leave blank<input name="website" tabindex="-1" autocomplete="off"></label></div><button type="submit">Send report</button></form><p><a href="${path}">Back to job</a></p></section>`,user:state.user,noindex:true,canonical:url.href}));
  }
  if(!api)return reply(jobHealthPage());
  if(request.method==='GET'){
   const after=url.searchParams.get('after')||'0',filter=url.searchParams.get('filter')||'all';if(!/^\d{1,18}$/.test(after)||!['all','reports','missing','missing_original','aging','old','failures'].includes(filter))return json({error:'Invalid filter.'},400);
   return json(await call(env,state.accessToken,'veeays_job_health',{p_after:after,p_filter:filter}));
  }
  const form=await boundedForm(request),action=form.get('action'),id=form.get('job_id'),reportId=form.get('report_id')||null,revision=form.get('revision'),reason=form.get('reason')||'',expires=form.get('expires_at')||null;
  if(!/^[1-9]\d{0,18}$/.test(id||'')||(reportId&&!/^[1-9]\d{0,18}$/.test(reportId))||!/^\d{1,9}$/.test(revision||'')||!['needs_review','reviewed','evergreen','resolved','dismissed'].includes(action)||reason.trim().length<3||reason.length>1000||(expires&&!Number.isFinite(Date.parse(expires))))return json({error:'Invalid review.'},400);
  return json(await call(env,state.accessToken,'veeays_job_health_review',{p_job_id:id,p_report_id:reportId,p_action:action,p_reason:reason,p_revision:Number(revision),p_expires_at:expires?new Date(expires).toISOString():null}));
 }catch(error){const status=[400,401,403,404,409,413,415,429].includes(error.status)?error.status:503;if(status===429)h.set('retry-after','60');const message=status===429?'Please wait before reporting another job.':status===409?'This review changed. Reload before trying again.':status===503?'Job Health is temporarily unavailable. Please retry.':'We could not complete this request.';return api?json({error:message},status):reply('<h1>'+message+'</h1><p><a href="'+esc(url.pathname)+'">Try again</a></p>',status);}
}
export function jobHealthPage(){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Job Health · VeeAys</title><link rel="stylesheet" href="/admin.css"><link rel="stylesheet" href="/job-health.css"><script type="module" src="/job-health.js"></script></head><body><main class="health-page"><a href="/admin">← Admin dashboard</a><h1>Job Health</h1><p>Automatic hiding is disabled. Reviews, reports and evergreen exceptions do not change listing visibility.</p><p id="health-message" role="status">Loading…</p><section id="health-metrics" class="health-metrics" aria-label="Job Health metrics"></section><h2>Review queue</h2><label>Show <select id="health-filter"><option value="all">All review candidates</option><option value="reports">Member reports</option><option value="missing">Missing legacy posting dates</option><option value="missing_original">Missing employer-original dates</option><option value="aging">Verified age 31–45 days</option><option value="old">Provisional over 45 days</option><option value="failures">Verification failures</option></select></label><button id="health-refresh" type="button">Refresh</button><div id="health-queue"></div><button id="health-next" type="button" hidden>Next page</button></main></body></html>`;}
