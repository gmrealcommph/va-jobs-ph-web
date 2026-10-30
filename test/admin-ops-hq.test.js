import test from 'node:test';
import assert from 'node:assert/strict';
import {adminEndpoint} from '../src/admin.js';
import {buildOpsHq,_resetOpsHqCache} from '../src/admin-ops-hq.js';
const now=new Date('2026-10-30T04:00:00Z');
const analytics={members:120,live_jobs:50,pro_access:7,daily:[{day:'2026-10-29',members:4,jobs:10},{day:'2026-10-30',members:6,jobs:3}]};
const quick={counts:{queued:5,processing:1},all_reads:{ready:90,failed:2},recent:[{event:'completed',job_id:1,at:'2026-10-30T03:00:00Z'},{event:'queued',job_id:2,at:'2026-10-30T03:01:00Z'},{event:'failed',job_id:3,at:'2026-10-30T03:02:00Z'}]};
const registrations={available:true,events:[{event_id:'a',registered_at:'2026-10-30T02:00:00Z'}]};
const payments={available:true,events:[{event_id:'b',confirmed_at:'2026-10-30T01:00:00Z'}]};
test('metrics and events follow the contract, nulls where unverified',()=>{
  const r=buildOpsHq({analytics,quick,registrations,payments},now);
  assert.deepEqual(r.metrics.intake,{new_today:6,total:120,growth_pct:50});
  assert.equal(r.metrics.reads.ready_total,90);assert.equal(r.metrics.pro.upgrades_today,1);
  assert.equal(r.metrics.refer.verified_signups,null);assert.equal(r.metrics.chief.open,null);
  assert.deepEqual(r.events.map(e=>e.type),['pro_upgrade','member_registered','quick_read_completed','quick_read_failed']);
  assert.ok(!JSON.stringify(r).includes('@'));
});
test('since is inclusive and missing sources give nulls',()=>{
  const r=buildOpsHq({analytics,quick,registrations,payments},now,'2026-10-30T03:00:00Z');
  assert.equal(r.events.length,2);
  assert.equal(buildOpsHq({},now).metrics.intake.total,null);
});
const req=(p)=>new Request('https://veeays.com'+p);
const sess=async()=>({user:{id:'u'},accessToken:'t'});
test('endpoint requires admin, validates since, and caches',async()=>{
  _resetOpsHqCache();let n=0;
  const call=async(e,t,name)=>{if(name==='veeays_admin_access')return true;n++;return {veeays_admin_analytics:analytics,veeays_admin_quick_reads:quick,veeays_admin_registration_snapshot:registrations,veeays_admin_payment_snapshot:payments}[name];};
  const a=await adminEndpoint(req('/admin/api/ops-hq'),{},{session:sess,call});
  assert.equal(a.status,200);assert.ok((await a.json()).metrics);
  await adminEndpoint(req('/admin/api/ops-hq'),{},{session:sess,call});
  assert.equal((await adminEndpoint(req('/admin/api/ops-hq?since=bad'),{},{session:sess,call})).status,400);
  const anon=await adminEndpoint(req('/admin/api/ops-hq'),{},{session:async()=>({user:null}),call:()=>assert.fail()});
  assert.equal(anon.status,401);
  const nonadmin=await adminEndpoint(req('/admin/api/ops-hq'),{},{session:sess,call:async()=>false});
  assert.equal(nonadmin.status,403);
});
