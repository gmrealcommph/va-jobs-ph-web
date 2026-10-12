import {configuration,rest} from './notifications.js';
import {digestMessage} from './daily-digest.js';
const rpc=(c,n,b)=>rest(c,'rpc/'+n,{}, {method:'POST',body:JSON.stringify(b)});
export function alertMessage(config,person,day,address) {
 if(!address?.trim())throw Error('Sender address required');
 const message=digestMessage(config,person.items,{email:person.email,profile:{}},day);
 const frequency=person.frequency==='daily'?'daily':'weekly';
 const unsubscribe=config.site+'/job-alerts/unsubscribe?token='+encodeURIComponent(person.token);
 message.subject=`Your VeeAys ${frequency} job digest — ${person.items.length} opportunities`;
 const explanation=`You opted in to personalized ${frequency} job digests. These jobs were recently imported and matched your settings; check the employer source before applying.`;
 message.text=message.text.replace('Your best new matches from the previous 24 hours.',explanation).replace(/You received this because[^\n]+/,'').replaceAll('/email-preferences','/job-alerts')+`\n\nUnsubscribe: ${unsubscribe}\nVeeAys · ${address}`;
 const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 message.html=message.html.replace('<html>','<html lang="en">').replace('<head>','<head><title>VeeAys job digest</title>').replace('DAILY JOB DIGEST',frequency.toUpperCase()+' JOB DIGEST').replace('Here are your best new matches from the previous 24 hours.',explanation).replace('You received this because Daily Job Digest is enabled for your VeeAys Pro account.','').replaceAll('/email-preferences','/job-alerts').replace('</body>',`<p style="text-align:center;font:14px Arial;line-height:1.7"><a href="${escape(unsubscribe)}">Unsubscribe from job alerts</a><br>VeeAys · ${escape(address)}</p></body>`);
 const tips=[
  'Tailor your application: highlight the experience and tools that match the role, using truthful examples.',
  'Show your work: include one relevant portfolio sample or a brief result you achieved; remove confidential client details.',
  'Follow the instructions: check the original listing for requirements, deadlines and requested documents before submitting.'
 ];
 const tipsText='Before you apply\n'+tips.map(t=>'• '+t).join('\n');
 message.text=message.text.replace('My Matches:',tipsText+'\n\nMy Matches:');
 const tipsHtml='<section aria-labelledby="apply-tips-title" style="margin:24px 0;padding:18px;background:#fff9e9;border:1px solid #e4d9b8;border-radius:10px"><h2 id="apply-tips-title" style="font-size:20px;margin:0 0 12px">Before you apply</h2><ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.7">'+tips.map(t=>'<li style="margin:8px 0">'+escape(t)+'</li>').join('')+'</ul></section>';
 message.html=message.html.replace('<p><a href="'+escape(config.site)+'/matches"',tipsHtml+'<p><a href="'+escape(config.site)+'/matches"');
 message.headers={'List-Unsubscribe':`<${unsubscribe}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'};
 return message;
}
export async function processJobAlert(env,c,d,token,{call=rpc,request=fetch}={}) {
 const args={p_id:d.id,p_token:token};
 try {
 if(d.first_attempt_at&&Date.now()-Date.parse(d.first_attempt_at)>=23*3600000)throw Object.assign(Error(),{safe:'retry_window_expired'});
 let person=await call(c,'check_job_alert',args);if(person?.error)throw Object.assign(Error(),{safe:person.error});
 const payload=d.payload||await call(c,'freeze_job_alert',{...args,p_payload:alertMessage(c,person,d.day,env.JOB_ALERTS_SENDER_ADDRESS)});
 // Recheck visibility through the publishable key independently of privileged matching.
 const ids=person.items.map(i=>i.job_id);if(!ids.length||ids.some(id=>!/^\d{1,19}$/.test(id)))throw Object.assign(Error(),{safe:'invalid_jobs'});
 const visible=await rest({...c,key:env.SUPABASE_PUBLISHABLE_KEY,modernKey:true},'public_jobs',{select:'id',id:`in.(${ids.join(',')})`,limit:'10'});
 if(visible.length!==ids.length)throw Object.assign(Error(),{safe:'visibility_changed'});
 person=await call(c,'check_job_alert',args);if(person?.error||payload.to?.[0]!==person.email)throw Object.assign(Error(),{safe:'recipient_or_jobs_changed'});
 if(await call(c,'start_job_alert',args)!==true)throw Object.assign(Error(),{safe:'send_refused'});

 const r=await request('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json','Idempotency-Key':'veeays-job-alert-'+d.id},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Object.assign(Error(),{safe:r.status===429||r.status>=500||r.status===409?null:'provider_rejected',retry:r.status===429||r.status>=500||r.status===409});
 const result=await r.json();if(!result?.id)throw Error();
 if(await call(c,'finish_job_alert',{...args,p_provider:result.id,p_error:null,p_retry:false})!==true)throw Error();
 return 'accepted';
 }catch(error){
 const retry=!error.safe&&error.retry!==false;
 await call(c,'finish_job_alert',{...args,p_provider:null,p_error:error.safe||'transient_or_unknown_outcome',p_retry:retry});
 return retry?'retry':'held';
 }
}
export async function runJobAlerts(env,{call=rpc}={}) {
 if(env.JOB_ALERTS_MODE!=='enabled')return {status:'disabled'};
 // Explicit handoff prevents the legacy digest and instant senders running alongside this feature.
 if(env.DAILY_DIGEST_MODE!=='disabled'||env.STRONG_MATCH_MODE!=='disabled'||!env.JOB_ALERTS_SENDER_ADDRESS||!env.JOB_ALERTS_WEBHOOK_SECRET||!env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_'))return {status:'configuration_blocked'};
 const c=configuration(env,true),summary={accepted:0,retry:0,held:0};
 // One recipient per invocation, DB rate gate and quotas include retries.
 await call(c,'cleanup_job_alerts',{});
 const token=crypto.randomUUID(),d=await call(c,'claim_job_alert',{p_token:token});
 if(d)summary[await processJobAlert(env,c,d,token)]++;
 return summary;
}
export async function scheduledJobAlerts(controller,env) {
 try{return await runJobAlerts(env);}catch{console.log('job_alerts_error','batch_unavailable');return {status:'unavailable'};}
}
