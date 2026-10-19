import {configuration,rest} from './notifications.js';
export const TEST_ID='smart-alerts-support-20261019';
const TOKEN_HASH='a1c4f2dc588adaa19241d9cd4187fb815d7a4303655fa24f1dcaf944252225f6';
const reply=(status,data)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
export async function jobAlertsTest(request,env,{store=rest,send=fetch,now=Date.now(),tokenHash=TOKEN_HASH}={}) {
 if(request.method!=='POST')return reply(405,{error:'method_not_allowed'});
 const auth=request.headers.get('authorization')||'';
 if(auth.length>256||!/^Bearer [a-f0-9]{64}$/.test(auth))return reply(401,{error:'unauthorized'});
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(auth.slice(7)));
 const actual=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
 let difference=0;for(let i=0;i<64;i++)difference|=actual.charCodeAt(i)^tokenHash.charCodeAt(i);
 if(difference)return reply(401,{error:'unauthorized'});
 if(now>=Date.parse('2026-10-20T00:00:00Z')||env.JOB_ALERTS_MODE!=='disabled')return reply(409,{error:'test_closed'});
 if(request.headers.get('origin')||new URL(request.url).search||await request.text()!=='')return reply(400,{error:'empty_request_required'});
 let c;
 try{c=configuration(env,true);if(!env.JOB_ALERTS_SENDER_ADDRESS||!env.JOB_ALERTS_WEBHOOK_SECRET)throw Error();}
 catch{return reply(503,{error:'configuration_blocked'});}
 try{
  // A unique, durable INSERT commits before sending. Never delete/reset this claim.
  // A lost DB response consumes the authorization without attempting an email.
  const rows=await store(c,'job_alert_test_claim',{}, {method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id:TEST_ID})});
  if(!Array.isArray(rows)||rows.length!==1||rows[0].id!==TEST_ID)throw Error();
 }catch{return reply(409,{error:'claim_unavailable_or_already_consumed'});}
 try{
  const result=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json','Idempotency-Key':TEST_ID},body:JSON.stringify({from:'VeeAys Jobs <jobs@veeays.com>',to:['support@veeays.com'],subject:'VeeAys Smart Alerts — authorized delivery test',text:'This is the single authorized VeeAys Smart Alerts delivery test. Member alerts remain disabled. No action is required.\n\nVeeAys · '+env.JOB_ALERTS_SENDER_ADDRESS}),signal:AbortSignal.timeout(15000)});
  if(!result.ok)throw Error();
  const receipt=await result.json();if(typeof receipt.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(receipt.id))throw Error();
  // Return provider acceptance even if saving the receipt fails; never retry sending.
  try{await store(c,'job_alert_test_claim',{id:'eq.'+TEST_ID},{method:'PATCH',body:JSON.stringify({provider_id:receipt.id})});}catch{}
  return reply(200,{status:'accepted',id:receipt.id});
 }catch{return reply(502,{status:'unknown_or_rejected',authorization_consumed:true});}
}
