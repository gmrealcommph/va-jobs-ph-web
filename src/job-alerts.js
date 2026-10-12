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
 message.html=message.html.replace('<html>','<html lang="en">').replace('<head>','<head><title>VeeAys job digest</title>').replace('DAILY JOB DIGEST',frequency.toUpperCase()+' JOB DIGEST').replace('Here are your best new matches from the previous 24 hours.',explanation).replace('You received this because Daily Job Digest is enabled for your VeeAys Pro account.','You receive this because you opted in to VeeAys job alerts.').replaceAll('/email-preferences','/job-alerts').replace('</body>',`<p style="text-align:center;font:14px Arial;line-height:1.7"><a href="${escape(unsubscribe)}">Unsubscribe from job alerts</a><br>VeeAys · ${escape(address)}</p></body>`);
 const opening=frequency==='daily'?'Here are today’s opportunities based on your preferences.':'Here are this week’s opportunities based on your preferences.';
 message.text=message.text.replace(explanation,opening+'\n\n'+explanation);
 message.html=message.html.replace('<p>Hello,</p>','<p style="font-size:16px;margin:26px 0 12px">Hi there,</p><h1 style="font-family:Georgia,serif;font-size:28px;line-height:1.3;margin:0 0 16px;color:#163f2c">'+opening+'</h1>');
 message.html=message.html.replace(explanation,'We’ve gathered '+person.items.length+' recently imported roles that match your settings. Have a look and see what feels right for your next move.<br><span style="font-size:13px;color:#647469">Check the original employer listing for current availability and application details.</span>');
 message.html=message.html.replaceAll('background:#f1f6f0;border:1px solid #d6e2d4','background:#ffffff;border:1px solid #d6e2d4').replaceAll('font-size:22px;margin:16px 0 8px','font-size:21px;line-height:1.3;margin:16px 0 8px');
 // Initial tiles identify the actual employer without implying an official logo.
 const tileColors=[['#e8efd9','#355234'],['#f9e8d5','#7d4c2c'],['#e1eaf1','#33566b']];
 let graphicIndex=0;
 message.html=message.html.replace(/<tr><td><span style="background:#d6ebcc/g,()=>{
  const item=person.items[graphicIndex],colors=tileColors[graphicIndex++%tileColors.length];
  const words=String(item?.company||'').trim().split(/\s+/).filter(Boolean);
  const initials=words.length>1?words.slice(0,2).map(w=>Array.from(w)[0]).join(''):Array.from(words[0]||'').slice(0,2).join('');
  const graphic='<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td width="52" height="52" align="center" valign="middle" aria-hidden="true" style="width:52px;height:52px;background:'+colors[0]+';color:'+colors[1]+';border-radius:12px;font-family:Arial,sans-serif;font-size:20px;font-weight:bold;letter-spacing:1px">'+escape(initials.toUpperCase()||'•')+'</td><td style="padding-left:12px;font-size:13px;line-height:1.6;color:#506354">'+escape(item?.company||'Job opportunity')+'</td></tr></table>';
  return '<tr><td>'+graphic+'<span style="background:#d6ebcc';
 });
 // Replace the empty legacy match-score pill with each job's real category.
 let cardIndex=0;
 message.html=message.html.replace(/<span style="background:#d6ebcc;color:#20452d;border-radius:20px;padding:6px 12px;font-size:13px;font-weight:bold">[^<]*<\/span>/g,()=>{
  const item=person.items[cardIndex++];
  return item?.category?'<span style="background:#d6ebcc;color:#20452d;border-radius:20px;padding:6px 12px;font-size:13px;font-weight:bold">'+escape(item.category)+'</span>':'';
 });
 const tips=[
  'Tailor your application: highlight the experience and tools that match the role, using truthful examples.',
  'Show your work: include one relevant portfolio sample or a brief result you achieved; remove confidential client details.',
  'Follow the instructions: check the original listing for requirements, deadlines and requested documents before submitting.'
 ];
 // A stable weekly rotation keeps retries and daily digests consistent for the same week.
 const stamp=Date.parse(day+'T00:00:00Z');
 const week=Number.isFinite(stamp)?Math.floor((stamp+3*86400000)/(7*86400000)):0;
 const tip=tips[((week%tips.length)+tips.length)%tips.length];
 const tipHeading='Application tip of the week';
 const signoff='Rooting for your next move,\nThe VeeAys team';
 message.text=message.text.replace('My Matches:',tipHeading+'\n'+tip+'\n\n'+signoff+'\n\nMy Matches:');
 const tipsHtml='<section aria-labelledby="apply-tips-title" style="margin:28px 0;padding:20px;background:#f5f7f1;border-left:3px solid #80996c"><p style="margin:0 0 8px;font-size:11px;letter-spacing:1.5px;font-weight:bold;color:#46613e">A SMALL STEP FOR YOUR NEXT APPLICATION</p><h2 id="apply-tips-title" style="font-size:18px;margin:0 0 10px">'+tipHeading+'</h2><p style="margin:0;font-size:14px;line-height:1.7">'+escape(tip)+'</p></section><p style="font-size:15px;line-height:1.7;margin:24px 0">Rooting for your next move,<br><strong>The VeeAys team</strong></p>';
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
