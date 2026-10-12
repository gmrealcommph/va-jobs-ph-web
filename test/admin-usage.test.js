import test from 'node:test';
import assert from 'node:assert/strict';
import {emailUsage,createUsageCache} from '../src/admin-health.js';
import {adminEndpoint} from '../src/admin.js';
import {renderEmailUsage} from '../public/admin-email-health.js';
const start=Date.parse('2026-10-08T12:00:00Z');
const quota=(used=90)=>({used,limit:100,sent:used-2,received:2,resets_at:'2026-10-09T00:00:00Z'});
const payload=()=>({emails:{daily:quota(),monthly:{...quota(2100),limit:3000,resets_at:'2026-11-01T00:00:00Z'}}});
const env={RESEND_USAGE_KEY:'fixture-secret'};
test('provider-only aggregates include sent and received and never echo secrets or raw error bodies',async()=>{
 const result=await emailUsage(env,{now:()=>start,request:async(url,opts)=>{assert.equal(url,'https://api.resend.com/usage');assert.equal(opts.redirect,'manual');return Response.json({...payload(),private:'fixture-secret'});}});
 assert.equal(result.daily.sent,88);assert.equal(result.daily.received,2);assert.equal(result.scope,'account-wide');assert.ok(!JSON.stringify(result).includes('fixture-secret'));
 for(const [status,reason] of [[401,'access_denied'],[403,'access_denied'],[404,'endpoint_unavailable'],[429,'rate_limited'],[500,'provider_error']]){
  const result=await emailUsage(env,{request:async()=>new Response('fixture-secret',{status})});assert.equal(result.reason,reason);assert.ok(!JSON.stringify(result).includes('fixture-secret'));
 }
 assert.equal((await emailUsage(env,{request:async()=>{throw Object.assign(Error('fixture-secret'),{name:'TimeoutError'});}})).reason,'timeout');
});
test('invalid counts and expired resets cannot be represented as healthy quota',async()=>{
 for(const patch of [{used:-1},{used:1.1},{used:'90'},{limit:0},{resets_at:'bad'},{resets_at:'2026-10-08T12:00:00Z'}]){
  const data=payload();Object.assign(data.emails.daily,patch);
  assert.equal((await emailUsage(env,{now:()=>start,request:async()=>Response.json(data)})).reason,'invalid_response');
 }
 const data=payload();data.emails.daily.limit=null;assert.equal((await emailUsage(env,{now:()=>start,request:async()=>Response.json(data)})).daily.level,'uncapped');
});
test('five-minute cache coalesces requests, clones results, expires, and never falls back to sending key',async()=>{
 let at=start,calls=0;const cache=createUsageCache(),opts={now:()=>at,request:async()=>{calls++;return Response.json(payload());}};
 const results=await Promise.all(Array.from({length:20},()=>cache(env,opts)));assert.equal(calls,1);
 results[0].daily.used=0;assert.equal((await cache(env,opts)).daily.used,90);
 at+=299999;await cache(env,opts);assert.equal(calls,1);at++;await cache(env,opts);assert.equal(calls,2);
 assert.equal((await cache({RESEND_API_KEY:'sending-fixture'},opts)).reason,'not_connected');assert.equal(calls,2);
 await cache({RESEND_USAGE_KEY:'rotated-fixture'},opts);assert.equal(calls,3);
});
test('failure retains bounded stale snapshot without claiming current health; Retry-After is honored',async()=>{
 let at=start;const cache=createUsageCache(),opts={now:()=>at,request:async()=>Response.json(payload())};
 await cache(env,opts);at+=300000;opts.request=async()=>new Response('',{status:429,headers:{'retry-after':'600'}});
 const result=await cache(env,opts);assert.equal(result.available,false);assert.equal(result.stale,true);assert.equal(result.last_known.daily.used,90);assert.equal(Date.parse(result.next_refresh_at),at+600000);
 at+=1800000;const expired=await cache(env,opts);assert.equal(expired.last_known,undefined);
});
test('cache refreshes at provider reset even within five-minute cadence',async()=>{
 let at=start,calls=0;const cache=createUsageCache(),opts={now:()=>at,request:async()=>{calls++;const data=payload();data.emails.daily.resets_at=new Date(at+60000).toISOString();return Response.json(data);}};
 const result=await cache(env,opts);assert.equal(Date.parse(result.next_refresh_at),at+60000);at+=60000;await cache(env,opts);assert.equal(calls,2);
});
test('anonymous and ordinary member cannot invoke provider usage',async()=>{
 for(const signedIn of [false,true]){
  const result=await adminEndpoint(new Request('https://veeays.com/admin/api/analytics'),env,{session:async()=>signedIn?{user:{id:'usage-denied'},accessToken:'fixture'}:{},call:async()=>false,usage:()=>assert.fail('must authorize before provider access')});
  assert.equal(result.status,signedIn?403:401);assert.match(result.headers.get('cache-control'),/no-store/);
 }
});
test('UI distinguishes quota exhaustion, timestamps, stale quota and safe failure messages',()=>{
 const helpers={row:(l,v)=>l+': '+v+'\n',num:String,date:String,esc:s=>String(s).replaceAll('<','&lt;')};
 const usage={available:true,daily:{...quota(100),level:'critical'},monthly:{...quota(90),level:'high'},fetched_at:'observed',checked_at:'checked',next_refresh_at:'next'};
 const html=renderEmailUsage(usage,helpers);assert.match(html,/quota exhausted/);assert.match(html,/observed/);assert.match(html,/next/);assert.match(html,/SMTP/);
 const failed=renderEmailUsage({available:false,reason:'provider_error',last_known:usage},helpers);assert.match(failed,/Quota status unknown/);assert.match(failed,/Stale last-known/);
 assert.ok(!renderEmailUsage({available:false,reason:'<private>'},helpers).includes('<private>'));
 const compact=renderEmailUsage(usage,{...helpers,compact:true});assert.match(compact,/Quota exhausted/);assert.match(compact,/High · 90%/);assert.match(compact,/<details>/);assert.match(compact,/resets/);assert.match(compact,/SMTP/);
 const compactFailed=renderEmailUsage({available:false,reason:'provider_error',last_known:usage},{...helpers,compact:true});assert.match(compactFailed,/Quota unknown/);assert.match(compactFailed,/Stale last-known/);
});
