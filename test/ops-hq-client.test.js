// Runs the real scene script (public/ops-hq/ops-hq.js) in Node with a stubbed DOM/WebGL and checks the live-data logic.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const pub=path.resolve('public/ops-hq');
const mk=()=>{const f=function(){};return new Proxy(f,{get(t,k){if(k===Symbol.toPrimitive||k==='valueOf')return ()=>0;if(k==='toString')return ()=>'0';if(k==='then')return undefined;if(k===Symbol.iterator)return function*(){};if(k==='length')return 0;return mk()},apply(){return mk()},construct(){return mk()},set(){return true}})};
const ctx=mk(),els={},timers=[],calls=[],reacts=[];
const el=(id)=>els[id]||(els[id]={style:{},remove(){},clientWidth:1600,clientHeight:900,onclick:null,children:new Proxy([],{get:(t,k)=>(typeof k==='string'&&/^\d+$/.test(k))?{textContent:'x',animate(){return{}}}:t[k]}),appendChild(){},setAttribute(){},classList:{toggle(){},add(){},remove(){}},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1600,height:900}),animate(){},set innerHTML(v){},value:'',options:[],textContent:'',parentElement:{}});
const doc={createElement:()=>({width:0,height:0,getContext:()=>ctx,style:{},appendChild(){},addEventListener(){},remove(){},classList:{add(){},remove(){},toggle(){}},animate(){return{}},set innerHTML(v){},children:[],textContent:'',className:'',setAttribute(){}}),getElementById:el,querySelector:()=>({textContent:'',style:{}}),querySelectorAll:()=>[],fonts:{ready:Promise.resolve()},hidden:false,addEventListener(){}};
doc.body={classList:{toggle(){},contains:()=>true,remove(){}},style:{setProperty(){}}};doc.documentElement={};
Object.assign(globalThis,{window:{THREE:mk()},document:doc,addEventListener(){},innerWidth:2456,innerHeight:1500,location:{search:'',pathname:'/test'},matchMedia:()=>({matches:false}),
  ResizeObserver:class{observe(){}},requestAnimationFrame(){},setInterval(){},devicePixelRatio:1});
globalThis.setTimeout=(f)=>{timers.push(f);return timers.length};globalThis.clearTimeout=()=>{};
let live={body:null};
globalThis.fetch=async(u)=>{u=String(u);if(u.startsWith('/ops-hq/'))return new Response(fs.readFileSync(path.join(pub,u.slice(8))));calls.push(u);return new Response(JSON.stringify(live.body),{headers:{'content-type':'application/json'}});};
const src=fs.readFileSync(path.join(pub,'ops-hq.js'),'utf8');
const cut=src.indexOf('(async()=>{');
const AF=Object.getPrototypeOf(async function(){}).constructor;
await new AF(src.slice(0,cut)+src.slice(cut+11,src.lastIndexOf('})();')))();
const H=window.opsHq;H.onReact=(id,kind,o,sim)=>reacts.push({id,kind,label:o&&o.label,live:!!(o&&o.live),sim});
const flush=()=>{while(timers.length)timers.shift()();};
const M=(o={})=>({intake:{new_today:3,total:2600,growth_pct:1.2},jobs:{active:900,new_today:5,processing:null},reads:{queued:4,running:1,ready_total:3000,failed:2,stopped:6},pro:{active:41,upgrades_today:1,expiring_7d:3},refer:{},comms:{},health:{database:'healthy',edge:'healthy',queue_depth:4,alerts:0},chief:{},...o});
const P=(events=[],extra={})=>({generated_at:'2026-10-30T12:00:00Z',stale:false,metrics:M(),events,...extra});
const E=(id,at,o={})=>({event_id:id,desk:'intake',kind:'good',type:'member_registered',occurred_at:at,count:1,...o});
const reset=()=>{reacts.length=0;timers.length=0;calls.length=0;};

test('demo counters change only while live data is off; live mode never fabricates',async()=>{
  const base=H.st.tot;
  H.react('intake','good');assert.equal(H.st.tot,base+1,'offline demo may increment');
  live.body=P();H.setLive(true);await new Promise(r=>setImmediate(r));
  assert.equal(H.st.tot,2600);assert.equal(H.st.qd,4);  assert.equal(H.st.sent,null,'unavailable metric stays null, not a demo number');
  const before=JSON.stringify(H.st);reset();
  for(const id of ['intake','jobs','reads','pro','refer','comms','health','chief']){H.react(id,'good');H.react(id,'alert');H.react(id,'good',{live:true,label:'x'});}
  assert.equal(JSON.stringify(H.st),before,'previews and live reactions never change counters');
  assert.ok(reacts.filter(r=>!r.live).every(r=>r.sim===false));
  H.setLive(false);assert.equal(H.st.tot,2557,'turning live off restores the simulated baseline, not real numbers');
  assert.equal(H.st.sent,0);
});
test('first load never replays history; duplicates ignored; new ids react once',async()=>{
  reset();live.body=P([E('a','2026-10-30T11:59:00Z'),E('b','2026-10-30T11:59:30Z')]);H.setLive(true);await new Promise(r=>setImmediate(r));flush();
  assert.equal(reacts.length,0,'first payload is numbers only');assert.ok(H.state.seen.has('a')&&H.state.seen.has('b'));
  H.apply(P([E('a','2026-10-30T11:59:00Z'),E('b','2026-10-30T11:59:30Z')]));flush();
  assert.equal(reacts.length,0,'same ids again: nothing');
  H.apply(P([E('b','2026-10-30T11:59:30Z'),E('c','2026-10-30T12:00:00Z')]));flush();
  assert.equal(reacts.length,1);assert.deepEqual([reacts[0].id,reacts[0].live,reacts[0].label],['intake',true,'+1 member']);
});
test('events sharing a timestamp are all counted, grouped into one reaction',()=>{
  reset();const t='2026-10-30T12:05:00Z';
  H.apply(P([E('t1',t),E('t2',t),E('t3',t)]));flush();
  assert.equal(reacts.length,1);assert.match(reacts[0].label,/×3$/);
  reset();H.apply(P([E('t1',t),E('t2',t),E('t3',t),E('t4',t)]));flush();   // a later row with the same timestamp is still new
  assert.equal(reacts.length,1);assert.doesNotMatch(reacts[0].label,/×/);
});
test('long disconnection: backlog is applied silently, numbers still update',()=>{
  reset();H.state.at=Date.now()-10*60000;
  const evs=Array.from({length:50},(_,i)=>E('g'+i,'2026-10-30T12:'+String(10+Math.floor(i/10)).padStart(2,'0')+':'+String(i%10).padStart(2,'0')+'Z'));
  H.apply({...P(evs),metrics:M({intake:{new_today:9,total:2700,growth_pct:5}})});flush();
  assert.equal(reacts.length,0);assert.equal(H.st.tot,2700);assert.ok(H.state.seen.has('g49'));
  reset();H.apply(P([...evs,E('g50','2026-10-30T12:30:00Z')]));flush();
  assert.equal(reacts.length,1,'after catching up, only the genuinely new event reacts');
});
test('paging: has_more polls again quickly with exact since; normal polls use an overlap',()=>{
  reset();H.state.at=Date.now()-10*60000;H.state.since='2026-10-30T12:30:00Z';
  H.apply(P([E('p1','2026-10-30T12:31:00Z')],{has_more:true}));
  assert.ok(H.state.more>0);assert.match(H.sinceParam(),/since=2026-10-30T12%3A31%3A00.000Z$/);
  H.apply(P([E('p2','2026-10-30T12:32:00Z')],{has_more:false}));flush();
  assert.equal(reacts.length,0,'the last page of a catch-up is still backlog');
  assert.equal(H.state.more,0);assert.match(H.sinceParam(),/since=2026-10-30T12%3A30%3A00.000Z$/,'2-minute overlap after catching up');
  H.apply(P([E('p3','2026-10-30T12:33:00Z')]));flush();assert.equal(reacts.length,1);
});
test('bad payloads are rejected without touching state; stale and incomplete flags are tracked',()=>{
  const snap=JSON.stringify(H.st);
  assert.throws(()=>H.apply({foo:1}));assert.equal(JSON.stringify(H.st),snap);
  H.apply({...P(),stale:true,incomplete:true});assert.equal(H.state.stale,true);assert.equal(H.state.incomplete,true);
});
