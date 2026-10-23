import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ActiveVisitors} from '../src/active-visitors.js';
import {recordCompletion,toolCompletionCounts,resumeCompletionEndpoint} from '../src/tool-completions.js';
import {completionReporter} from '../public/resume-completion.js';
import {completionCards} from '../public/admin-tool-completions.js';
import {adminEndpoint} from '../src/admin.js';
function storage(){const db=new DatabaseSync(':memory:');let alarm=null;const ctx={storage:{sql:{exec(query,...args){const stmt=db.prepare(query),rows=stmt.all(...args);return {one:()=>rows[0],toArray:()=>rows};}},transactionSync(fn){db.exec('BEGIN');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}},getAlarm:async()=>alarm,setAlarm:async value=>{alarm=value;}}};let object=new ActiveVisitors(ctx);return {db,ctx,restart:()=>object=new ActiveVisitors(ctx),env:{ACTIVE_VISITORS:{getByName:name=>{assert.equal(name,'tool-completions-v1');return {fetch:(url,init)=>object.fetch(new Request(url,init))};}}},get object(){return object;}};}
test('durable totals count completions once, survive re-instantiation, and expire only dedupe references',async()=>{
 const f=storage(),id=crypto.randomUUID(),old=Date.now;let now=1800000000000;Date.now=()=>now;
 try{await Promise.all([recordCompletion(f.env,'niche_finder',id),recordCompletion(f.env,'niche_finder',id)]);await recordCompletion(f.env,'resume_studio',id);f.restart();let totals=await toolCompletionCounts(f.env);assert.equal(totals.niche_finder,1);assert.equal(totals.resume_studio,1);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM tool_receipts').get().n,2);now+=86400001;await f.object.alarm();assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM tool_receipts').get().n,0);totals=await toolCompletionCounts(f.env);assert.equal(totals.niche_finder,1);assert.equal(totals.resume_studio,1);}finally{Date.now=old;f.db.close();}
});
test('a failed total increment rolls back its receipt and can be retried',async()=>{
 const f=storage(),exec=f.ctx.storage.sql.exec;let fail=true;f.ctx.storage.sql.exec=(q,...a)=>{if(fail&&q.startsWith('INSERT INTO tool_totals'))throw Error('storage unavailable');return exec(q,...a);};const id=crypto.randomUUID();try{assert.equal(await recordCompletion(f.env,'resume_studio',id),false);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM tool_receipts').get().n,0);fail=false;assert.equal(await recordCompletion(f.env,'resume_studio',id),true);assert.equal((await toolCompletionCounts(f.env)).resume_studio,1);}finally{f.db.close();}
});
test('public endpoint rejects content, forged tools, malformed ids and cross-site posts; unavailable is not zero',async()=>{
 let calls=0;const env={ACTIVE_VISITORS:{getByName:()=>({fetch:async()=>{calls++;return Response.json({recorded:true});}})}};
 const req=(body,extra={})=>new Request('https://veeays.test/tools/resume-completed',{method:'POST',headers:{origin:'https://veeays.test','content-type':'application/json','user-agent':'Mozilla/5.0',...extra},body:JSON.stringify(body)});
 assert.equal((await resumeCompletionEndpoint(req({id:crypto.randomUUID()}),env)).status,200);assert.equal(calls,1);
 for(const b of [{id:'bad'},{id:crypto.randomUUID(),tool:'niche_finder'},{id:crypto.randomUUID(),name:'Never send résumé fields'}])assert.equal((await resumeCompletionEndpoint(req(b),env)).status,400);
 assert.equal((await resumeCompletionEndpoint(req({id:crypto.randomUUID()},{origin:'https://evil.test'}),env)).status,403);
 for(const h of [{dnt:'1'},{'sec-gpc':'1'},{'user-agent':'Googlebot'}])await resumeCompletionEndpoint(req({id:crypto.randomUUID()},h),env);
 assert.equal(calls,1);assert.deepEqual(await toolCompletionCounts({}),{available:false});assert.equal((await resumeCompletionEndpoint(req({id:crypto.randomUUID()}),{})).status,503);
});
test('browser reporter sends only an ephemeral id, retries a failed report, and deduplicates review/export',async()=>{
 const requests=[],draft={name:'Private person',email:'private@example.test',resume:'Private text'};let fail=true;const reporter=completionReporter({uuid:()=> 'c6d97683-ef5d-4b45-a2b2-1dd12c515f48',send:async(url,init)=>{requests.push({url,...init});return {ok:!fail};}});
 await reporter(draft);fail=false;await Promise.all([reporter(draft),reporter(draft)]);await reporter(draft);assert.equal(requests.length,2);assert.equal(requests[0].body,requests[1].body);assert.deepEqual(JSON.parse(requests[0].body),{id:'c6d97683-ef5d-4b45-a2b2-1dd12c515f48'});assert.equal(requests[0].credentials,'omit');assert.doesNotMatch(JSON.stringify(requests),/Private|private@example/);await reporter({});assert.equal(requests.length,3);
});
test('counts are queried only after admin authorization, and render zero separately from unavailable',async()=>{
 let queries=0;const options={session:async()=>({user:{id:'completion-admin'},accessToken:'verified'}),call:async(e,t,name)=>name==='veeays_admin_access'?false:{},completions:async()=>{queries++;return {available:true,niche_finder:2,resume_studio:3};}};
 const req=new Request('https://veeays.test/admin/api/analytics');assert.equal((await adminEndpoint(req,{},options)).status,403);assert.equal(queries,0);options.call=async(e,t,name)=>name==='veeays_admin_access'?true:{};const r=await adminEndpoint(req,{},options);assert.equal(r.status,200);assert.equal((await r.json()).tool_completions.niche_finder,2);assert.equal(queries,1);assert.match(completionCards({available:true,niche_finder:0,resume_studio:0}),/>0</);assert.match(completionCards({available:false}),/Unavailable/);
});

test('daily series uses Manila midnight and dedupes within the same atomic transaction',async()=>{
 const f=storage(),old=Date.now;let now=Date.parse('2026-10-23T15:59:00Z');Date.now=()=>now;
 try{const id=crypto.randomUUID();await recordCompletion(f.env,'niche_finder',id);await recordCompletion(f.env,'niche_finder',id);now+=120000;await recordCompletion(f.env,'resume_studio',crypto.randomUUID());const result=await toolCompletionCounts(f.env);assert.deepEqual(result.daily,[{day:'2026-10-23',tool:'niche_finder',total:1},{day:'2026-10-24',tool:'resume_studio',total:1}]);now+=86400001;await f.object.alarm();assert.equal((await toolCompletionCounts(f.env)).daily.length,2);
 const html=completionCards(result);assert.match(html,/completion-chart/);assert.match(html,/niche-series/);assert.match(html,/resume-series/);assert.match(html,/Date \(Manila\)/);assert.doesNotMatch(html,/NaN|undefined/);
 }finally{Date.now=old;f.db.close();}
});
