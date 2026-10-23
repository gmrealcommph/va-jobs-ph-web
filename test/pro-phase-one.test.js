import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proAiEndpoint,validateAiResult} from '../src/pro-ai.js';
import {ProAiBudget,digest} from '../src/pro-ai-budget.js';
import {remindersEndpoint,calendarReminder,reminderPanel} from '../src/application-reminders.js';
import {selectedJob} from '../public/pro-tools.js';
const sections={summary:'I support customers with clear written communication and keep accurate records of every request.',experience:'Answered customer questions and maintained a shared support guide.',skills:'Customer support and documentation',education:'',projects:''};
const member={user:{id:'phase-one-member'},accessToken:'test-only'};
const pro={plan:'pro',plan_status:'active',pro_expires_at:'2099-01-01'};
const req=(tool='optimize',body={sections,consent:true},origin='https://veeays.test')=>new Request('https://veeays.test/api/pro-tools/'+tool,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
function storage(){const data=new Map();let queue=Promise.resolve();const s={data,get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),delete:async k=>data.delete(k),list:async({prefix})=>new Map([...data].filter(([k])=>k.startsWith(prefix))),getAlarm:async()=>null,setAlarm:async()=>{},transaction(fn){const call=queue.then(()=>fn(s));queue=call.catch(()=>{});return call;}};return s;}
const config={PRO_AI_ENABLED:'true',PRO_AI_SPENDING_AUTHORIZED:'true',PRO_AI_MODEL:'gpt-5-mini',PRO_AI_MAX_CALL_MICRO_USD:'100000',PRO_AI_DAILY_MICRO_USD:'300000',PRO_AI_TOTAL_MICRO_USD:'600000',PRO_AI_CACHE_KEY:'a'.repeat(64),PRO_AI_KEY:'test-only-not-a-provider-key'};
const deps={session:async()=>member,profile:async()=>pro,job:async()=>({id:1,title:'Support Assistant',company:'Fixture',description:'Support customers.'}),send:async()=>{throw Error('Provider must not run');}};
test('AI routes enforce identity, protected Pro status, consent, bounds, origin and disabled spending before provider access',async()=>{
 assert.equal((await proAiEndpoint(req(),{}, {...deps,session:async()=>({})})).status,401);
 for(const p of [{plan:'free'},{...pro,plan_status:'inactive'},{...pro,pro_expires_at:'2000-01-01'},{...pro,pro_expires_at:'invalid'}])assert.equal((await proAiEndpoint(req(),{}, {...deps,profile:async()=>p})).status,403);
 assert.equal((await proAiEndpoint(req('optimize',{},'https://evil.test'),{},deps)).status,403);
 assert.equal((await proAiEndpoint(req('optimize',{sections,consent:false}),{},deps)).status,400);
 assert.equal((await proAiEndpoint(req('optimize',{sections:{...sections,name:'Do not transmit'},consent:true}),{},deps)).status,400);
 assert.equal((await proAiEndpoint(req('optimize',{sections:{summary:'x'},consent:true}),{},deps)).status,400);
 assert.equal((await proAiEndpoint(req(),{},deps)).status,503);
 assert.equal((await proAiEndpoint(req('cover-letter'),{},deps)).status,400);
 assert.equal((await proAiEndpoint(req('cover-letter',{sections,job_id:1,consent:true}),{}, {...deps,job:async()=>null})).status,404);
});
test('one global reservation precedes provider; cache reuse avoids another request and data never contains name/contact/photo',async()=>{
 const s=storage(),budget=new ProAiBudget({storage:s},config),env={...config,PRO_AI_BUDGET:{idFromName:()=>1,get:()=>({fetch:(url,init)=>budget.fetch(new Request(url,init))})}};let calls=0;
 const value={suggestions:[{field:'experience',quote:'Answered customer questions',rewrite:'Responded to customer questions',reason:'Lead with a clear action.'}]};
 const send=async(url,init)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');const b=JSON.parse(init.body);assert.equal(b.store,false);assert.equal(b.max_output_tokens,1800);assert.equal(b.text.format.strict,true);assert.equal(s.data.get('global').total,100000);assert.doesNotMatch(b.input,/"name"|"contact"|"photo"/);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});};
 const a=await proAiEndpoint(req(),env,{...deps,send});assert.equal(a.status,200);assert.equal((await a.json()).remaining,9);
 const b=await proAiEndpoint(req(),env,{...deps,send});assert.equal((await b.json()).cached,true);assert.equal(calls,1);assert.doesNotMatch(JSON.stringify([...s.data]),/Answered customer|Responded to customer/);
});
test('durable budget serializes concurrency, enforces cooldown/daily/member/global caps and cleans private cache',async()=>{
 const old=Date.now;let now=1800000000000;Date.now=()=>now;const s=storage(),b=new ProAiBudget({storage:s},config),uid=await digest('one');const reserve=async (who,hash)=>b.fetch(new Request('https://b/reserve',{method:'POST',body:JSON.stringify({uid:who,hash:await digest(hash)})}));
 try{const requests=await Promise.all([reserve(uid,'a'),reserve(uid,'b')]);assert.deepEqual(requests.map(r=>r.status).sort(),[200,429]);now+=61000;assert.equal((await reserve(uid,'c')).status,200);now+=61000;assert.equal((await reserve(uid,'d')).status,200);now+=61000;assert.equal((await reserve(uid,'e')).status,429);assert.equal((await reserve(await digest('two'),'z')).status,503);now+=86400000;assert.equal((await reserve(uid,'f')).status,200);now+=61000;await reserve(uid,'g');now+=61000;await reserve(uid,'h');now+=86400000;assert.equal((await reserve(await digest('three'),'q')).status,503);assert.equal(s.data.get('global').total,600000);await b.alarm();assert.equal([...s.data.keys()].some(k=>k.startsWith('lease:')),false);}finally{Date.now=old;}
});
test('missing or invalid spending configuration fails closed; unknown reservation cannot populate cache',async()=>{
 for(const override of [{PRO_AI_SPENDING_AUTHORIZED:'false'},{PRO_AI_CACHE_KEY:''},{PRO_AI_DAILY_MICRO_USD:'0'},{PRO_AI_MAX_CALL_MICRO_USD:'NaN'}]){const b=new ProAiBudget({storage:storage()},{...config,...override});assert.equal((await b.fetch(new Request('https://b/reserve',{method:'POST',body:'{}'}))).status,503);}
 const b=new ProAiBudget({storage:storage()},config);assert.equal((await b.fetch(new Request('https://b/result',{method:'POST',body:JSON.stringify({uid:'a'.repeat(64),hash:'b'.repeat(64),reservation:crypto.randomUUID(),value:{letter:'x'}})}))).status,409);
});
test('account deletion purges private cache even when AI is paused and prevents delayed results from restoring it',async()=>{
 const s=storage(),uid=await digest('delete-me'),other=await digest('keep-me'),hash=await digest('draft'),reservation=crypto.randomUUID();
 await s.put('cache:'+uid+':'+hash,{until:Date.now()+86400000,data:[1]});await s.put('cache:'+other+':'+hash,{until:Date.now()+86400000,data:[2]});await s.put('lease:'+reservation,{uid,hash,until:Date.now()+60000});await s.put('global',{total:100000});
 const paused=new ProAiBudget({storage:s},{});assert.equal((await paused.fetch(new Request('https://b/purge',{method:'POST',body:JSON.stringify({uid})}))).status,200);
 assert.equal(s.data.has('cache:'+uid+':'+hash),false);assert.equal(s.data.has('cache:'+other+':'+hash),true);assert.equal(s.data.has('lease:'+reservation),false);assert.equal(s.data.get('global').total,100000);
 const active=new ProAiBudget({storage:s},config);assert.equal((await active.fetch(new Request('https://b/reserve',{method:'POST',body:JSON.stringify({uid,hash})}))).status,403);
});
test('review validates source quotes and numeric claims; selected job rejects external URLs',()=>{
 assert.throws(()=>validateAiResult({suggestions:[{field:'skills',quote:'Invented',rewrite:'Expert',reason:'bad'}]},sections,'optimize'));
 assert.throws(()=>validateAiResult({suggestions:[{field:'experience',quote:'Answered customer questions',rewrite:'Increased revenue by 30%',reason:'bad'}]},sections,'optimize'));
 assert.equal(selectedJob('https://veeays.com/jobs/123','https://staging.test'),'123');assert.throws(()=>selectedJob('https://evil.test/jobs/123','https://staging.test'));
});
const reminderRequest=(action='save',extra={})=>new Request('https://veeays.test/application-reminders',{method:'POST',headers:{origin:'https://veeays.test','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({job_id:'123',action,remind_on:'2099-01-01',label:'Follow up',...extra})});
test('reminders use existing identity, enforce Pro writes and retain clear/export after expiry',async()=>{
 const calls=[],d={session:async()=>member,profile:async()=>pro,rest:async(...args)=>{calls.push(args);return [{job_id:123,remind_on:'2099-01-01',label:'Follow up'}];}},env={PRO_TRACKER_ENABLED:'true'};
 assert.equal((await remindersEndpoint(reminderRequest(),env,d)).status,303);assert.equal(calls[0][2],member.user.id);assert.equal(calls[0][5].user_id,member.user.id);
 assert.equal((await remindersEndpoint(reminderRequest(),env,{...d,profile:async()=>({plan:'free'})})).status,403);
 assert.equal((await remindersEndpoint(reminderRequest('clear'),env,{...d,profile:async()=>({plan:'free'})})).status,303);
 assert.equal((await remindersEndpoint(reminderRequest('save',{remind_on:'2099-02-31'}),env,d)).status,400);
 const r=await remindersEndpoint(new Request('https://veeays.test/application-reminders?job_id=123'),env,d);assert.equal(r.headers.get('content-type'),'text/calendar; charset=utf-8');assert.match(await r.text(),/DTSTART;VALUE=DATE:20990101/);
 assert.doesNotMatch(calendarReminder({job_id:123,remind_on:'2099-01-01',label:'hello\nBEGIN:VEVENT'}),/\r\nBEGIN:VEVENT\r\nBEGIN:VEVENT/);
 assert.match(reminderPanel({job_id:123},{available:true,pro:false,rows:[{job_id:123,remind_on:'2020-01-01',label:'<script>'}]}),/Overdue/);
});
