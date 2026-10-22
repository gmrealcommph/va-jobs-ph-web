import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {ActiveVisitors,activityEndpoint,activeVisitorCount} from '../src/active-visitors.js';
import {registrationCookie,purchaseReceipt,analyticsCsp} from '../src/analytics.js';

test('shared counter deduplicates tabs, expires at five minutes, removes consent and survives reinstantiation',async()=>{
 const db=new DatabaseSync(':memory:');let alarm=null;
 const ctx={storage:{sql:{exec(query,...args){const stmt=db.prepare(query);const rows=stmt.all(...args);return {one:()=>rows[0],toArray:()=>rows};}},getAlarm:async()=>alarm,setAlarm:async value=>{alarm=value;}}};
 const original=Date.now;let now=1800000000000;Date.now=()=>now;
 try{let object=new ActiveVisitors(ctx);const ping=id=>object.fetch(new Request('https://internal/ping',{method:'POST',body:JSON.stringify({id})}));
 const a=crypto.randomUUID(),b=crypto.randomUUID();await Promise.all([ping(a),ping(a),ping(b)]);
 let result=await(await object.fetch(new Request('https://internal/count'))).json();assert.equal(result.visits,2);
 object=new ActiveVisitors(ctx);assert.equal((await(await object.fetch(new Request('https://internal/count'))).json()).visits,2);
 await object.fetch(new Request('https://internal/remove',{method:'POST',body:JSON.stringify({id:a})}));assert.equal((await(await object.fetch(new Request('https://internal/count'))).json()).visits,1);
 now+=300000;await object.alarm();assert.equal((await(await object.fetch(new Request('https://internal/count'))).json()).visits,0);
 }finally{Date.now=original;db.close();}
});
test('heartbeat requires origin, consent, public page, browser UA; unavailable never becomes zero',async()=>{
 let calls=0;const env={ACTIVE_VISITORS:{getByName:()=>({fetch:async()=>{calls++;return Response.json({recorded:true});}})}};
 const req=(extra={},body={id:crypto.randomUUID(),consent:true})=>new Request('https://veeays.com/activity',{method:'POST',headers:{origin:'https://veeays.com',referer:'https://veeays.com/jobs','content-type':'application/json','user-agent':'Mozilla/5.0',...extra},body:JSON.stringify(body)});
 assert.equal((await activityEndpoint(req(),env)).status,200);assert.equal(calls,1);
 for(const headers of [{origin:'https://evil.test'},{referer:'https://veeays.com/admin'},{'sec-gpc':'1'},{dnt:'1'}])assert.ok((await activityEndpoint(req(headers),env)).status>=400);
 for(const ua of ['Googlebot','UptimeRobot','curl/8','HeadlessChrome'])await activityEndpoint(req({'user-agent':ua}),env);
 assert.equal(calls,1);assert.equal((await activityEndpoint(req({}, {id:crypto.randomUUID(),consent:false}),env)).status,403);
 assert.deepEqual(await activeVisitorCount({}),{available:false,reason:'not_connected'});
 assert.deepEqual(await activeVisitorCount({ACTIVE_VISITORS:{getByName:()=>({fetch:async()=>{throw Error();}})}}),{available:false,reason:'provider_error'});
 const result=await activeVisitorCount({ACTIVE_VISITORS:{getByName:()=>({fetch:async()=>Response.json({visits:0})})}});assert.equal(result.available,true);assert.equal(result.visits,0);
});
test('conversion markers exclude repeat/failed signup and pending/test payments; receipt is opaque',async()=>{
 const request=new Request('https://veeays.com/signup',{headers:{cookie:'veeays_ga4_consent=yes'}});
 assert.equal(registrationCookie(request,{identities:[]}),null);assert.equal(registrationCookie(new Request('https://veeays.com'),{identities:[{}]}),null);
 assert.match(registrationCookie(request,{identities:[{}]}),/^veeays_signup=[0-9a-f-]{36};/);
 const record={id:'private-payment-id',livemode:true,status:'confirmed',amount:49900,currency:'PHP'};
 const marker=await purchaseReceipt(record,true);assert.match(marker,/data-analytics-purchase="[a-f0-9]{64}"/);assert.ok(!marker.includes(record.id));
 assert.equal(await purchaseReceipt(record,false),'');assert.equal(await purchaseReceipt({...record,status:'pending'},true),'');
 assert.ok(analyticsCsp("script-src 'self'; connect-src 'self'").includes('https://region1.google-analytics.com'));
});
const script=(await fs.readFile(new URL('../public/analytics.js',import.meta.url),'utf8')).replaceAll('export const ','const ').replaceAll('export function ','function ');
function browser(choice='no',path='/jobs'){
 const storage=new Map([['veeays_analytics_choice_v2',choice]]),listeners={},scripts=[],requests=[],cookies=[];
 const document={hidden:false,head:{append:s=>scripts.push(s)},querySelector:()=>null,createElement:()=>({}),addEventListener:(name,fn)=>listeners[name]=fn};
 Object.defineProperty(document,'cookie',{get:()=>'',set:v=>cookies.push(v)});
 const window={addEventListener:(name,fn)=>listeners[name]=fn};
 const context={window,document,navigator:{},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{origin:'https://veeays.com',hostname:'veeays.com',pathname:path,search:'?email=private@example.com'},history:{pushState(){},replaceState(){}},crypto,fetch:async(url,init)=>{requests.push({url,body:init.body});return Response.json({});},AbortSignal,setInterval:()=>1,clearInterval(){},Date,JSON,Set};
 vm.createContext(context);vm.runInContext('{'+script+'}',context);return {context,window,storage,listeners,scripts,requests};
}
test('no Google or heartbeat before consent; one initial/manual path view; query/hash privacy; withdrawal stops collection',()=>{
 const b=browser();assert.equal(b.scripts.length,0);assert.equal(b.requests.length,0);
 b.storage.set('veeays_analytics_choice_v2','yes');b.listeners['veeays:consent']();assert.equal(b.scripts.length,1);assert.equal(b.requests.length,1);
 assert.equal(Object.prototype.toString.call(b.window.dataLayer[0]),'[object Arguments]');
 const events=()=>b.window.dataLayer.filter(x=>x[0]==='event');assert.equal(events().length,1);
 b.context.history.replaceState({},'', '?email=other@example.com');assert.equal(events().length,1);
 b.context.location.pathname='/pro';b.context.history.pushState({},'','/pro');assert.equal(events().length,2);
 assert.ok(!JSON.stringify(b.window.dataLayer).includes('private@example.com'));
 vm.runInContext('{'+script+'}',b.context);assert.equal(b.scripts.length,1);
 b.storage.set('veeays_analytics_choice_v2','no');b.listeners['veeays:consent']();assert.equal(b.window['ga-disable-G-LHDG8M183F'],true);assert.equal(JSON.parse(b.requests.at(-1).body).remove,true);
 const n=events().length;b.context.location.pathname='/';b.context.history.pushState({},'','/');assert.equal(events().length,n);
});
test('GPC blocks analytics even with saved consent, and private routes never load Google',()=>{
 const b=browser('no');b.storage.set('veeays_analytics_choice_v2','yes');b.context.navigator.globalPrivacyControl=true;b.listeners['veeays:consent']();assert.equal(b.scripts.length,0);
 assert.equal(browser('yes','/admin').scripts.length,0);
});
test('legacy first-party consent never silently opts a visitor into Google',()=>{
 const b=browser('no');b.storage.delete('veeays_analytics_choice_v2');b.storage.set('veeays_analytics_choice','yes');b.listeners['veeays:consent']();assert.equal(b.scripts.length,0);assert.equal(b.requests.length,0);
});
test('different job details create separate sanitized path views; query changes do not',()=>{
 const b=browser('yes','/jobs/123');b.context.location.pathname='/jobs/456';b.context.history.pushState({},'','/jobs/456');
 const events=b.window.dataLayer.filter(x=>x[0]==='event');assert.equal(events.length,2);assert.equal(events[1][2].page_location,'https://veeays.com/jobs/456');b.context.history.replaceState({},'','?email=secret@example.com');assert.equal(b.window.dataLayer.filter(x=>x[0]==='event').length,2);
});
