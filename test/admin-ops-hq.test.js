import test from 'node:test';
import assert from 'node:assert/strict';
import {adminEndpoint} from '../src/admin.js';
import {buildOpsHq,opsHqPayload,healthFrom,_resetOpsHqCache} from '../src/admin-ops-hq.js';
import {opsHqPage,OPS_HQ_CSP} from '../src/ops-hq-page.js';
const now=new Date('2026-10-30T04:00:00Z');
const analytics={members:120,live_jobs:50,pro_access:7,daily:[{day:'2026-10-29',members:4,jobs:10},{day:'2026-10-30',members:6,jobs:3}]};
const quick={counts:{queued:5,processing:1,stopped_other:4},all_reads:{ready:90,failed:2},automation:{enabled:true},gate:{enabled:true},oldest_due:'2026-10-30T03:58:00Z',unmatched_running:0,
  recent:[{event:'completed',job_id:1,title:'SECRET TITLE',at:'2026-10-30T03:00:00Z'},{event:'queued',job_id:2,at:'2026-10-30T03:01:00Z'},{event:'failed',job_id:3,at:'2026-10-30T03:02:00Z'}]};
const extended={available:true,members:{expiring_7d:3},email:{accepted_in_period:11}};
const registrations={available:true,events:[{event_id:'a',registered_at:'2026-10-30T02:00:00Z'},{event_id:'a',registered_at:'2026-10-30T02:00:00Z'}]};
const payments={available:true,events:[{event_id:'b',confirmed_at:'2026-10-30T01:00:00Z',amount_minor:19900,currency:'PHP'}]};
const all={analytics,quick,extended,registrations,payments};

test('metrics use only verified sources; unavailable ones are null',()=>{
  const r=buildOpsHq(all,now);
  assert.deepEqual(r.metrics.intake,{new_today:6,total:120,growth_pct:50});
  assert.equal(r.metrics.pro.expiring_7d,3);assert.equal(r.metrics.comms.accepted_today,11);
  assert.equal(r.metrics.reads.ready_total,90);assert.equal(r.metrics.reads.stopped,4);assert.equal(buildOpsHq({},now).metrics.reads.stopped,null);assert.equal(r.metrics.pro.upgrades_today,1);
  for(const [d,k] of [['refer','verified_signups'],['refer','eligible_conversions'],['refer','on_hold'],['comms','delivered_today'],['comms','suppressed_or_bounced_today'],['chief','open'],['chief','done'],['jobs','processing']])
    assert.equal(r.metrics[d][k],null,d+'.'+k);
  const empty=buildOpsHq({},now).metrics;
  assert.equal(empty.intake.total,null);assert.equal(empty.pro.expiring_7d,null);assert.equal(empty.comms.accepted_today,null);
});
test('events: stable ids, deduplicated, sorted, only known types, no personal data',()=>{
  const r=buildOpsHq(all,now),r2=buildOpsHq(all,now);
  assert.deepEqual(r.events.map(e=>e.event_id),r2.events.map(e=>e.event_id));
  assert.equal(new Set(r.events.map(e=>e.event_id)).size,r.events.length);
  assert.deepEqual(r.events.map(e=>e.type),['pro_upgrade','member_registered','quick_read_completed','quick_read_failed']);
  const text=JSON.stringify(r);
  assert.doesNotMatch(text,/SECRET|@|19900|amount|title|email"/i);
  for(const e of r.events)assert.deepEqual(Object.keys(e).sort(),['count','desk','event_id','kind','occurred_at','type']);
});
test('?since is inclusive and invalid since yields no filter in builder',()=>{
  assert.equal(buildOpsHq(all,now,'2026-10-30T03:00:00Z').events.length,2);
  assert.equal(buildOpsHq(all,now,'2026-10-30T03:00:01Z').events.length,1);
});
test('health reflects real checks',()=>{
  assert.deepEqual(healthFrom({failed:0,total:5,quick,now}),{database:'healthy',edge:'healthy',alerts:0});
  assert.equal(healthFrom({failed:2,total:5,quick,now}).database,'warning');
  assert.equal(healthFrom({failed:5,total:5,quick:null,now}).database,'critical');
  const late=(m)=>({...quick,oldest_due:new Date(now.getTime()-m*60000).toISOString()});
  assert.equal(healthFrom({failed:0,total:5,quick:late(15),now}).edge,'warning');
  assert.equal(healthFrom({failed:0,total:5,quick:late(45),now}).edge,'critical');
  assert.equal(healthFrom({failed:0,total:5,quick:{...quick,automation:{enabled:false}},now}).edge,'unknown');
  assert.equal(healthFrom({failed:0,total:5,quick:{...quick,unmatched_running:2},now}).alerts,1);
});
const rpcs={veeays_admin_analytics:analytics,veeays_admin_quick_reads:quick,veeays_admin_extended:extended,veeays_admin_registration_snapshot:registrations,veeays_admin_payment_snapshot:payments};
test('cache tiers: fast 15s, analytics 60s, extended 120s; shared across admins; failures fall back then go stale',async()=>{
  _resetOpsHqCache();const counts={};let fail=new Set();
  const call=async(e,t,name)=>{counts[name]=(counts[name]||0)+1;if(fail.has(name))throw Object.assign(new Error('x'),{status:500});return rpcs[name];};
  const t0=new Date(now),at=(s)=>new Date(t0.getTime()+s*1000);
  await opsHqPayload({},'t',call,null,t0);
  await opsHqPayload({},'other-admin-token',call,null,at(5));
  assert.equal(counts.veeays_admin_quick_reads,1);
  await opsHqPayload({},'t',call,null,at(16));
  assert.equal(counts.veeays_admin_quick_reads,2);assert.equal(counts.veeays_admin_analytics,1);assert.equal(counts.veeays_admin_extended,1);
  await opsHqPayload({},'t',call,null,at(62));
  assert.equal(counts.veeays_admin_analytics,2);assert.equal(counts.veeays_admin_extended,1);
  await opsHqPayload({},'t',call,null,at(122));
  assert.equal(counts.veeays_admin_extended,2);
  fail=new Set(['veeays_admin_registration_snapshot']);
  let p=await opsHqPayload({},'t',call,null,at(140));
  assert.equal(p.metrics.health.database,'warning');assert.equal(p.stale,false);
  assert.ok(p.events.some(e=>e.type==='member_registered'));
  p=await opsHqPayload({},'t',call,null,at(700));
  assert.equal(p.stale,true);assert.ok(!p.events.some(e=>e.type==='member_registered'));
  _resetOpsHqCache();fail=new Set(Object.keys(rpcs));
  await assert.rejects(opsHqPayload({},'t',call,null,t0),{status:503});
  _resetOpsHqCache();
  await assert.rejects(opsHqPayload({},'t',async()=>{throw Object.assign(new Error('x'),{status:401});},null,t0),{status:401});
});
test('concurrent requests share one in-flight refresh per tier',async()=>{
  _resetOpsHqCache();let n=0;
  const call=async(e,t,name)=>{n++;await new Promise(r=>setTimeout(r,20));return rpcs[name];};
  await Promise.all(Array.from({length:10},()=>opsHqPayload({},'t',call,null,now)));
  assert.equal(n,5);   // 3 fast + 1 analytics + 1 extended, once
});
test('stale payload is served from last good data when all sources then fail',async()=>{
  _resetOpsHqCache();let down=false;
  const call=async(e,t,n)=>{if(down)throw Object.assign(new Error('x'),{status:500});return rpcs[n];};
  await opsHqPayload({},'t',call,null,now);down=true;
  const p=await opsHqPayload({},'t',call,null,new Date(now.getTime()+130000));
  assert.equal(p.stale,true);assert.equal(p.metrics.health.database,'critical');assert.equal(p.metrics.intake.total,120);
});
const req=(p,init)=>new Request('https://veeays.com'+p,init);
const sess=async()=>({user:{id:'u'},accessToken:'t'});
const mk=()=>async(e,t,name)=>name==='veeays_admin_access'?true:rpcs[name];
test('API: anonymous 401, non-admin 403, bad since 400, POST 405, headers private',async()=>{
  _resetOpsHqCache();
  assert.equal((await adminEndpoint(req('/admin/api/ops-hq'),{},{session:async()=>({user:null}),call:()=>assert.fail()})).status,401);
  assert.equal((await adminEndpoint(req('/admin/api/ops-hq'),{},{session:sess,call:async()=>false})).status,403);
  assert.equal((await adminEndpoint(req('/admin/api/ops-hq?since=nope'),{},{session:sess,call:mk()})).status,400);
  assert.equal((await adminEndpoint(req('/admin/api/ops-hq',{method:'POST'}),{},{session:sess,call:mk()})).status,405);
  const ok=await adminEndpoint(req('/admin/api/ops-hq'),{},{session:sess,call:mk()});
  assert.equal(ok.status,200);assert.match(ok.headers.get('cache-control'),/no-store/);
  const j=await ok.json();assert.deepEqual(Object.keys(j).sort(),['events','generated_at','has_more','incomplete','metrics','stale']);   // has_more/incomplete are backward-compatible additions
});
test('API: rate limiter blocks over-use',async()=>{
  _resetOpsHqCache();let blocked=0;
  const env={ADMIN_API_LIMITER:{limit:async()=>({success:false})}};
  const r=await adminEndpoint(req('/admin/api/ops-hq'),env,{session:async()=>({user:{id:'rl'},accessToken:'t'}),call:mk()});
  assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'60');
});
test('page: gated, strict CSP, no inline scripts, no third-party hosts',async()=>{
  const anon=await adminEndpoint(req('/admin/ops-hq'),{},{session:async()=>({user:null}),call:()=>assert.fail()});
  assert.equal(anon.status,303);assert.equal(anon.headers.get('location'),'/login?return=%2Fadmin%2Fops-hq');
  const non=await adminEndpoint(req('/admin/ops-hq'),{},{session:sess,call:async()=>false});
  assert.equal(non.status,403);assert.doesNotMatch(await non.text(),/ops-hq\.js|stage/);
  const ok=await adminEndpoint(req('/admin/ops-hq'),{},{session:sess,call:mk()});
  assert.equal(ok.status,200);assert.equal(ok.headers.get('content-security-policy'),OPS_HQ_CSP);
  const html=await ok.text();assert.equal(html,opsHqPage());
  assert.doesNotMatch(html,/<script>|<script[^>]*>[^<]+<\/script>|https?:\/\//);
  assert.match(OPS_HQ_CSP,/script-src 'self';/);assert.doesNotMatch(OPS_HQ_CSP.split('style-src')[0],/unsafe|https?:/);
});

const burst=(n,ts=(i)=>new Date(Date.UTC(2026,9,30,2,0,0)+i*1000).toISOString())=>({available:true,events:Array.from({length:n},(_,i)=>({event_id:'r'+String(i).padStart(3,'0'),registered_at:ts(i)}))});
test('event paging: oldest first, nothing skipped, has_more until drained',()=>{
  const regs=burst(150);const src={analytics,quick:{...quick,recent:[]},extended,registrations:regs,payments:{available:true,events:[]}};
  let since=null;const seen=new Set();let pages=0,more=true;
  while(more&&pages<10){
    const r=buildOpsHq(src,now,since);pages++;
    assert.ok(r.events.length<=60);for(const e of r.events)seen.add(e.event_id);
    more=r.has_more;since=r.events[r.events.length-1].occurred_at;
  }
  assert.equal(seen.size,150);assert.equal(more,false);assert.ok(pages>=3);
  const first=buildOpsHq(src,now);assert.equal(first.events[0].event_id,'reg:r000');assert.equal(first.has_more,true);
  assert.equal(buildOpsHq({...src,registrations:burst(10)},now).has_more,false);
});
test('event paging never splits events that share a timestamp',()=>{
  const same=burst(100,()=>'2026-10-30T02:00:00Z');
  const r=buildOpsHq({analytics,quick:{...quick,recent:[]},registrations:same,payments:{available:true,events:[]}},now);
  assert.equal(r.events.length,100);assert.equal(r.has_more,false);
  const mixed=burst(100,(i)=>i<59?'2026-10-30T02:00:00Z':i<80?'2026-10-30T02:00:01Z':'2026-10-30T02:00:02Z');
  const m=buildOpsHq({analytics,quick:{...quick,recent:[]},registrations:mixed,payments:{available:true,events:[]}},now);
  assert.equal(m.events.length,80);assert.equal(m.has_more,true);   // 60th event is inside the 02:00:01 group, so the whole group is included
});
test('incomplete is set when an event source is missing or at its cap',()=>{
  const full={analytics,quick:{...quick,recent:[]},registrations,payments};
  assert.equal(buildOpsHq(full,now).incomplete,false);
  assert.equal(buildOpsHq({...full,payments:null},now).incomplete,true);
  assert.equal(buildOpsHq({...full,quick:{...quick,recent:Array.from({length:12},(_,i)=>({event:'queued',job_id:i,at:'2026-10-30T03:00:00Z'}))}},now).incomplete,true);
  assert.equal(buildOpsHq({...full,registrations:burst(200)},now).incomplete,true);
});
test('health labels: contract keys unchanged, docs wording lives in the scene',()=>{
  const m=buildOpsHq(all,now).metrics.health;assert.deepEqual(Object.keys(m).sort(),['alerts','database','edge','queue_depth']);
});
