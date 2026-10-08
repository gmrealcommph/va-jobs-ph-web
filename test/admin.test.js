import test from 'node:test';
import assert from 'node:assert/strict';
import {adminEndpoint,period} from '../src/admin.js';
import {handle} from '../src/worker.js';
const user={id:'admin-id'},token='verified-session';
const session=async()=>({user,accessToken:token});
const req=(path='/admin',method='GET')=>new Request('https://veeays.com'+path,{method});
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
