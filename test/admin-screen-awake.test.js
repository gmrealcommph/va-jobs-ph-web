import test from 'node:test';
import assert from 'node:assert/strict';
import {initScreenAwake} from '../public/admin-interactions.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(request){
 const events={},status={setAttribute(){}},doc={visibilityState:'visible',hasFocus:()=>true,createElement:()=>status,getElementById:()=>({after(){}}),addEventListener:(k,v)=>events[k]=v,removeEventListener:k=>delete events[k]};
 const win={setInterval:(fn,ms)=>{assert.equal(ms,15000);events.healthCheck=fn;return 1;},clearInterval:()=>delete events.healthCheck,addEventListener:(k,v)=>events[k]=v,removeEventListener:k=>delete events[k]};
 const stop=initScreenAwake(doc,win,{wakeLock:{request}});
 return {events,status,doc,stop};
}
test('foreground acquires once; switching apps releases and returning reacquires',async()=>{
 let requests=0,releases=0;
 const f=fixture(async type=>{assert.equal(type,'screen');requests++;return {release:async()=>{releases++;},addEventListener(){}};});
 await flush();assert.equal(f.status.textContent,'Screen awake');
 f.events.pointerdown();await flush();assert.equal(requests,1);
 f.events.blur();await flush();assert.equal(releases,1);
 f.doc.visibilityState='hidden';f.events.visibilitychange();f.events.pointerdown();await flush();assert.equal(requests,1);
 f.doc.visibilityState='visible';f.events.visibilitychange();await flush();assert.equal(requests,2);
 f.stop();await flush();assert.equal(releases,2);assert.equal(Object.keys(f.events).length,0);
});
test('pending acquisition is released if dashboard becomes hidden',async()=>{
 let resolve,releases=0;const f=fixture(()=>new Promise(r=>resolve=r));
 f.doc.visibilityState='hidden';f.events.visibilitychange();
 resolve({release:async()=>{releases++;},addEventListener(){}});await flush();assert.equal(releases,1);assert.notEqual(f.status.textContent,'Screen awake');f.stop();
});
test('OS release does not trigger retry loop; user can retry after denial',async()=>{
 let requests=0,onrelease;const f=fixture(async()=>{requests++;if(requests===1)throw Error('denied');return {release:async()=>{},addEventListener:(k,fn)=>onrelease=fn};});
 await flush();assert.equal(f.status.textContent,'Screen awake unavailable');
 f.events.pointerdown();await flush();assert.equal(f.status.textContent,'Screen awake');
 onrelease();await flush();assert.equal(requests,2);assert.equal(f.status.textContent,'Screen awake paused');f.stop();
});
test('unsupported browser displays an honest status',()=>{
 const status={setAttribute(){}};
 const stop=initScreenAwake({createElement:()=>status,getElementById:()=>null},{},{});
 assert.equal(status.textContent,'Screen awake unavailable');stop();
});

test('idle foreground recovers a revoked lock without a tap; hidden app stays paused',async()=>{
 let requests=0,onrelease;
 const f=fixture(async()=>{requests++;return {release:async()=>{},addEventListener:(event,fn)=>onrelease=fn};});
 await flush();onrelease();assert.equal(f.status.textContent,'Screen awake paused');
 f.events.healthCheck();await flush();assert.equal(requests,2);assert.equal(f.status.textContent,'Screen awake');
 f.doc.visibilityState='hidden';f.events.visibilitychange();f.events.healthCheck();await flush();assert.equal(requests,2);
 f.stop();assert.equal(f.events.healthCheck,undefined);
});