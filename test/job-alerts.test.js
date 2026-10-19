import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {jobAlertsEndpoint,alertForm} from '../src/job-alerts-page.js';
import {alertMessage,runJobAlerts,processJobAlert} from '../src/job-alerts.js';
import {verifyResendEvent} from '../src/job-alerts-webhook.js';
import {jobAlertsWebhook} from '../src/job-alerts-webhook.js';
const original=globalThis.fetch;afterEach(()=>globalThis.fetch=original);
const uid='11111111-1111-4111-8111-111111111111';
const session=async()=>({user:{id:uid},accessToken:'token'});
const item={job_id:'1',title:'<Support>',company:'Employer',employment_type:'full_time',salary_min_usd:null,salary_max_usd:null,salary_period:null};
const person={email:'member@example.com',frequency:'weekly',token:uid,items:[item]};
const config={site:'https://veeays.test',url:new URL('https://test.supabase.co'),key:'sb_secret_test',modernKey:true};

test('delivery evidence is logged only after signature verification',async t=>{
 const body=JSON.stringify({type:'email.delivered',data:{email_id:'provider-test'}}),ts=String(Math.floor(Date.now()/1000)),id='event-test';
 const raw=new TextEncoder().encode('12345678901234567890123456789012');
 const base64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
 const key=await crypto.subtle.importKey('raw',raw,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=base64(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(id+'.'+ts+'.'+body)));
 const log=t.mock.method(console,'log',()=>{});
 const headers={'svix-id':id,'svix-timestamp':ts,'svix-signature':'v1,'+signature};
 const env={JOB_ALERTS_WEBHOOK_SECRET:'whsec_'+base64(raw)};
 assert.equal((await jobAlertsWebhook(new Request('https://veeays.test/webhooks/job-alerts',{method:'POST',body:body+' ',headers}),env)).status,401);
 assert.equal(log.mock.calls.length,0);
 assert.equal((await jobAlertsWebhook(new Request('https://veeays.test/webhooks/job-alerts',{method:'POST',body,headers}),env)).status,204);
 assert.deepEqual(log.mock.calls[0].arguments,['job_alerts_signed_delivery','provider-test',id]);
});
test('settings require sign in, same origin, valid form and preserve explicit consent',async()=>{
 const url='https://veeays.test/job-alerts';
 const page=await jobAlertsEndpoint(new Request(url),{JOB_ALERTS_MODE:'disabled'},{session,call:async()=>({})});
 assert.equal(page.headers.get('referrer-policy'),'same-origin');
 assert.ok((await page.text()).includes('Personalized digest delivery is not active yet')); 
 assert.equal((await jobAlertsEndpoint(new Request(url),{}, {session:async()=>({})})).status,303);
 assert.equal((await jobAlertsEndpoint(new Request(url,{method:'POST',headers:{origin:'https://evil.test'}}),{}, {session})).status,403);
 let captured;
 const response=await jobAlertsEndpoint(new Request(url,{method:'POST',headers:{origin:'https://veeays.test','content-type':'application/x-www-form-urlencoded'},body:'frequency=weekly&minimum=&categories=Sales'}),{}, {session,call:async(e,t,n,b)=>{captured=b;return true;}});
 assert.equal(response.status,303);assert.equal(captured.p_enabled,false);assert.deepEqual(captured.p_categories,['Sales']);
 const form=alertForm({categories:['<bad>'],types:['full_time']});assert.ok(form.includes('&lt;bad&gt;'));assert.ok(!form.includes('value="daily"'));assert.ok(!form.match(/name="enabled"[^>]*checked/));
});
test('unsubscribe GET never mutates; POST works without login and handles an in-flight barrier',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json(false);};
 const url='https://veeays.test/job-alerts/unsubscribe?token='+uid,env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
 const page=await jobAlertsEndpoint(new Request(url),env);assert.equal(page.status,200);assert.equal(page.headers.get('referrer-policy'),'no-referrer');assert.equal(calls,0);
 assert.equal((await jobAlertsEndpoint(new Request(url,{method:'POST'}),env)).status,409);
 globalThis.fetch=async()=>Response.json(true);
 assert.equal((await jobAlertsEndpoint(new Request(url,{method:'POST'}),env)).status,200);
});
test('sample emails escape source data, omit unknown salary, and include both unsubscribe formats',()=>{
 const m=alertMessage(config,person,'2026-10-12','Sender address');assert.ok(m.html.includes('&lt;Support&gt;'));assert.ok(!m.html.includes('$0'));assert.ok(m.html.includes('lang="en"'));assert.ok(m.subject.includes('weekly'));assert.ok(m.headers['List-Unsubscribe-Post']);assert.ok(m.text.includes('Unsubscribe:'));assert.throws(()=>alertMessage(config,person,'2026-10-12',''));
});
test('delivery is inert by default and requires legacy handoff',async()=>{
 assert.deepEqual(await runJobAlerts({}),{status:'disabled'});
 assert.deepEqual(await runJobAlerts({JOB_ALERTS_MODE:'enabled'}),{status:'configuration_blocked'});
});
test('provider retries use frozen payload and stable key; unknown outcomes never log member information',async()=>{
 const d={id:uid,day:'2026-10-12',items:[item]},calls=[],requests=[];
 globalThis.fetch=async()=>Response.json([{id:1}]);
 const call=async(c,n,b)=>{calls.push([n,b]);if(n==='check_job_alert')return person;if(n==='freeze_job_alert')return b.p_payload;return true;};
 const request=async(url,init)=>{requests.push(init);return new Response(null,{status:429});};
 const env={JOB_ALERTS_SENDER_ADDRESS:'Address',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',RESEND_API_KEY:'test'};
 assert.equal(await processJobAlert(env,config,d,uid,{call,request}),'retry');
 d.payload=calls.find(x=>x[0]==='freeze_job_alert')[1].p_payload;
 assert.equal(await processJobAlert(env,config,d,uid,{call,request}),'retry');
 assert.equal(requests[0].headers['Idempotency-Key'],requests[1].headers['Idempotency-Key']);assert.equal(requests[0].body,requests[1].body);
 assert.equal(calls.at(-1)[1].p_error,'transient_or_unknown_outcome');
});
test('changed eligibility prevents provider call',async()=>{
 let sent=0;
 const result=await processJobAlert({},config,{id:uid},uid,{call:async(c,n)=>n==='check_job_alert'?{error:'recipient_ineligible'}:true,request:async()=>{sent++;}});
 assert.equal(result,'held');assert.equal(sent,0);
});
test('signed webhook rejects tampering, expired events and invalid secrets',async()=>{
 const body='{"type":"email.bounced"}',ts=String(Math.floor(Date.now()/1000)),id='event_1',secretBytes=new TextEncoder().encode('12345678901234567890123456789012');
 const base64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
 const secret='whsec_'+base64(secretBytes),key=await crypto.subtle.importKey('raw',secretBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=base64(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(id+'.'+ts+'.'+body)));
 const h=new Headers({'svix-id':id,'svix-timestamp':ts,'svix-signature':'v1,'+sig});
 assert.equal(await verifyResendEvent(h,body,secret),true);assert.equal(await verifyResendEvent(h,body+' ',secret),false);assert.equal(await verifyResendEvent(h,body,secret,Date.now()+600000),false);
});

test('webhook is routed without requiring member authentication',async()=>{
 const {handle}=await import('../src/worker.js');const r=await handle(new Request('https://veeays.test/webhooks/job-alerts',{method:'POST',body:'{}'}),{});assert.equal(r.status,401);
});
