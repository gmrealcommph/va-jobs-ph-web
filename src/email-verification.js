import {authFetch, sessionForRequest, setSessionCookies} from './auth.js';
import {rest, configuration} from './notifications.js';
import {cachedEmailUsage} from './admin-health.js';

export const VERIFICATION_CRON = '*/15 * * * *';
export const verifiedEmail = user => !!user?.email_confirmed_at;
export const verificationCapacity = quota => quota?.available===true && !quota.stale && ['daily','monthly'].every(w=>quota[w] && (quota[w].limit===null || (Number.isSafeInteger(quota[w].used) && quota[w].limit-quota[w].used>=20)));
export function verificationReturn(value) {
  return /^\/apply\/[A-Za-z0-9%._~-]{1,240}$/.test(String(value || '')) ? value : '';
}
function serverConfig(env) {
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !(key.startsWith('sb_secret_') || key.startsWith('eyJ'))) throw Error('Verification storage unavailable');
  return {url:new URL(env.SUPABASE_URL),key,modernKey:key.startsWith('sb_secret_')};
}
export const verificationRpc=(env,name,body)=>rest(serverConfig(env),'rpc/'+name,{}, {method:'POST',body:JSON.stringify(body)});
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');

export async function verificationResend(request,env,{session=sessionForRequest,call=verificationRpc,send=authFetch,usage=cachedEmailUsage}={}) {
  const url=new URL(request.url);
  const headers=new Headers({'cache-control':'private, no-store','referrer-policy':'no-referrer'});
  const reply=(text,status)=>new Response(text,{status,headers});
  if(request.method!=='POST')return reply('Method not allowed',405);
  // Public resend requests must originate from our form; fail closed if Origin is missing.
  if(request.headers.get('origin')!==url.origin)return reply('Forbidden',403);
  try {
    const form=await request.formData();
    const state=await session(request,env);
    if(state.refreshed&&typeof state.refreshed==='object')setSessionCookies(headers,state.refreshed);
    const returnTo=verificationReturn(form.get('return'));
    const email=String(state.user?.email || form.get('email') || '').trim().toLowerCase();
    if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply('Enter a valid email address.',400);
    if(!verifiedEmail(state.user)) {
      if(!verificationCapacity(await usage(env)))return reply('Verification is temporarily unavailable. Please try again shortly.',503);
      const ip=request.headers.get('cf-connecting-ip');
      // Cloudflare supplies this header. No durable limiter means no sends.
      if(!ip)return reply('Please try again shortly.',503);
      const allowed=await call(env,'veeays_verification_resend_claim',{p_email_hash:await digest(email),p_ip_hash:await digest(ip)});
      if(allowed===true) {
        const site=new URL(env.SITE_URL || url.origin).origin;
        const redirectTo=site+'/auth/callback'+(returnTo?'?return='+encodeURIComponent(returnTo):'');
        const {response}=await send(env,'/auth/v1/resend?redirect_to='+encodeURIComponent(redirectTo),{
          method:'POST',body:JSON.stringify({type:'signup',email})
        });
        // Never expose account existence or provider errors. The reservation remains consumed on failure.
        if(!response.ok)console.warn('verification_resend_provider',response.status);
      }
    }
    headers.set('location','/check-email?requested=1'+(returnTo?'&return='+encodeURIComponent(returnTo):''));
    return new Response(null,{status:303,headers});
  } catch {return reply('Verification is temporarily unavailable. Please try again shortly.',503);}
}

export function reminderMessage(site,person) {
  const link=site+'/check-email';
  return {from:'VeeAys <hello@veeays.com>',to:[person.email],subject:'Verify your email to apply with VeeAys',
    text:`One more step: verify your VeeAys email before applying to a job. Open your original confirmation email, or request a fresh link here: ${link}\n\nYou received this account reminder because your email is not yet verified.`,
    html:`<!doctype html><html lang="en"><head><title>Verify your VeeAys email</title></head><body><h1>One more step</h1><p>Verify your VeeAys email before applying to a job.</p><p>Open your original confirmation email, or <a href="${link}">request a fresh confirmation link</a>.</p><p>You received this account reminder because your email is not yet verified.</p></body></html>`};
}

export async function scheduledVerification(controller,env,{call=verificationRpc,usage=cachedEmailUsage,send=fetch}={}) {
  if(env.EMAIL_VERIFICATION_REMINDERS_ENABLED!=='true')return;
  const start=Date.parse(env.EMAIL_VERIFICATION_START_AT);
  if(!Number.isFinite(start))throw Error('Set verification cohort start before enabling reminders');
  const c=configuration(env,true);
  // A separate 10/day budget and provider headroom protect existing welcome and alert mail.
  const quota=await usage(env);
  if(!verificationCapacity(quota))return;
  // One claim per invocation: concurrent workers serialize inside Postgres.
  const person=await call(env,'veeays_verification_reminder_claim',{p_start_at:new Date(start).toISOString()});
  if(!person)return;
  const endpoint=new URL('/auth/v1/admin/users/'+encodeURIComponent(person.user_id),c.url);
  const auth=await send(endpoint,{headers:{apikey:c.key,...(!c.modernKey?{Authorization:'Bearer '+c.key}:{})},signal:AbortSignal.timeout(12000)});
  if(!auth.ok)throw Error('Verification recipient check unavailable');
  const raw=await auth.json(),user=raw.user || raw;
  if(user.id!==person.user_id || verifiedEmail(user) || user.deleted_at || user.is_anonymous || user.email!==person.email || (user.banned_until && Date.parse(user.banned_until)>Date.now())) {
    await call(env,'veeays_verification_reminder_finish',{p_id:person.id,p_state:'skipped',p_receipt:null});return;
  }
  const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json','Idempotency-Key':'veeays-verification-'+person.id},body:JSON.stringify(reminderMessage(c.site,person)),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Verification reminder provider '+response.status);
  const receipt=await response.json();
  if(typeof receipt.id!=='string' || !receipt.id)throw Error('Verification receipt missing');
  if(await call(env,'veeays_verification_reminder_finish',{p_id:person.id,p_state:'sent',p_receipt:receipt.id})!==true)throw Error('Verification receipt not committed');
}
