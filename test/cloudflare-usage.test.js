import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudflareUsage} from '../src/admin-balances.js';
import {renderProviderBalances} from '../public/admin-balances.js';
const env={CLOUDFLARE_USAGE_TOKEN:'fixture-secret',CLOUDFLARE_USAGE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_USAGE_WORKER_NAME:'va-jobs-ph-web'};
const now=()=>Date.parse('2026-10-09T12:00:00Z');
const report=rows=>({data:{viewer:{accounts:[{workersInvocationsAdaptive:rows}]}},errors:null});
test('Cloudflare requires dedicated configuration and requests a bounded aggregate without exposing credentials',async()=>{
 assert.equal((await cloudflareUsage({},{request:()=>assert.fail()})).reason,'not_connected');
 const result=await cloudflareUsage(env,{now,request:async(url,options)=>{
  assert.equal(url,'https://api.cloudflare.com/client/v4/graphql');assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,'Bearer fixture-secret');
  const body=JSON.parse(options.body);assert.equal(body.variables.start,'2026-10-08T12:00:00.000Z');assert.equal(body.variables.script,'va-jobs-ph-web');assert.ok(!body.query.includes('dimensions'));
  return Response.json(report([{sum:{requests:100,errors:2}}]));
 }});
 assert.equal(result.requests,100);assert.equal(result.errors,2);assert.equal(result.sampled,true);assert.ok(!JSON.stringify(result).includes('fixture-secret'));
 const text=renderProviderBalances({provider_balances:{cloudflare:result}},{row:(l,v)=>l+': '+v+'\n',num:String,money:String,date:String,esc:String});
 assert.match(text,/requests · last 24 hours \(estimated\): 100/);assert.match(text,/Unknown · billing usage not connected/);
});
test('Cloudflare denied, empty, partial and malformed reports never appear as healthy zero usage',async()=>{
 assert.equal((await cloudflareUsage(env,{now,request:async()=>new Response('',{status:403})})).reason,'access_denied');
 for(const body of [report([]),report([{sum:{requests:-1,errors:0}}]),{...report([{sum:{requests:100,errors:0}}]),errors:[{message:'secret'}]},{}]){
  const result=await cloudflareUsage(env,{now,request:async()=>Response.json(body)});assert.equal(result.available,false);assert.ok(!JSON.stringify(result).includes('secret'));
 }
});
