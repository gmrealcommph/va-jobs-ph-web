import {productionSendReady} from './lifecycle-config.js';
import {renderEmail} from './lifecycle-templates.js';
import {dueStep} from './lifecycle-policy.js';
const production='nwqmhqiymtqkdihjadrp.supabase.co';
const serviceRpc=async(env,name,body)=>{
 const db=new URL(env.SUPABASE_URL),key=env.SUPABASE_SERVICE_ROLE_KEY;
 const r=await fetch(new URL('/rest/v1/rpc/'+name,db),{method:'POST',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{apikey:key,...(key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key}),'content-type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok)throw Error('database_unavailable');if(r.status===204)return null;return r.json();
};
// Existing website scheduler invokes this only when explicitly configured. No additional cron.
// Production is separately gated by exact targets, approved controls and database readiness.
export async function runLifecycle(env,{call=serviceRpc,request=fetch,now=Date.now,token=()=>crypto.randomUUID()}={}) {
 if(!['preview','staging','production'].includes(env.LIFECYCLE_MODE))return {status:'disabled'};
 let db;try{db=new URL(env.SUPABASE_URL);}catch{return {status:'configuration_blocked'};}
 if(db.protocol!=='https:'||db.username||db.password||db.port||db.pathname!=='/'||db.search||db.hash||!db.hostname.endsWith('.supabase.co')||
    !/^(sb_secret_|eyJ)/.test(env.SUPABASE_SERVICE_ROLE_KEY||''))return {status:'configuration_blocked'};
 if(env.LIFECYCLE_MODE==='preview'){
  // No reserve, mutation, recipient return or provider call in preview mode.
  const summary=await call(env,'preview_member_email_sequence',{});
  return {status:'preview',eligible:Number.isSafeInteger(summary?.eligible)?summary.eligible:0};
 }
 let site;try{site=new URL(env.SITE_URL);}catch{return {status:'configuration_blocked'};}
 const live=env.LIFECYCLE_MODE==='production';
 if(live&&!productionSendReady(env))return {status:'configuration_blocked'};
 if(site.protocol!=='https:'||site.username||site.password||(!live&&site.origin==='https://veeays.com')||site.pathname!=='/'||site.search||site.hash||(!live&&db.hostname===production)||env.LIFECYCLE_COORDINATION_ENABLED!=='true'||(!live&&(env.LIFECYCLE_TEST_VERIFIED!=='true'||!env.LIFECYCLE_TEST_EMAIL))||!env.RESEND_API_KEY)return {status:'configuration_blocked'};
 if(live){const readiness=await call(env,'member_email_readiness',{});if(readiness?.enabled!==true||Date.parse(readiness.startAt)!==Date.parse(env.LIFECYCLE_START_AT)||readiness.dailyCap!==Number(env.LIFECYCLE_DAILY_CAP)||readiness.monthlyCap!==Number(env.LIFECYCLE_MONTHLY_CAP)||readiness.remindersVerified!==false)return {status:'configuration_blocked'};}
 await call(env,'cleanup_member_email_payloads',{});
 const lease=token(),d=await call(env,'claim_member_email',{p_token:lease});
 if(!d)return {status:'idle'};
 const args={p_id:d.id,p_token:lease};let started=false;
 try{
  const person=await call(env,'check_member_email',args);
  const step=dueStep(person,now(),d.control);
  if(step?.id!==d.step||(!live&&person.email?.toLowerCase()!==env.LIFECYCLE_TEST_EMAIL.toLowerCase())||(live&&(step?.category==='verification'||Date.parse(d.control?.startAt)!==Date.parse(env.LIFECYCLE_START_AT))))throw Error('recipient_ineligible');
  if(!/^[0-9a-f-]{36}$/i.test(person.unsubscribeToken||''))throw Error('invalid_unsubscribe_token');
  const unsubscribe=`${site.origin}/member-emails/unsubscribe?token=${encodeURIComponent(person.unsubscribeToken)}`;
  const rendered=renderEmail(d.step,{firstName:person.firstName,unsubscribeUrl:unsubscribe});
  rendered.html=rendered.html.replaceAll('https://veeays.com',site.origin);
  rendered.text=rendered.text.replaceAll('https://veeays.com',site.origin);
  const message={from:'VeeAys <jobs@veeays.com>',reply_to:'support@veeays.com',to:[person.email],...rendered,
   ...(step.category==='verification'?{}:{headers:{'List-Unsubscribe':`<${unsubscribe}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}})};
  const frozen=d.payload||await call(env,'freeze_member_email',{...args,p_payload:message});
  if(frozen.to?.length!==1||frozen.to[0]!==person.email||frozen.subject!==message.subject)throw Error('frozen_recipient_changed');
  // Database rechecks current eligibility and reserves the per-member gap atomically.
  if(await call(env,'start_member_email',{...args,...(live?{p_expected_start:env.LIFECYCLE_START_AT}:{})})!==true){
   await call(env,'defer_member_email',args);return {status:'deferred'};
  }started=true;
  const r=await request.call(globalThis,'https://api.resend.com/emails',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json','Idempotency-Key':'veeays-member-email-'+d.id},body:JSON.stringify(frozen)});
  const result=await r.json();
  if(!r.ok||typeof result?.id!=='string'||!result.id)throw Error('provider_unknown');
  if(await call(env,'finish_member_email',{...args,p_provider:result.id})!==true)throw Error('settlement_unknown');
  return {status:'accepted'};
 }catch{
  // Hold ambiguous sends; no automatic replay after provider idempotency expiry.
  await call(env,'hold_member_email',{...args,p_code:started?'ambiguous_after_start':'eligibility_or_preflight'});
  return {status:'held'};
 }
}
export async function scheduledLifecycle(_controller,env){let result;try{result=await runLifecycle(env);}catch{result={status:'unavailable'};}console.info(JSON.stringify({event:'member_email_sequence',...result}));return result;}
