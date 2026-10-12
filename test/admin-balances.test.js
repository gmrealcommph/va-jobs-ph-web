import test from 'node:test';
import assert from 'node:assert/strict';
import {openaiCosts,paymongoBalance,cachedReport} from '../src/admin-balances.js';
import {adminEndpoint} from '../src/admin.js';
import {renderProviderBalances} from '../public/admin-balances.js';
const now=()=>Date.parse('2026-10-08T12:00:00Z');
test('OpenAI uses only dedicated Admin key, sums complete cost pages, and never invents credit',async()=>{
 let calls=0;
 assert.equal((await openaiCosts({OPENAI_API_KEY:'sending'},{request:()=>assert.fail()})).reason,'not_connected');
 const result=await openaiCosts({OPENAI_USAGE_ADMIN_KEY:'monitor-fixture'},{now,request:async(url,options)=>{
  calls++;assert.equal(options.headers.Authorization,'Bearer monitor-fixture');assert.equal(options.redirect,'manual');assert.equal(new URL(url).searchParams.get('start_time'),String(Date.parse('2026-10-01T00:00:00Z')/1000));
  if(calls===2)assert.equal(new URL(url).searchParams.get('page'),'next');
  return Response.json({data:[{results:[{amount:{value:.15,currency:'usd'}}]}],has_more:calls===1,next_page:calls===1?'next':null});
 }});
 assert.equal(calls,2);assert.equal(result.month_cost_usd,.3);assert.equal(result.credit_balance_available,false);assert.ok(!JSON.stringify(result).includes('monitor-fixture'));
});
test('OpenAI incomplete, malformed, and forbidden reports stay unavailable rather than reporting zero',async()=>{
 for(const data of [{},{data:[{results:[{amount:{value:1,currency:'php'}}]}],has_more:false},{data:[],has_more:true,next_page:'loop'}]){
  assert.equal((await openaiCosts({OPENAI_USAGE_ADMIN_KEY:'fixture'},{now,request:async()=>Response.json(data)})).available,false);
 }
 const result=await openaiCosts({OPENAI_USAGE_ADMIN_KEY:'fixture'},{request:async()=>new Response('fixture',{status:403})});assert.equal(result.reason,'access_denied');assert.ok(!JSON.stringify(result).includes('fixture'));
});
test('PayMongo uses only GET, filters active live wallets and reports cents as PHP without identifiers',async()=>{
 const env={PAYMONGO_MODE:'live',PAYMONGO_LIVE_SECRET_KEY:'fixture-secret'};
 const result=await paymongoBalance(env,{now,request:async(url,options)=>{
  assert.equal(url,'https://api.paymongo.com/v2/wallets/?fields=balance');assert.equal(options.method,undefined);assert.equal(options.redirect,'manual');
  return Response.json({data:[{id:'private-wallet',livemode:true,status:'activated',balance:{available:49900,pending:10000}},{livemode:false,status:'activated',balance:{available:9999999,pending:0}},{livemode:true,status:'deactivated',balance:{available:9999999,pending:0}}]});
 }});
 assert.equal(result.available_php,499);assert.equal(result.pending_php,100);assert.equal(result.wallet_count,1);assert.ok(!JSON.stringify(result).includes('private-wallet'));assert.ok(!JSON.stringify(result).includes('fixture-secret'));
 assert.equal((await paymongoBalance({...env,PAYMONGO_MODE:'test'},{request:()=>assert.fail()})).reason,'not_connected');
 assert.equal((await paymongoBalance(env,{request:async()=>Response.json({data:[]})})).reason,'wallet_not_active');
 assert.equal((await paymongoBalance(env,{request:async()=>Response.json({data:[{livemode:true,status:'activated',balance:{available:-1,pending:0}}]})})).reason,'invalid_response');
});
test('provider cache coalesces requests, expires at 15 minutes and resets with key identity',async()=>{
 let at=now(),calls=0;const cached=cachedReport(async()=>({available:true,count:++calls}),e=>e.key);
 const options={now:()=>at};const result=await Promise.all(Array.from({length:10},()=>cached({key:'one'},options)));assert.equal(calls,1);result[0].count=0;assert.equal((await cached({key:'one'},options)).count,1);
 at+=900000;await cached({key:'one'},options);assert.equal(calls,2);await cached({key:'two'},options);assert.equal(calls,3);
});
test('balances never execute before anonymous/member authorization succeeds',async()=>{
 for(const signedIn of [false,true]){
  const result=await adminEndpoint(new Request('https://veeays.com/admin/api/analytics'),{},{session:async()=>signedIn?{user:{id:'balance-denied'},accessToken:'fixture'}:{},call:async()=>false,balances:()=>assert.fail('no unauthorized billing retrieval')});assert.equal(result.status,signedIn?403:401);
 }
});
test('provider overview distinguishes unknown quotas, actual spend, merchant funds and reservations',()=>{
 const helpers={row:(l,v)=>l+': '+v+'\n',num:String,money:(v,c)=>c+' '+v,date:String,esc:String};
 const text=renderProviderBalances({provider_balances:{openai:{available:true,month_cost_usd:5,period_start:'2026-10-01T00:00:00Z',period_end:'2026-10-08T12:00:00Z'},paymongo:{available:true,available_php:499,pending_php:100,wallet_count:1}}},helpers);
 assert.match(text,/Reported spend.*USD 5/);assert.match(text,/Remaining prepaid credit: Unavailable/);assert.match(text,/Available merchant funds: PHP 499/);assert.match(text,/Unknown · billing usage not connected/);assert.match(text,/budget holds/);assert.ok(!text.includes('undefined'));
});
