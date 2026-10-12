import test from 'node:test';
import assert from 'node:assert/strict';
import {quotaLevel,emailUsage,actionCenter} from '../src/admin-health.js';
import {scheduledAdminHealth} from '../src/admin-monitor.js';
import {initTheme} from '../public/admin-theme.js';
import {adminEndpoint} from '../src/admin.js';
test('quota boundaries include exact 70, 90 and 100 percent and uncapped/unknown',()=>{
 for(const [used,level] of [[69,'normal'],[70,'warning'],[89,'warning'],[90,'high'],[99,'high'],[100,'critical'],[101,'critical']])assert.equal(quotaLevel(used,100),level);
 assert.equal(quotaLevel(90,null),'uncapped');assert.equal(quotaLevel(-1,100),'unknown');assert.equal(quotaLevel(1,0),'unknown');
});
test('usage reads actual provider quota and rejects malformed/error data without exposing key',async()=>{
 const env={RESEND_USAGE_KEY:'private-test'};
 const q={used:2100,limit:3000,resets_at:'2026-11-01T00:00:00Z'};
 const result=await emailUsage(env,{request:async(url,options)=>{assert.equal(url,'https://api.resend.com/usage');assert.equal(options.headers.Authorization,'Bearer private-test');return Response.json({emails:{daily:{...q,used:91,limit:100},monthly:q}});}});
 assert.equal(result.daily.level,'high');assert.equal(result.monthly.level,'warning');assert.ok(!JSON.stringify(result).includes('private-test'));
 for(const response of [Response.json({}),new Response('',{status:403})])assert.equal((await emailUsage(env,{request:async()=>response})).available,false);
 assert.equal((await emailUsage({},{request:()=>assert.fail()})).reason,'not_connected');
});
test('Action Center deduplicates sources, ranks severity, uses only internal links',()=>{
 const data={email_health:{usage:{daily:{level:'critical',used:100,limit:100}}},imports:[{source:'lever'}, {source:'lever'}],quick_period:{errors:3}};
 const actions=actionCenter(data);assert.equal(actions.length,3);assert.equal(actions[0].severity,'critical');assert.ok(actions.every(a=>a.href.startsWith('#')));
});
test('background monitor stays disabled and never depends on sending email',async()=>{
 await scheduledAdminHealth({cron:'*/15 * * * *'},{},{usage:()=>assert.fail(),request:()=>assert.fail()});
});
test('monitor respects durable lease dedup and acknowledges only successful delivery',async()=>{
 const env={ADMIN_HEALTH_MONITOR_ENABLED:'true',ADMIN_ALERT_WEBHOOK_URL:'https://alerts.example.test/health',ADMIN_ALERT_WEBHOOK_TOKEN:'private'};
 let ack=0,sends=0,claim='token';
 const deps={usage:async()=>({available:true,daily:{level:'critical',used:100,limit:100,resets_at:'2026-10-09T00:00:00Z'},monthly:{level:'normal'}}),call:async(e,name)=>name==='veeays_admin_claim_alert'?claim:(ack++,true),request:async(url,options)=>{sends++;assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer private');return new Response('',{status:200});},log:()=>{}};
 await scheduledAdminHealth({cron:'*/15 * * * *'},env,deps);assert.equal(ack,1);assert.equal(sends,1);
 claim=null;await scheduledAdminHealth({cron:'*/15 * * * *'},env,deps);assert.equal(sends,1);
 claim='token';deps.request=async()=>new Response('',{status:503});await scheduledAdminHealth({cron:'*/15 * * * *'},env,deps);assert.equal(ack,1);
});
test('theme persists, follows system changes, and survives blocked storage',()=>{
 let change,systemChange;const select={value:'',addEventListener(n,fn){change=fn;}},doc={documentElement:{dataset:{}},getElementById:()=>select};
 const media={matches:true,addEventListener(n,fn){systemChange=fn;}};let stored='system';
 initTheme(doc,{matchMedia:()=>media,localStorage:{getItem:()=>stored,setItem:(k,v)=>stored=v}});
 assert.equal(doc.documentElement.dataset.theme,'dark');media.matches=false;systemChange();assert.equal(doc.documentElement.dataset.theme,'light');select.value='dark';change();assert.equal(stored,'dark');systemChange();assert.equal(doc.documentElement.dataset.theme,'dark');
 initTheme(doc,{matchMedia:()=>media,localStorage:{getItem(){throw Error();},setItem(){throw Error();}}});select.value='light';change();assert.equal(doc.documentElement.dataset.theme,'light');
});
test('reference design defaults to cream when no appearance preference is saved',()=>{
 const select={value:'',addEventListener(){}},doc={documentElement:{dataset:{}},getElementById:()=>select};
 initTheme(doc,{matchMedia:()=>({matches:true,addEventListener(){}}),localStorage:{getItem:()=>null}});
 assert.equal(doc.documentElement.dataset.theme,'light');assert.equal(select.value,'light');
});
test('extended data authorization denial fails closed and no integration credentials enter responses',async()=>{
 const r=await adminEndpoint(new Request('https://veeays.com/admin/api/analytics'),{}, {
 session:async()=>({user:{id:'extended-denial'},accessToken:'token'}),
 call:async(e,t,name)=>{if(name==='veeays_admin_access')return true;if(name==='veeays_admin_analytics')return {};throw Object.assign(Error('private-provider-detail'),{status:403});},visitors:async()=>({available:false}),usage:()=>assert.fail('Denied request cannot fetch quota')});
 assert.equal(r.status,403);assert.ok(!(await r.text()).includes('private-provider-detail'));
});
test('authorized refresh flooding is bounded and throttled calls do not retrieve metrics',async()=>{
 let metrics=0;const deps={session:async()=>({user:{id:'rate-fixture'},accessToken:'token'}),call:async(e,t,name)=>{if(name==='veeays_admin_access')return true;if(name==='veeays_admin_analytics')metrics++;return {};},visitors:async()=>({available:false}),usage:async()=>({available:false})};
 for(let i=0;i<30;i++)assert.equal((await adminEndpoint(new Request('https://veeays.com/admin/api/analytics'),{},deps)).status,200);
 const r=await adminEndpoint(new Request('https://veeays.com/admin/api/analytics'),{},deps);assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'60');assert.equal(metrics,30);
});
