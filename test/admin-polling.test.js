import {renderGalaxy,bindGalaxy} from '../public/admin-traffic-galaxy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {RegistrationTracker,PaymentTracker,refreshDelay,playRegistrationChime,playPaymentCelebration} from '../public/admin-live.js';
import {renderEmailUsage} from '../public/admin-email-health.js';
import {renderProviderBalances} from '../public/admin-balances.js';
import {renderTraffic} from '../public/admin-traffic.js';
import {completionCards} from '../public/admin-tool-completions.js';
const script=(await readFile(new URL('../public/admin.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
function element(){
 return {dataset:{},value:'',innerHTML:'',textContent:'',children:[],listeners:{},attributes:{},
  addEventListener(name,fn){this.listeners[name]=fn;},setAttribute(name,value){this.attributes[name]=value;},
  querySelector(){return this.button??=(element());},querySelectorAll(){return [];},
  append(...items){for(const item of items){item.parent=this;this.children.push(item);}},
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);},
  replaceChildren(){this.children=[];this.innerHTML='';}};
}
const signup=n=>({event_id:String(n).padStart(32,'0'),registered_at:new Date().toISOString()});
function data(events=[]){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return {revenue:[],members:11,new_members:0,pro_access:3,paid_pro_members:1,live_jobs:100,
  new_jobs:3,new_live_jobs:2,quick_period:{completed:4,errors:0},queue:[],quick_reads:[],
  runtime:{},errors:[],imports:[],payment_events:[],generated_at:new Date().toISOString(),start:today,end:today,
  daily:[{day:today,jobs:3,members:0,quick_reads:4,revenue_php:0}],
  registrations:{available:true,generated_at:new Date().toISOString(),events}};
}
async function page(){
 const nodes={},timers=new Map();let nextTimer=0;const responses=[{status:200,body:data([signup(1)])}];
 const document={hidden:false,listeners:{},getElementById:id=>nodes[id]??=(element()),createElement:element,
  addEventListener(name,fn){this.listeners[name]=fn;}};
 document.getElementById('period').value='7';document.getElementById('signup-notifications');
 const state={calls:[],responses};
 const context=vm.createContext({completionCards,RegistrationTracker,PaymentTracker,refreshDelay,playRegistrationChime,playPaymentCelebration,renderEmailUsage,renderProviderBalances,renderTraffic,renderGalaxy,bindGalaxy,document,Intl,Date,Number,String,URLSearchParams,AbortSignal:{},AbortController,
  setTimeout(fn,delay){timers.set(++nextTimer,{fn,delay});return nextTimer;},clearTimeout(id){timers.delete(id);},
  async fetch(url){state.calls.push(url);const r=responses.shift();if(r instanceof Error)throw r;if(!r)throw new Error('Unexpected request');return {status:r.status,ok:r.status===200,json:async()=>r.body};}});
 vm.runInContext("'use strict';\n"+script,context);await new Promise(setImmediate);
 return {nodes,timers,document,state,context,async poll(){const entry=[...timers].find(([,t])=>t.delay>=15000);assert.ok(entry);timers.delete(entry[0]);entry[1].fn();await new Promise(setImmediate);}};
}
test('overview preserves three measured charts and an illustrative collection card and uses existing records for compact operations and collection health',async()=>{
 const p=await page();
 assert.equal((p.nodes.overview.innerHTML.match(/class="card /g)||[]).length,4);
 assert.equal((p.nodes['quick-stats'].innerHTML.match(/class="card /g)||[]).length,6);
 for(const label of ['Members','Jobs','Quick Reads','Across the job boards'])assert.match(p.nodes.overview.innerHTML,new RegExp('<h3>'+label+'</h3>'));
 assert.match(p.nodes.overview.innerHTML,/not a live processing log/);assert.match(p.nodes.overview.innerHTML,/jobs-bar-chart/);assert.doesNotMatch(p.nodes.overview.innerHTML,/<h3>Revenue<\/h3>/);assert.doesNotMatch(p.nodes['quick-stats'].innerHTML,/Quick Reads completed/);
 assert.match(p.nodes['quick-stats'].innerHTML,/Queued Quick Reads/);
 const report=data();report.daily.unshift({day:'2026-10-02',jobs:999,members:1,quick_reads:0,revenue_php:0});
 report.imports=[{source:'<bad>',last_collected_at:report.generated_at,new_jobs:7}];report.queue=[{state:'pending',count:41},{state:'running',count:1}];
 p.state.responses.push({status:200,body:report});await p.poll();
 assert.doesNotMatch(p.nodes.overview.innerHTML,/>999</);
 assert.match(p.nodes['collection-health'].innerHTML,/&lt;bad&gt;/);assert.match(p.nodes['collection-health'].innerHTML,/sources collected within 24h/);
 assert.match(p.nodes['quick-stats'].innerHTML,/>41</);assert.match(p.nodes.overview.innerHTML,/class="chart-line" d="M[^"]* C/);
 assert.equal(p.state.calls.length,2);
});
test('sound defaults on, unlocks only after interaction, and can be muted',async()=>{
 const p=await page();assert.equal(vm.runInContext('chimeEnabled',p.context),true);
 assert.equal(p.nodes['signup-chime'].attributes['aria-checked'],'true');
 assert.equal(vm.runInContext('audioContext',p.context),null);
 p.nodes['signup-chime'].listeners.click();assert.equal(vm.runInContext('chimeEnabled',p.context),false);
 assert.equal(p.nodes['signup-chime'].attributes['aria-checked'],'false');
 p.nodes['signup-chime'].listeners.click();assert.equal(vm.runInContext('chimeEnabled',p.context),true);
});

test('compact insights preserve measured zero, unavailable states and escaped sources',async()=>{
 const p=await page();
 const unknown=vm.runInContext('renderOverviewInsights({})',p.context);
 assert.match(unknown,/Member details unavailable/);assert.match(unknown,/Traffic data temporarily unavailable/);assert.match(unknown,/First-party activity tracking is not connected/);assert.match(unknown,/flip-unavailable/);
 const report=data();report.extended={available:true,members:{verified:0,unverified:0,cohort_registered:0,cohort_verified_now:0,cohort_purchased_now:0}};
 report.visitors={attribution:{available:true,sources:[{source:'<script>bad</script>',visits:0}]}};
 report.traffic={available:true,sessions:0,sources:[]};report.live_visitors={available:true,visits:0};
 p.state.responses.push({status:200,body:report});await p.poll();
 const html=p.nodes['overview-insights'].innerHTML;assert.match(html,/Verified · now/);assert.match(html,/>0<\/strong>/);assert.doesNotMatch(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|NaN|undefined/);
 assert.match(html,/0 registrations/);assert.match(html,/Cohort verified<\/span><strong>—/);
});

test('traffic totals include all sources; email section preserves exhausted, uncapped and unknown quota',async()=>{
 const p=await page(),report=data();
 report.visitors={attribution:{available:true,sources:[{source:'A',visits:9},{source:'B',visits:4},{source:'C',visits:2},{source:'<D>',visits:1},{source:'E',visits:1}]}};
 report.traffic={available:true,sessions:17,sources:[{channel:'Google organic',sessions:9},{channel:'Direct / unknown',sessions:4},{channel:'Referrals',sessions:2},{channel:'Facebook',sessions:1},{channel:'<D>',sessions:1}]};
 report.email_health={usage:{available:true,daily:{used:135,limit:100,level:'critical'},monthly:{used:135,limit:null,level:'normal'}}};
 p.context.report=report;let html=vm.runInContext('renderOverviewInsights(report)',p.context);
 assert.ok(html.includes('>17</strong>'));assert.match(html,/Other: 1 sessions/);p.state.responses.push({status:200,body:report});await p.poll();assert.match(p.nodes.email.innerHTML,/135.0%/);assert.match(p.nodes.email.innerHTML,/Quota exhausted/);assert.match(p.nodes.email.innerHTML,/135 \/ Uncapped/);assert.doesNotMatch(html,/NaN|undefined|<D>/);
 report.email_health.usage.daily={used:10,limit:null,level:'normal'};p.state.responses.push({status:200,body:report});await p.poll();assert.match(p.nodes.email.innerHTML,/10 \/ Uncapped/);assert.doesNotMatch(p.nodes.email.innerHTML,/daily remaining/);
 report.email_health.usage.available=false;p.state.responses.push({status:200,body:report});await p.poll();assert.match(p.nodes.email.innerHTML,/Quota unknown/);assert.doesNotMatch(p.nodes.email.innerHTML,/daily remaining/);
});

test('Action Center prioritizes urgent issues and keeps inspection links read-only and escaped',async()=>{
 const p=await page();p.context.issues=[{severity:'warning',title:'Collection late',href:'#imports'},{severity:'critical',title:'<Quota exhausted>',href:'#email-health'},{severity:'high',title:'Failed reads',href:'#operations'}];
 const html=vm.runInContext('renderActions(issues)',p.context);
 assert.ok(html.indexOf('&lt;Quota exhausted&gt;')<html.indexOf('Collection late'));assert.match(html,/Inspect email health/);assert.match(html,/2 more issues/);assert.doesNotMatch(html,/<Quota exhausted>|<button/);
 assert.match(vm.runInContext('renderActions([])',p.context),/Unconnected monitors cannot confirm health/);
});
test('automatic refresh detects each signup once and leaves existing accounts quiet',async()=>{
 const p=await page();assert.equal(p.nodes['signup-notifications'].children.length,0);
 assert.ok([...p.timers.values()].some(t=>t.delay===30000));
 const events=[signup(1),signup(2),signup(3)];
 p.state.responses.push({status:200,body:data(events)});await p.poll();
 assert.equal(p.nodes['signup-notifications'].children.length,1);
 assert.equal(vm.runInContext('signupQueue.length',p.context),1);
 p.state.responses.push({status:200,body:data(events)});await p.poll();
 assert.equal(vm.runInContext('signupQueue.length',p.context),1);
});
test('polling preserves custom periods and refreshes every 30 seconds',async()=>{
 const p=await page();p.nodes.period.value='custom';p.nodes.start.value='2026-10-01';p.nodes.end.value='2026-10-03';
 p.state.responses.push({status:200,body:data()});await p.poll();
 assert.match(p.state.calls.at(-1),/start=2026-10-01&end=2026-10-03/);
 assert.ok([...p.timers.values()].some(t=>t.delay===30000));
});
test('hidden tabs suspend polling and regain current data on return',async()=>{
 const p=await page();p.document.hidden=true;p.document.listeners.visibilitychange();assert.equal(p.timers.size,0);
 p.state.responses.push({status:200,body:data([signup(1),signup(2)])});
 p.document.hidden=false;p.document.listeners.visibilitychange();await new Promise(setImmediate);
 assert.equal(p.state.calls.length,2);assert.equal(p.nodes['signup-notifications'].children.length,1);
});
test('temporary failure retains prior data and backs off; expired access clears it and stops polling',async()=>{
 const p=await page();p.state.responses.push(new Error('Network unavailable'));await p.poll();
 assert.ok(p.nodes.overview.innerHTML);assert.ok(p.nodes['provider-balances'].innerHTML);assert.ok([...p.timers.values()].some(t=>t.delay===60000));
 p.state.responses.push({status:401,body:{error:'Please sign in again.'}});await p.poll();
 assert.equal(p.nodes.overview.innerHTML,'');assert.equal(p.nodes['provider-balances'].innerHTML,'');assert.equal(p.nodes['quick-stats'].innerHTML,'');assert.equal(p.nodes['collection-health'].innerHTML,'');assert.equal(p.timers.size,0);
 assert.match(p.nodes.status.textContent,/sign in again/i);
});


test('verified payment notification uses its own sound once and survives period changes without replay',async()=>{
 const p=await page();const baseline=new Date(Date.now()-2000).toISOString();
 const first=data();first.confirmed_payments={available:true,generated_at:baseline,events:[]};
 p.state.responses.push({status:200,body:first});await p.poll();
 vm.runInContext("chimeEnabled=true;audioContext={state:'running'}",p.context);
 let celebrations=0,registrations=0;
 p.context.playPaymentCelebration=()=>{celebrations++;return true;};p.context.playRegistrationChime=()=>{registrations++;return true;};
 const next=data();next.confirmed_payments={available:true,generated_at:new Date().toISOString(),events:[{event_id:'a'.repeat(32),confirmed_at:new Date(Date.now()-1000).toISOString(),amount_minor:49900,currency:'PHP'}]};
 p.state.responses.push({status:200,body:next});await p.poll();
 assert.equal(celebrations,1);assert.equal(registrations,0);assert.equal(p.nodes['signup-notifications'].children[0].children[0].textContent,'Payment confirmed!');
 p.nodes.period.value='30';p.state.responses.push({status:200,body:next});await p.poll();assert.equal(celebrations,1);
});
