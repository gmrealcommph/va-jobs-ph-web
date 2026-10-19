import {configuration,rest} from './notifications.js';
const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function verifyResendEvent(headers,body,secret,now=Date.now()) {
 try{
 const id=headers.get('svix-id'),ts=headers.get('svix-timestamp');
 if(!id||!/^\d+$/.test(ts||'')||Math.abs(now/1000-Number(ts))>300||!secret?.startsWith('whsec_'))return false;
 const key=await crypto.subtle.importKey('raw',decode(secret.slice(6)),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 for(const v of (headers.get('svix-signature')||'').split(' ')){
 const [version,signature]=v.split(',');if(version==='v1'&&signature&&await crypto.subtle.verify('HMAC',key,decode(signature),new TextEncoder().encode(id+'.'+ts+'.'+body)))return true;
 }return false;
 }catch{return false;}
}
export async function jobAlertsWebhook(request,env){
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const body=await request.text();if(body.length>64000)return new Response('Too large',{status:413});
 if(!await verifyResendEvent(request.headers,body,env.JOB_ALERTS_WEBHOOK_SECRET))return new Response('Unauthorized',{status:401});
 try{
 const event=JSON.parse(body);
 if(event.type==='email.delivered'&&/^[a-zA-Z0-9-]{1,100}$/.test(event.data?.email_id||''))console.log('job_alerts_signed_delivery',event.data.email_id,request.headers.get('svix-id'));
 if(['email.bounced','email.complained','email.suppressed'].includes(event.type)&&typeof event.data?.email_id==='string'){
 const c=configuration(env,true);await rest(c,'rpc/suppress_job_alert',{}, {method:'POST',body:JSON.stringify({p_provider:event.data.email_id})});
 }return new Response(null,{status:204});
 }catch{return new Response('Temporarily unavailable',{status:503});}
}
