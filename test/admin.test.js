import test from 'node:test';
import assert from 'node:assert/strict';
import {adminEndpoint,period,adminPage} from '../src/admin.js';
import {handle} from '../src/worker.js';
const user={id:'admin-id'},token='verified-session';
const session=async()=>({user,accessToken:token});
const req=(path='/admin',method='GET')=>new Request('https://veeays.com'+path,{method});
test('dashboard puts business totals and actions before details and preserves section destinations',()=>{
  const html=adminPage();
  const ids=['overview','action-center','collection-panel','members','marketing','payments','operations','imports','email-health','provider-usage','trends','system-health'];
  let previous=-1;
  for(const id of ids){const matches=[...html.matchAll(new RegExp('id="'+id+'"','g'))];assert.equal(matches.length,1,id);assert.ok(matches[0].index>previous,id);previous=matches[0].index;}
  for(const id of ['filters','period','start','end','signup-chime','quick-live','collection-health','charts','payment-table','import-table'])assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1,id);
  assert.doesNotMatch(html,/id="auto-refresh"|class="refresh-settings"|id="section-search"|Admin workspace/);assert.match(html,/<details class="dashboard-details">/);
});
test('anonymous page redirects to login without querying metrics',async()=>{
  const r=await adminEndpoint(req(),{},{session:async()=>({user:null}),call:()=>assert.fail('No data query allowed')});
  assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/login?return=%2Fadmin');
  assert.match(r.headers.get('cache-control'),/no-store/);
});
test('anonymous API is 401 and never queries metrics',async()=>{
  const r=await adminEndpoint(req('/admin/api/analytics'),{},{session:async()=>({user:null}),call:()=>assert.fail()});
  assert.equal(r.status,401);
});
test('regular member cannot retrieve the page or analytics',async()=>{
  for(const path of ['/admin','/admin/api/analytics']){
    const calls=[];
    const r=await adminEndpoint(req(path),{},{session,call:async(e,t,n)=>{calls.push(n);return false;}});
    assert.equal(r.status,403);assert.deepEqual(calls,['veeays_admin_access']);
  }
});
test('verified admin gets page and no credentials enter HTML',async()=>{
  const r=await adminEndpoint(req(),{SUPABASE_SERVICE_ROLE_KEY:'never-expose'},{session,call:async()=>true});
  const html=await r.text();
  assert.equal(r.status,200);assert.match(html,/admin.js/);assert.match(html,/veeays-logo.png/);
  assert.doesNotMatch(html,/never-expose|verified-session/);
  assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
test('analytics uses user token and validated date inputs',async()=>{
  const calls=[];
  const r=await adminEndpoint(req('/admin/api/analytics?start=2026-10-01&end=2026-10-07'),{QUICK_READ_AUTO_ENABLED:'true'},{session,call:async(e,t,n,b)=>{calls.push({t,n,b});return n==='veeays_admin_access'?true:{members:11};}});
  assert.equal(r.status,200);assert.equal(calls[1].t,token);
  assert.deepEqual(calls[1].b,{p_start:'2026-10-01',p_end:'2026-10-07'});
  assert.equal((await r.json()).runtime.quick_read_enabled,true);
});
test('methods and unknown admin routes cannot invoke mutations',async()=>{
  assert.equal((await adminEndpoint(req('/admin','POST'),{},{session,call:()=>assert.fail()})).status,405);
  assert.equal((await adminEndpoint(req('/admin/unknown'),{},{session,call:()=>assert.fail()})).status,404);
});
test('registration snapshot uses the same verified session and outage does not break metrics',async()=>{
 const calls=[];
 const r=await adminEndpoint(req('/admin/api/analytics'),{},{session,call:async(e,t,n)=>{
   calls.push({t,n});if(n==='veeays_admin_access')return true;
   if(n==='veeays_admin_analytics')return {members:11};
   throw Object.assign(new Error('Unavailable'),{status:503});
 }});
 assert.equal(r.status,200);assert.equal((await r.json()).registrations.available,false);
 assert.equal(calls.find(c=>c.n==='veeays_admin_registration_snapshot').n,'veeays_admin_registration_snapshot');assert.equal(calls.at(-1).t,token);
});
test('registration authorization failure cannot be downgraded to an integration outage',async()=>{
 const r=await adminEndpoint(req('/admin/api/analytics'),{},{session,call:async(e,t,n)=>{
   if(n==='veeays_admin_access')return true;if(n==='veeays_admin_analytics')return {};
   throw Object.assign(new Error('Forbidden'),{status:403});
 }});
 assert.equal(r.status,403);
});
test('auth and database outages fail closed without raw errors',async()=>{
  for(const path of ['/admin','/admin/api/analytics']){
    const r=await adminEndpoint(req(path),{},{session,call:async()=>{throw new Error('secret-database-error');}});
    assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/secret-database-error/);
  }
});
test('Manila period switches dates at UTC 16:00',()=>{
  const r=period(new URLSearchParams('days=1'),new Date('2026-10-07T16:30:00Z'));
  assert.deepEqual(r,{p_start:'2026-10-08',p_end:'2026-10-08'});
});
test('invalid dates, future dates and unbounded ranges are rejected',()=>{
  const now=new Date('2026-10-08T10:00:00Z');
  for(const p of ['start=2026-02-30&end=2026-03-01','start=2026-01-01&end=2026-10-08','start=2026-10-08&end=2026-10-07','days=999','end=2099-01-01']){
    assert.throws(()=>period(new URLSearchParams(p),now));
  }
});
test('Worker routes admin before public rendering',async()=>{
  const r=await handle(req(),{});
  assert.equal(r.status,303);assert.match(r.headers.get('location'),/login/);
});
test('continuous polling expires core and extended snapshots instead of keeping stale totals alive',async()=>{
 const oldFetch=globalThis.fetch,oldNow=Date.now;let now=Date.now(),coreCalls=0,extendedCalls=0;
 const fixtureEnv={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'};
 globalThis.fetch=async(input)=>{
  const name=new URL(input).pathname.split('/').pop();
  return Response.json(name==='veeays_admin_access'?true:name==='veeays_admin_analytics'?{members:++coreCalls}:name==='veeays_admin_extended'?{available:true,sequence:++extendedCalls}:{available:false});
 };
 Date.now=()=>now;
 const get=async()=>{
  const response=await adminEndpoint(req('/admin/api/analytics?start=2026-10-02&end=2026-10-08'),fixtureEnv,{session:async()=>({user:{id:'ttl-fixture'},accessToken:'verified-session'}),visitors:async()=>({available:false}),usage:async()=>({available:false})});
  assert.equal(response.status,200);return response.json();
 };
 try{
  assert.equal((await get()).members,1);now+=30000;assert.equal((await get()).members,1);
  now+=31000;const fresh=await get();assert.equal(fresh.members,2);assert.equal(fresh.extended.sequence,2);
  assert.equal(coreCalls,2);assert.equal(extendedCalls,2);
 }finally{globalThis.fetch=oldFetch;Date.now=oldNow;}
});


test('independent analytics integrations start together and provider failure preserves core totals',async()=>{
 const started=new Set();let release;
 const gate=new Promise(resolve=>release=resolve);
 const optional=async name=>{started.add(name);await gate;if(name==='visitors')throw Error('Provider timeout');return {available:true};};
 const response=adminEndpoint(req('/admin/api/analytics'),{}, {session,
 call:async(e,t,n)=>n==='veeays_admin_access'?true:n==='veeays_admin_analytics'?{members:23}:optional(n),
 visitors:()=>optional('visitors'),usage:()=>optional('usage'),balances:()=>optional('balances')});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(started.size,5);release();
 const result=await response;assert.equal(result.status,200);const data=await result.json();assert.equal(data.members,23);assert.equal(data.visitors.available,false);
});
