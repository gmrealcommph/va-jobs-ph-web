import test from 'node:test';
import assert from 'node:assert/strict';
import {visitorAnalytics} from '../src/admin-visitors.js';
import {adminEndpoint} from '../src/admin.js';
const dates={p_start:'2026-10-07',p_end:'2026-10-08'};
const env={CLOUDFLARE_ANALYTICS_TOKEN:'private-test-token'};
const sites={success:true,result:[{site_tag:'a'.repeat(32),ruleset:{zone_name:'veeays.com'}}]};
const response=body=>Response.json(body);
test('missing configuration does not send requests or invent zero traffic',async()=>{
 assert.deepEqual(await visitorAnalytics({},dates,{request:()=>assert.fail()}),{available:false,reason:'not_connected'});
});
test('visitor query uses Manila boundaries, exact site and hostname, excludes bots, and returns only aggregates',async()=>{
 const calls=[];
 const data=await visitorAnalytics(env,dates,{request:async(url,options)=>{
  calls.push({url,options});return response(calls.length===1?sites:{data:{viewer:{accounts:[{total:[{count:12,sum:{visits:5}}]}]}}});
 }});
 assert.equal(data.visits,5);assert.equal(data.page_views,12);assert.equal(data.available,true);
 const query=JSON.parse(calls[1].options.body).query;
 for(const text of ['2026-10-06T16:00:00.000Z','2026-10-08T16:00:00.000Z','requestHost:"veeays.com"','bot:0','siteTag:"'+ 'a'.repeat(32)+'"'])assert.ok(query.includes(text));
 assert.equal(calls[1].options.headers.Authorization,'Bearer private-test-token');
 assert.ok(!JSON.stringify(data).includes('private-test-token'));
});
test('Cloudflare failures, ambiguous sites and malformed data stay unavailable',async()=>{
 for(const body of [{errors:[{message:'secret provider error'}]},{data:{viewer:{accounts:[{total:[{count:12,sum:{visits:null}}]}]}}}]){
  let count=0;
  const result=await visitorAnalytics(env,dates,{request:async()=>response(++count===1?sites:body)});
  assert.equal(result.available,false);assert.equal(result.visits,undefined);
 }
 assert.equal((await visitorAnalytics(env,dates,{request:async()=>new Response('',{status:403})})).reason,'access_denied');
 assert.equal((await visitorAnalytics(env,dates,{request:async()=>response({...sites,result:[...sites.result,...sites.result]})})).reason,'site_not_found');
 assert.equal((await visitorAnalytics(env,dates,{request:async()=>{throw Error('timeout');}})).available,false);
});
test('Cloudflare successful empty aggregate means zero recorded visits',async()=>{
 let count=0;
 const data=await visitorAnalytics(env,dates,{request:async()=>response(++count===1?sites:{data:{viewer:{accounts:[{total:[]}]}}})});
 assert.equal(data.available,true);assert.equal(data.visits,0);
});
test('anonymous and non-admin requests never contact Cloudflare',async()=>{
 for(const user of [null,{id:'regular-member'}]){
  const result=await adminEndpoint(new Request('https://veeays.com/admin/api/analytics'),env,{
   session:async()=>({user,accessToken:'session'}),call:async()=>false,visitors:()=>assert.fail('No provider request allowed')
  });
  assert.equal(result.status,user?403:401);
 }
});
