import test from 'node:test';import assert from 'node:assert/strict';
import {jobHealthEndpoint} from '../src/job-health.js';
import {sourceEvidence,reviewDecision,readSource,allowedURL,boardURL} from '../src/job-verification.js';
import {detail} from '../src/render.js';
import {scheduledJobHealth,JOB_HEALTH_CRON} from '../src/job-health-scheduled.js';
import {sourceReader} from '../src/job-verification.js';
const env={JOB_REPORTS_ENABLED:'true'},state={user:{id:'member'},accessToken:'verified-token'},session=async()=>state,job=async()=>({id:1,title:'Support <script>',company:'Employer'});
const req=(path,form,origin='https://veeays.com')=>new Request('https://veeays.com'+path,form?{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(form)}:{});
test('reports require authentication, explicit enablement and strict same origin',async()=>{
 assert.equal((await jobHealthEndpoint(req('/jobs/1/report'),{},{session,job})).status,503);
 assert.equal((await jobHealthEndpoint(req('/jobs/1/report'),env,{session:async()=>({}),job})).status,303);
 for(const origin of ['https://evil.example','null',''])assert.equal((await jobHealthEndpoint(req('/jobs/1/report',{category:'closed_filled'},origin),env,{session,job,call:()=>assert.fail()})).status,403);
});
test('report form escapes job details and valid submission redirects without changing jobs',async()=>{
 const html=await(await jobHealthEndpoint(req('/jobs/1/report'),env,{session,job})).text();assert.match(html,/Support &lt;script&gt;/);assert.match(html,/Closed or filled/);assert.match(html,/Suspicious/);assert.match(html,/Inaccurate/);
 const calls=[];const r=await jobHealthEndpoint(req('/jobs/1/report',{category:'broken_link',details:'Link failed'}),env,{session,job,call:async(e,t,n,p)=>{calls.push({t,n,p});return {accepted:true};}});
 assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/jobs/1?reported=1');assert.equal(calls[0].t,'verified-token');assert.equal(calls[0].n,'veeays_report_job');assert.equal(calls[0].p.p_job_id,'1');
});
test('invalid, oversized and honeypot reports never call database',async()=>{
 for(const form of [{category:'other'},{category:'suspicious',website:'spam'},{category:'inaccurate',details:'x'.repeat(1001)}])assert.equal((await jobHealthEndpoint(req('/jobs/1/report',form),env,{session,job,call:()=>assert.fail()})).status,400);
 assert.equal((await jobHealthEndpoint(req('/jobs/1/report',{details:'x'.repeat(17000)}),env,{session,job,call:()=>assert.fail()})).status,413);
});
test('admin routes authorize every action and reject hide operations',async()=>{
 assert.equal((await jobHealthEndpoint(req('/admin/api/job-health'),env,{session,call:async()=>false})).status,403);
 const calls=[];const call=async(e,t,n,p)=>{calls.push(n);return n==='veeays_admin_access'?true:{metrics:{},queue:[]};};
 assert.equal((await jobHealthEndpoint(req('/admin/api/job-health?filter=missing'),env,{session,call})).status,200);assert.deepEqual(calls,['veeays_admin_access','veeays_job_health']);
 assert.equal((await jobHealthEndpoint(req('/admin/api/job-health',{job_id:'1',action:'hide',reason:'Old job',revision:'0'}),env,{session,call})).status,400);
});
test('report throttling and stale review conflicts surface useful status codes',async()=>{
 for(const status of [429,409,503]){const call=async(e,t,n)=>{if(n==='veeays_admin_access')return true;throw Object.assign(Error(),{status});};const r=await jobHealthEndpoint(req('/jobs/1/report',{category:'closed_filled'}),env,{session,job,call});assert.equal(r.status,status);if(status===429)assert.equal(r.headers.get('retry-after'),'60');}
});
test('generic HTTP 200, malformed boards, missing jobs and updates alone are never date proof',async()=>{
 const j={source:'greenhouse',source_job_id:'123',source_board:'test'};
 assert.equal(sourceEvidence(j,{ok:true,text:'<html>200</html>'}).status,'unknown');
 assert.equal(sourceEvidence(j,{ok:true,text:'{"jobs":[]}'}).status,'unknown');
 assert.equal(sourceEvidence(j,{ok:true,text:JSON.stringify({jobs:[{id:456,absolute_url:'https://job-boards.greenhouse.io/test/jobs/456'}]})}).reason,'not_found_in_board');
 const ev=sourceEvidence(j,{ok:true,text:JSON.stringify({jobs:[{id:123,updated_at:'2020-01-01',absolute_url:'https://job-boards.greenhouse.io/test/jobs/123'}]})});assert.equal(ev.status,'open');assert.equal(ev.original_posted_at,null);
 assert.equal(reviewDecision({},ev).would_hide,false);
});
test('verification blocks arbitrary URLs and redirects; outages preserve unknown',async()=>{
 for(const url of ['http://api.lever.co','https://127.0.0.1','https://api.lever.co.evil.example','https://user@api.lever.co','https://api.lever.co:444'])assert.equal(allowedURL(url),null);
 assert.equal((await readSource('https://api.lever.co/x',async()=>new Response('',{status:302,headers:{location:'https://127.0.0.1'}}))).reason,'unsupported_redirect');
 assert.equal((await readSource('https://api.lever.co/x',async()=>new Response('',{status:503}))).reason,'source_unavailable');
 assert.equal((await readSource('https://api.lever.co/x',async()=>new Response('<title>Just a moment</title>'))).reason,'source_challenge');
 assert.equal((await readSource('https://api.lever.co/x',async()=>new Response('<script src="recaptcha.js"></script>'))).ok,true);
 assert.equal(boardURL({source:'ashby',source_board:'../../internal'}),null);
});
test('date boundaries, missing dates, evergreen and open evidence cannot hide jobs',()=>{
 const now=new Date('2026-10-12T12:00:00Z');
 for(const [days,reason] of [[30,'recent'],[31,'aging'],[45,'aging'],[46,'over_45_needs_verification']]){const d=reviewDecision({original_posted_at:new Date(now-days*86400000).toISOString()},null,now);assert.equal(d.review_reason,reason);assert.equal(d.would_hide,false);}
 assert.equal(reviewDecision({posted_at:'2020-01-01'},null,now).review_reason,'missing_original_date');
 assert.equal(reviewDecision({original_posted_at:'not-a-date'},null,now).review_reason,'missing_original_date');
 assert.equal(reviewDecision({}, {status:'open',original_posted_at:'2020-01-01'},now).review_reason,'older_but_open');
 assert.equal(reviewDecision({original_posted_at:'2030-01-01'},null,now).would_hide,false);
 const j={id:1,title:'Support',company:'Employer'};assert.doesNotMatch(detail(j),/Report this job/);assert.match(detail(j,{reportsEnabled:true}),/\/jobs\/1\/report/);
});
test('scheduled verification is opt-in, isolated from other crons and records evidence only',async()=>{
 const calls=[],j={id:1,source:'lever',source_board:'test',source_job_id:'11111111-1111-4111-8111-111111111111',job_url:'https://jobs.lever.co/test/11111111-1111-4111-8111-111111111111'};
 const call=async(e,n,p)=>{calls.push({n,p});return n==='veeays_job_health_candidates'?[j]:true;};
 await scheduledJobHealth({cron:JOB_HEALTH_CRON},{},{call});await scheduledJobHealth({cron:'* * * * *'},{JOB_HEALTH_VERIFY_ENABLED:'true'},{call});assert.equal(calls.length,0);
 const read=async url=>({ok:true,status:200,text:url.includes('api.lever')?JSON.stringify({id:j.source_job_id,applyUrl:j.job_url}):'<html>application</html>'});
 await scheduledJobHealth({cron:JOB_HEALTH_CRON},{JOB_HEALTH_VERIFY_ENABLED:'true'},{call,read,log:()=>{}});
 assert.deepEqual(calls.map(x=>x.n),['veeays_job_health_candidates','veeays_job_health_observation']);assert.equal(calls[1].p.p_status,'open');
});
test('rate limits stop further requests to the same host, without calling jobs closed',async()=>{
 let requests=0;const read=sourceReader(async()=>{requests++;return new Response('',{status:429});});
 assert.equal((await read('https://api.lever.co/one')).status,429);assert.equal((await read('https://api.lever.co/two')).reason,'source_rate_limited');assert.equal(requests,1);
});
