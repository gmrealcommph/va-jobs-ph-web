import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {jobAlertsTest,TEST_ID} from '../src/job-alerts-test.js';
const token='a'.repeat(64),tokenHash=createHash('sha256').update(token).digest('hex');
const env={JOB_ALERTS_MODE:'disabled',SUPABASE_URL:'https://test.supabase.co',SITE_URL:'https://veeays.com',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test',RESEND_API_KEY:'secret',JOB_ALERTS_WEBHOOK_SECRET:'secret',JOB_ALERTS_SENDER_ADDRESS:'Address'};
const req=(options={})=>new Request('https://veeays.com/internal/job-alerts-test',{method:'POST',headers:{authorization:'Bearer '+token},...options});
const options={tokenHash,now:Date.parse('2026-10-19T15:00Z')};
test('authentication, expiry, mode and recipient override fail before claim or send',async()=>{
 const blocked=async()=>{throw Error('must not call');};
 for(const [r,e,status,extra]of [[req({headers:{}}),env,401,{}],[req({headers:{authorization:'Bearer '+'b'.repeat(64)}}),env,401,{}],[req(),{...env,JOB_ALERTS_MODE:'enabled'},409,{}],[req({body:'{"to":"other@example.com"}'}),env,400,{}],[req({headers:{authorization:'Bearer '+token,origin:'https://veeays.com'}}),env,400,{}],[req(),env,409,{now:Date.parse('2026-10-20T00:00Z')}]])assert.equal((await jobAlertsTest(r,e,{...options,...extra,store:blocked,send:blocked})).status,status);
});
test('concurrent calls commit one durable claim and send exactly one locked message',async()=>{
 let consumed=false,calls=0,payload;
 const store=async(c,t,f,init)=>{if(init.method==='PATCH')return null;if(consumed)throw Error();consumed=true;return [{id:TEST_ID}];};
 const send=async(url,init)=>{assert.equal(consumed,true);calls++;payload=JSON.parse(init.body);assert.equal(init.headers['Idempotency-Key'],TEST_ID);return Response.json({id:'provider-test'});};
 const results=await Promise.all([jobAlertsTest(req(),env,{...options,store,send}),jobAlertsTest(req(),env,{...options,store,send})]);
 assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);assert.equal(calls,1);assert.deepEqual(payload.to,['support@veeays.com']);assert.equal(payload.cc,undefined);assert.equal(payload.bcc,undefined);
});
test('uncertain provider or database outcome never permits another attempt',async()=>{
 let consumed=false,calls=0;
 const store=async()=>{if(consumed)throw Error();consumed=true;return [{id:TEST_ID}];};
 const send=async()=>{calls++;throw Error('timeout secret');};
 const first=await jobAlertsTest(req(),env,{...options,store,send});assert.equal(first.status,502);assert.ok(!(await first.text()).includes('secret'));
 assert.equal((await jobAlertsTest(req(),env,{...options,store,send})).status,409);assert.equal(calls,1);
 const uncertainStore=async()=>{throw Error('DB response lost');};
 assert.equal((await jobAlertsTest(req(),env,{...options,store:uncertainStore,send})).status,409);assert.equal(calls,1);
});
