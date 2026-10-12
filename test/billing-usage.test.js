import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudflareBilling,openaiCosts} from '../src/admin-balances.js';
import {renderProviderBalances} from '../public/admin-balances.js';
const env={CLOUDFLARE_BILLING_TOKEN:'billing-fixture',CLOUDFLARE_USAGE_ACCOUNT_ID:'a'.repeat(32)};
const record={BillingAccountId:env.CLOUDFLARE_USAGE_ACCOUNT_ID,ChargeCategory:'Usage',ChargeClass:null,ContractedCost:1,CumulatedContractedCost:50,ConsumedQuantity:10,ConsumedUnit:'Requests',ServiceName:'Workers Requests',BillingCurrency:'USD',BillingPeriodStart:'2026-10-01T00:00:00Z',ChargePeriodStart:'2026-10-01T00:00:00Z',ChargePeriodEnd:'2026-10-02T00:00:00Z',SubscriptionId:'private-subscription'};
function requestFor(records,covered=true){return async(url,options)=>{
 assert.equal(options.headers.Authorization,'Bearer billing-fixture');assert.equal(options.redirect,'manual');assert.equal(options.method,undefined);
 assert.equal(new URL(url).search,'');
 return Response.json({success:true,errors:[],result:url.endsWith('/info')?{covered}:records});
};}
test('billing combines per-day costs, never cumulative costs, preserves distinct cycles/currencies/units, and strips private identifiers',async()=>{
 const report=await cloudflareBilling(env,{request:requestFor([record,{...record,ContractedCost:2,CumulatedContractedCost:52,ChargePeriodStart:record.ChargePeriodEnd,ChargePeriodEnd:'2026-10-03T00:00:00Z'},{...record,ServiceName:'Workers CPU',ConsumedUnit:'ms',ConsumedQuantity:500}])});
 assert.equal(report.available,true);const requests=report.items.find(i=>i.service==='Workers Requests');assert.equal(requests.reported_cost,3);assert.equal(requests.consumed_quantity,20);assert.equal(requests.reported_through,'2026-10-03T00:00:00Z');assert.equal(report.items.length,2);
 assert.ok(!JSON.stringify(report).includes('private-subscription'));assert.ok(!JSON.stringify(report).includes('billing-fixture'));
 const separate=await cloudflareBilling(env,{request:requestFor([record,{...record,BillingCurrency:'EUR'},{...record,BillingPeriodStart:'2026-09-15T00:00:00Z'}])});assert.equal(separate.items.length,3);
});
test('billing missing permissions, no coverage, empty or malformed responses never invent zero bills',async()=>{
 assert.equal((await cloudflareBilling({CLOUDFLARE_USAGE_TOKEN:'analytics'},{request:()=>assert.fail()})).reason,'not_connected');
 assert.equal((await cloudflareBilling(env,{request:async()=>new Response('',{status:403})})).reason,'access_denied');
 assert.equal((await cloudflareBilling(env,{request:requestFor([],false)})).reason,'billing_not_covered');
 const empty=await cloudflareBilling(env,{request:requestFor([])});assert.equal(empty.reason,'billing_no_records');assert.equal(empty.access_verified,true);assert.equal(empty.coverage_verified,true);assert.equal(empty.available,false);assert.equal(empty.items,undefined);
 for(const row of [{...record,BillingAccountId:'wrong'},{...record,ContractedCost:NaN},{...record,BillingPeriodStart:'bad'},{...record,ChargeClass:'Correction'},{...record,ConsumedQuantity:-1}])assert.equal((await cloudflareBilling(env,{request:requestFor([row])})).available,false);
});
test('OpenAI billing breakdown reconciles all pages to the monthly total',async()=>{
 let calls=0;
 const result=await openaiCosts({OPENAI_USAGE_ADMIN_KEY:'ai-fixture'},{request:async url=>{
  assert.equal(new URL(url).searchParams.get('group_by'),'line_item');calls++;
  return Response.json({data:[{results:[{line_item:'model input',amount:{currency:'usd',value:1}},{line_item:'model output',amount:{currency:'usd',value:2}}]}],has_more:calls===1,next_page:calls===1?'next':null});
 }});
 assert.equal(result.month_cost_usd,6);assert.equal(result.cost_items.reduce((s,i)=>s+i.cost_usd,0),6);assert.equal(result.cost_items[0].cost_usd,4);
});
test('billing presentation distinguishes reported costs and consumption from final invoices and remaining credit',async()=>{
 const bill=await cloudflareBilling(env,{request:requestFor([record])});
 const helpers={row:(l,v)=>l+': '+v+'\n',num:String,money:(v,c)=>c+' '+v,date:String,esc:String};
 const text=renderProviderBalances({provider_balances:{cloudflare_billing:bill,openai:{available:true,month_cost_usd:3,cost_items:[{label:'model input',cost_usd:3}]}}},helpers);
 assert.match(text,/Metered usage: 10 Requests/);assert.match(text,/Provider-reported usage cost: USD 1/);assert.match(text,/Monthly billing breakdown/);assert.match(text,/not the full invoice/);assert.match(text,/Remaining prepaid credit: Unavailable/);
});
