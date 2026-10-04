import { sessionForRequest, getJobPreferences, setEmailPreferences, setSessionCookies, getMyProfile } from './auth.js';
import { layout } from './render.js';

const checkIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const targetIcon='<svg viewBox="0 0 64 64" aria-hidden="true"><circle class="ep-target-pulse" cx="29" cy="34" r="23" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="29" cy="34" r="16" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="29" cy="34" r="8" fill="#d8ed93" stroke="currentColor" stroke-width="2"/><path d="m29 34 19-19m-4-7 1 12 12 1M52 37v8m-4-4h8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="29" cy="34" r="2.5" fill="currentColor"/></svg>';
const mailIcon='<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="46" cy="17" r="7" fill="#f2d36c"/><path d="M46 5V2m0 30v-3M34 17h-3m30 0h-3M37 8l-2-2m22 22-2-2M55 8l2-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><g class="ep-mail-float"><rect x="9" y="25" width="43" height="28" rx="6" fill="#fffdf5" stroke="currentColor" stroke-width="2"/><path d="m11 28 19.5 14L50 28m-39 22 12-10m27 10L38 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
function card(field,title,copy,badge,icon,enabled,kind) {
  return `<article class="ep-card ep-card-${kind}"><div class="ep-card-icon">${icon}</div>
    <div class="ep-card-content"><div class="ep-badges"><span class="ep-badge ep-badge-pro">PRO</span><span class="ep-badge">${badge}</span></div><h2>${title}</h2><p id="${field}-description">${copy}</p></div>
    <label class="ep-switch"><span class="ep-sr-only">${title}</span><input type="hidden" name="${field}" value="false"><input type="checkbox" role="switch" name="${field}" value="true" aria-describedby="${field}-description" ${enabled ? 'checked' : ''}><span class="ep-switch-track" aria-hidden="true"></span><span class="ep-switch-state" aria-hidden="true"></span></label></article>`;
}
export async function emailPreferences(request,env) {
  const url=new URL(request.url);
  const headers=new Headers({'cache-control':'no-store','x-content-type-options':'nosniff','content-type':'text/html; charset=utf-8',
    'content-security-policy':"default-src 'none'; style-src 'self'; img-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});
  if (!['GET','POST'].includes(request.method)) return new Response('Method not allowed',{status:405,headers:{Allow:'GET, POST'}});
  if (request.method==='POST' && request.headers.get('origin')!==url.origin) return new Response('Forbidden',{status:403});
  const state=await sessionForRequest(request,env);
  if (!state.user || !state.accessToken) return Response.redirect(`${url.origin}/login?return=%2Femail-preferences`,303);
  if (state.refreshed) setSessionCookies(headers,state.refreshed);
  try {
    if (request.method==='POST') {
      if (request.headers.get('content-type')?.split(';')[0].trim()!=='application/x-www-form-urlencoded') return new Response('Unsupported form type',{status:415,headers});
      const raw=await request.text();
      if (raw.length>4096) return new Response('Form too large',{status:413,headers});
      const form=new URLSearchParams(raw),fields=['email_strong_matches','daily_digest'];
      if ([...form.keys()].some(key=>!fields.includes(key))) return new Response('Invalid preferences',{status:400,headers});
      const values={};
      for (const field of fields) {
        const entries=form.getAll(field);
        // Native checkbox: hidden=false, then checked=true. No JavaScript is required.
        // Also allow one explicit true/false. Reject other values and duplicate combinations.
        if (entries.length===1 && ['true','false'].includes(entries[0])) values[field]=entries[0]==='true';
        else if (entries.length===2 && entries[0]==='false' && entries[1]==='true') values[field]=true;
        else return new Response('Invalid preferences',{status:400,headers});
      }
      await setEmailPreferences(env,state.accessToken,state.user.id,values);
      if (request.headers.get('accept')==='application/json') {
        headers.set('content-type','application/json; charset=utf-8');
        return new Response(JSON.stringify({saved:true}),{headers});
      }
      headers.set('location','/email-preferences?saved=1');return new Response(null,{status:303,headers});
    }
    const [prefs,profile]=await Promise.all([getJobPreferences(env,state.accessToken,state.user.id),getMyProfile(env,state.accessToken,state.user.id)]);
    const isPro=profile?.plan==='pro' && profile?.plan_status==='active';
    const body=`<section class="wrap ep-page"><header class="ep-heading"><p class="ep-eyebrow">YOUR INBOX, YOUR WAY</p><h1>Email preferences</h1><p class="ep-subtitle">Choose which VeeAys job updates land in your inbox.</p><svg class="ep-flight" viewBox="0 0 160 65" aria-hidden="true"><path d="M4 47c37-45 44 27 90-7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 6" stroke-linecap="round"/><path d="m99 20 46-13-16 42-9-19-21-10Z" fill="#e8eeac" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="m120 30 25-23" stroke="currentColor" stroke-width="1.5"/></svg></header>
      <div class="ep-success" role="status" ${url.searchParams.get('saved')==='1' ? '' : 'hidden'}>${checkIcon}<span>Preferences saved</span></div><p class="ep-error" role="alert" hidden></p>
      ${!isPro ? `<div class="ep-pro-discovery"><div class="ep-badges"><span class="ep-badge ep-badge-pro">PRO</span></div><h2>Let your next opportunity find you.</h2><h3>Strong Match Alerts</h3><p>Get notified about especially strong matches. <strong>90%+ matches</strong></p><h3>Daily Job Digest</h3><p>Your best new matches in one daily email. <strong>Daily · 8:00 AM</strong></p><p>Available with active Pro access. Your saved preferences stay unchanged.</p><a class="button" href="/pro">Explore VeeAys Pro →</a></div>` : prefs ? `<form class="ep-form" method="post" action="/email-preferences">${card('email_strong_matches','Strong Match Alerts','Get notified when VeeAys finds an especially strong match for you.','90%+ matches',targetIcon,prefs.email_strong_matches===true,'strong')}${card('daily_digest','Daily Job Digest','Your best new job matches, bundled into one daily email.','Daily · 8:00 AM',mailIcon,prefs.daily_digest===true,'digest')}<div class="ep-actions"><p>You can change these anytime.<br>Pro emails are sent while your subscription is active.</p><button class="ep-save" type="submit">Save preferences <span aria-hidden="true">→</span></button></div></form>` : '<div class="ep-empty"><p>Complete your job preferences first.</p><a class="button" href="/onboarding">Set up job preferences</a></div>'}</section>`;
    return new Response(layout({title:'Email preferences',description:'Manage your VeeAys email updates.',canonical:`${url.origin}/email-preferences`,body:body+'<script src="/email-preferences.js" defer></script>',noindex:true,user:state.user,profile}),{headers});
  } catch {return new Response('We could not load or save your email preferences. Please try again.',{status:503,headers});}
}
