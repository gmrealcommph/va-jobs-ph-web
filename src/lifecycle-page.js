import {memberEmailUIEnabled,productionTarget} from './lifecycle-config.js';
import {sessionForRequest,setSessionCookies} from './auth.js';
import {healthRPC} from './job-health.js';
import {layout} from './render.js';
import {config} from './data.js';
import {verifyResendEvent} from './job-alerts-webhook.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function memberEmailForm(s={}){
 return `<link rel="stylesheet" href="/member-emails.css?v=20261014"><section class="wrap member-inbox"><header class="member-inbox-intro"><p class="kicker">A LITTLE BOOST, ON YOUR TERMS</p><h1>Your inbox.<br><span>Your kind of boost.</span></h1><p>Small steps. Useful tips. A little VeeAys cheer.<br>Pick what lands in your inbox — you’re in charge.</p><span class="member-inbox-stamp" aria-hidden="true">✦ MADE FOR YOUR NEXT CHAPTER</span></header><div class="member-inbox-card">${s.suppressed?'<p class="member-inbox-notice" role="status">Sending is paused after a delivery problem. Email support@veeays.com for help.</p>':''}<form method="post"><fieldset><legend>Make yourself at home</legend><p class="member-inbox-caption">A useful nudge, when you want one.</p><label class="va-switch member-inbox-option"><input type="checkbox" role="switch" name="tips" value="yes" ${s.tips===true?'checked':''}><span class="va-switch-control" aria-hidden="true"><span class="va-switch-track"></span><span class="va-switch-state"></span></span><span class="va-switch-copy"><span><strong>A little head start <span aria-hidden="true">🌱</span></strong><span>Send me VeeAys getting-started emails and practical career tips during my first two weeks.</span></span></span></label><label class="va-switch member-inbox-option"><input type="checkbox" role="switch" name="pro" value="yes" ${s.pro===true?'checked':''}><span class="va-switch-control" aria-hidden="true"><span class="va-switch-track"></span><span class="va-switch-state"></span></span><span class="va-switch-copy"><span><strong>A peek at Pro <span aria-hidden="true">✦</span></strong><span>Send me the optional introduction to VeeAys Pro.</span></span></span></label></fieldset><div class="member-inbox-note"><strong>Your pace. Your preferences.</strong><p>These choices are separate from job digests. We use your account age, verification status, profile completion, plan and delivery history to choose relevant messages. Unsubscribe from an email without signing in. We won’t send missed steps all at once.</p></div><p class="member-inbox-fine">Account verification and security messages are separate. <a href="/privacy">Privacy policy</a>.</p><button class="member-inbox-save" type="submit">Save my email choices <span aria-hidden="true">→</span></button></form><div class="member-inbox-footer"><a href="/email-preferences">Manage job digest preferences</a><span>Need a hand? <a href="mailto:support@veeays.com">Say hello to the team</a>.</span></div></div></section>`;

}
export async function memberEmailsEndpoint(request,env,{session=sessionForRequest,call=healthRPC,request:send=fetch}={}){
 if(!memberEmailUIEnabled(env))return new Response('Not found',{status:404});
 const url=new URL(request.url),h=new Headers({'content-type':'text/html; charset=utf-8','cache-control':'private, no-store','referrer-policy':url.pathname==='/member-emails/unsubscribe'?'no-referrer':'same-origin','x-robots-tag':'noindex','content-security-policy':"default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});
 const reply=(body,status=200)=>new Response(body,{status,headers:h});
 if(!['GET','POST'].includes(request.method))return reply('Method not allowed',405);
 try{
 if(url.pathname==='/member-emails/unsubscribe'){
  const t=url.searchParams.get('token');if(!uuid.test(t||''))return reply('Invalid unsubscribe link.',400);
  if(request.method==='GET')return reply('<h1>Unsubscribe from onboarding and tips</h1><p>This also turns off the Pro introduction. Your job digest preferences stay as they are.</p><form method="post"><button>Unsubscribe</button></form>');
  const c=config(env),r=await send(new URL('/rest/v1/rpc/unsubscribe_member_email',c.url),{method:'POST',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{apikey:c.key,'content-type':'application/json'},body:JSON.stringify({p_token:t})});
  if(!r.ok)throw Error();if(await r.json()!==true){h.set('Retry-After','30');return reply('<h1>A delivery is finishing</h1><p>Please retry in 30 seconds.</p><form method="post"><button>Retry unsubscribe</button></form>',409);}
  return reply('<h1>You’re unsubscribed</h1><p>Onboarding, tips and Pro introduction emails are off.</p><a href="/member-emails">My email choices</a>');
 }
 if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return reply('Forbidden',403);
 const state=await session(request,env);if(state.refreshed)setSessionCookies(h,state.refreshed);
 if(!state.user||!state.accessToken){h.set('location','/login?return=%2Fmember-emails');return reply('',303);}
 if(request.method==='POST'){
  if(request.headers.get('content-type')?.split(';')[0]!=='application/x-www-form-urlencoded')return reply('Unsupported form',415);
  const raw=await request.text();if(raw.length>1024)return reply('Form too large',413);
  const form=new URLSearchParams(raw);if([...form.keys()].some(k=>!['tips','pro'].includes(k))||['tips','pro'].some(k=>form.getAll(k).length>1||form.has(k)&&form.get(k)!=='yes'))return reply('Invalid form',400);
  if(await call(env,state.accessToken,'save_member_email_preferences',{p_tips:form.get('tips')==='yes',p_pro:form.get('pro')==='yes'})!==true)return reply('A delivery is finishing. Please try again shortly.',409);
  h.set('location','/member-emails?saved=1');return reply('',303);
 }
 const s=await call(env,state.accessToken,'my_member_email_preferences',{});
 return reply(layout({title:'Your VeeAys inbox',noindex:true,user:state.user,body:(url.searchParams.get('saved')==='1'?'<p class="member-inbox-saved" role="status">✓ Your choices are saved. Your inbox, your rules.</p>':'')+(env.LIFECYCLE_MODE==='staging'||env.LIFECYCLE_MODE==='preview'?'<p role="status">This email sequence is being tested. No production sequence sends are active.</p>':'')+memberEmailForm(s||{})}));
 }catch{return reply('Your email choices need another try. Please reopen this page.',503);}
}
export async function memberEmailsWebhook(request,env,{request:send=fetch}={}){
 if(env.LIFECYCLE_MODE!=='staging'&&!(productionTarget(env)&&env.LIFECYCLE_WEBHOOK_ENABLED==='true'))return new Response('Not found',{status:404});
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const body=await request.text();if(body.length>64000)return new Response('Too large',{status:413});
 if(!await verifyResendEvent(request.headers,body,(productionTarget(env)?env.LIFECYCLE_WEBHOOK_SECRET:env.LIFECYCLE_WEBHOOK_SECRET||env.JOB_ALERTS_WEBHOOK_SECRET)))return new Response('Unauthorized',{status:401});
 try{const e=JSON.parse(body);if(['email.bounced','email.complained','email.suppressed'].includes(e.type)&&typeof e.data?.email_id==='string'){
  const db=new URL(env.SUPABASE_URL),key=env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw Error();
  const r=await send(new URL('/rest/v1/rpc/suppress_member_email',db),{method:'POST',signal:AbortSignal.timeout(12000),headers:{apikey:key,...(key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key}),'content-type':'application/json'},body:JSON.stringify({p_provider:e.data.email_id})});if(!r.ok)throw Error();
 }return new Response(null,{status:204});}catch{return new Response('Temporarily unavailable',{status:503});}
}
