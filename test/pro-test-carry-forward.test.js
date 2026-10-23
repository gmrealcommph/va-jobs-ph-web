import {test} from 'node:test';import assert from 'node:assert/strict';import {ProAiBudget} from '../src/pro-live-test-worker.js';
function fixture(env={}){const data=new Map(),storage={get:async k=>data.get(k),put:async(k,v)=>data.set(k,structuredClone(v)),transaction:async fn=>fn(storage)};return {data,budget:new ProAiBudget({storage},{PRO_TEST_USER_ID:'fixture-member',PRO_AI_ENABLED:'false',PRO_AI_SPENDING_AUTHORIZED:'false',...env})};}
const body=()=>({global:{total:200000,daily:200000,day:20000},user:{start:Date.now()-120000,last:Date.now()-61000,count:2,daily:2,day:20000}});
const req=b=>new Request('https://budget/carry-forward',{method:'POST',body:JSON.stringify(b)});
test('historical spend and member quota carry forward once without resetting or double-counting',async()=>{
 const f=fixture();assert.equal((await f.budget.fetch(req(body()))).status,200);assert.equal(f.data.get('global').total,200000);
 const key=[...f.data.keys()].find(k=>k.startsWith('user:'));assert.equal(f.data.get(key).count,2);f.data.get('global').total=300000;f.data.get(key).count=3;
 assert.equal((await f.budget.fetch(req(body()))).status,200);assert.equal(f.data.get('global').total,300000);assert.equal(f.data.get(key).count,3);
});
test('carry-forward refuses reduced values, existing unimported spending and any enabled paid state',async()=>{
 const f=fixture();const b=body();b.global.total=0;assert.equal((await f.budget.fetch(req(b))).status,400);f.data.set('global',{total:100000});assert.equal((await f.budget.fetch(req(body()))).status,409);
 assert.equal((await fixture({PRO_AI_ENABLED:'true'}).budget.fetch(req(body()))).status,409);
});
