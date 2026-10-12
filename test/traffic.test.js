import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAttribution,trafficEndpoint,linkTrafficRegistration} from '../src/traffic.js';
import {referrerSource,safeLanding,visitorAnalytics} from '../src/admin-visitors.js';
import {renderTraffic} from '../public/admin-traffic.js';
const id='11111111-1111-4111-8111-111111111111';
const post=(b,headers={})=>new Request('https://veeays.com/traffic/event',{method:'POST',headers:{Origin:'https://veeays.com','Content-Type':'application/json',Referer:'https://veeays.com/?utm_source=facebook',...headers},body:JSON.stringify(b)});
test('source classification uses domain boundaries and explicit paid media',()=>{
 assert.equal(referrerSource('l.facebook.com'),'Facebook');assert.equal(referrerSource('facebook.com.evil.test'),'Referrals');assert.equal(referrerSource('www.google.com.ph'),'Google organic (inferred)');assert.equal(referrerSource('veeays.com'),'Direct / unknown');
 assert.equal(normalizeAttribution({landing:'/',utm_source:'facebook',utm_medium:'social',utm_campaign:'job_launch',referrer:''}).channel,'Facebook');
 assert.equal(normalizeAttribution({landing:'/',utm_source:'facebook',utm_medium:'paid_social'}).channel,'Paid campaigns');
 assert.equal(normalizeAttribution({landing:'/',utm_source:'person@example.com',utm_campaign:'name with spaces'}).source,null);
 for(const path of ['/admin','/auth/callback','/login','/signup','/my-jobs','/jobs/private@example.com'])assert.equal(safeLanding(path),null);
 assert.equal(safeLanding('/jobs/72513?email=private@example.com'),'/jobs/72513');
});
test('tracking requires explicit consent, same origin and public route; opt-out sends no event',async()=>{
 const calls=[];const call=async(...x)=>{calls.push(x);return true;};
 for(const req of [post({id}),post({id,consent:true,landing:'/'},{Origin:'https://evil.test'}),post({id,consent:true,landing:'/'},{Referer:'https://veeays.com/admin'})])assert.ok((await trafficEndpoint(req,{}, {call})).status>=400);
 assert.equal(calls.length,0);
 const declined=await trafficEndpoint(post({id,consent:true,landing:'/'},{'Sec-GPC':'1'}),{}, {call});assert.equal((await declined.json()).recorded,false);assert.equal(calls.length,0);
 const result=await trafficEndpoint(post({id,consent:true,landing:'/',utm_source:'facebook',utm_medium:'social',fbclid:'secret',email:'secret'}),{}, {call});
 assert.equal(result.status,200);assert.match(result.headers.get('set-cookie'),/HttpOnly/);assert.equal(calls[0][2].p_id,id);assert.ok(!JSON.stringify(calls).includes('secret'));
});
test('registration requires consent cookie and genuine new signup identities; failures never block auth',async()=>{
 let count=0;const call=async()=>{count++;throw Error('db down');};
 const req=post({}, {Cookie:`veeays_analytics=yes; veeays_traffic=${id}`});
 await linkTrafficRegistration(req,{}, {id,identities:[]},{call});assert.equal(count,0);
 await linkTrafficRegistration(req,{}, {id,identities:[{}]},{call});assert.equal(count,1);
 await linkTrafficRegistration(post({}, {Cookie:`veeays_analytics=yes; veeays_traffic=${id}`,'DNT':'1'}),{}, {id,identities:[{}]},{call});assert.equal(count,1);
});
test('Cloudflare dimensions keep visits separate, filter private paths and preserve missing data',async()=>{
 let count=0;
 const result=await visitorAnalytics({CLOUDFLARE_ANALYTICS_TOKEN:'test'},{p_start:'2026-10-07',p_end:'2026-10-08'},{request:async()=>Response.json(++count===1?{success:true,result:[{site_tag:'a'.repeat(32),ruleset:{zone_name:'veeays.com'}}]}:count===2?{data:{viewer:{accounts:[{total:[{count:9,sum:{visits:5}}]}]}}}:{data:{viewer:{accounts:[{referrers:[{sum:{visits:2},dimensions:{refererHost:'l.facebook.com'}},{sum:{visits:3},dimensions:{refererHost:''}}],landings:[{sum:{visits:2},dimensions:{requestPath:'/admin'}},{sum:{visits:3},dimensions:{requestPath:'/?email=private'}}]}]}}})});
 assert.equal(result.attribution.available,true);assert.equal(result.attribution.sources[0].source,'Direct / unknown');assert.deepEqual(result.attribution.landings,[{path:'/',visits:3}]);assert.equal(result.attribution.conversions_available,false);
});
test('UI preserves missing-data distinctions and omits campaign reporting while testing',()=>{
 const unavailable=renderTraffic({});assert.match(unavailable,/Unavailable/);assert.match(unavailable,/Referrer attribution unavailable/);
 const html=renderTraffic({traffic:{available:true,started_at:new Date().toISOString(),historical_unavailable:true,sessions:1,registrations:0,sources:[{channel:'Facebook',source:'facebook',medium:'social',campaign:'<script>',sessions:1,registrations:0,pro_conversions:0}],landings:[]}});
 assert.match(html,/historical UTM attribution.*unavailable/);assert.match(html,/Linked registrations<\/span><strong>0<\/strong>/);
 assert.doesNotMatch(html,/tf-campaigns|Campaigns &amp; conversions|Campaign link examples|paid_social|&lt;script&gt;/);assert.ok(!html.includes('<script>'));
 const escaped=renderTraffic({visitors:{available:true,visits:2,attribution:{available:true,sources:[{source:'<script>',visits:2}],landings:[{path:'/<script>',visits:2}]}}});
 assert.match(escaped,/&lt;script&gt;/);assert.doesNotMatch(escaped,/<script>/);
});
