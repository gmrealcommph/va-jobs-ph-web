import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import vm from 'node:vm';
import {adminEndpoint,quickReadSchedule} from '../src/admin.js';
import {processingState,renderProcessing,scheduleCountdown,startWaitingBallAnimation} from '../public/admin-quick-reads.js';
const time='2026-10-10T09:00:00Z';
const fixture=()=>({checked_at:time,counts:{queued:79,processing:0,completed:117,failed:16,total:212,stopped_other:0},running:[],gate:{enabled:true},automation:{enabled:true},runtime_enabled:true,recent:[]});

test('job balls use measured counts with static visible positions and no inline styles or funnel labels',()=>{
 const d=fixture();d.counts.queued=41;d.counts.processing=1;d.counts.completed=169;
 const html=renderProcessing(d);
 const balls=tone=>(html.match(new RegExp('<g class="qr-balls qr-balls-'+tone+'">([\\s\\S]*?)</g>'))?.[1].match(/<circle /g)||[]).length;
 assert.equal(balls('queue'),41);assert.equal(balls('work'),1);assert.equal(balls('done'),169);
 d.counts.queued=300;d.counts.processing=0;
 const capped=renderProcessing(d);assert.equal((capped.match(/<g class="qr-balls qr-balls-queue">([\s\S]*?)<\/g>/)[1].match(/<circle /g)||[]).length,200);assert.match(capped,/<g class="qr-balls qr-balls-work"><\/g>/);
 assert.doesNotMatch(capped,/style=|qr-ball-label/);assert.match(capped,/data-orbit-x=/);
 assert.doesNotMatch(renderProcessing(null),/class="qr-balls /);
});

test('waiting-ball positions move in paused queues without inline styling, and stop for reduced motion or hidden tabs',()=>{
 const attrs={},el={dataset:{orbitX:'100',orbitY:'20',orbitPhase:'0'},setAttribute:(name,value)=>attrs[name]=value};
 const reduced={matches:false,addEventListener:(name,fn)=>reduced.change=fn,removeEventListener(){}};
 let callback;const events={};const win={matchMedia:()=>reduced,requestAnimationFrame:fn=>{callback=fn;return 1;},cancelAnimationFrame:()=>callback=null};
 const doc={hidden:false,addEventListener:(name,fn)=>events[name]=fn,removeEventListener(){}};
 const root={firstElementChild:{classList:{contains:()=>false}},querySelectorAll:()=>[el]};
 const stop=startWaitingBallAnimation(root,win,doc);callback(1000);const first=attrs.cx;callback(3500);
 assert.notEqual(attrs.cx,first);assert.ok(Number(attrs.cx)>=200&&Number(attrs.cx)<=400);assert.ok(Number(attrs.cy)>=47&&Number(attrs.cy)<=87);
 doc.hidden=true;events.visibilitychange();assert.equal(callback,null);
 doc.hidden=false;events.visibilitychange();assert.equal(typeof callback,'function');
 reduced.matches=true;reduced.change();assert.equal(callback,null);assert.equal(attrs.cx,'400.00');
 stop();
});
test('next check follows the worker cron, including exact ticks and hour/day rollover',()=>{
 for(const [at,next] of [['2026-10-10T09:00:00Z','2026-10-10T09:01:00.000Z'],['2026-10-10T09:02:00Z','2026-10-10T09:03:00.000Z'],['2026-10-10T09:59:59Z','2026-10-10T10:00:00.000Z'],['2026-10-10T23:59:59Z','2026-10-11T00:00:00.000Z']])assert.equal(quickReadSchedule(at).next_expected_at,next);
 assert.equal(quickReadSchedule('invalid').available,false);
});
test('waiting countdown never implies activity and disappears when paused or stale',()=>{
 const d=fixture();d.schedule=quickReadSchedule(time);
 const html=renderProcessing(d);assert.match(html,/Waiting for next scheduled run/);assert.match(html,/1m 0s/);assert.doesNotMatch(html,/is-active/);
 assert.equal(scheduleCountdown(d.schedule.next_expected_at,Date.parse(time)+121000),'Scheduled check due · awaiting worker confirmation');
 d.gate.enabled=false;assert.doesNotMatch(renderProcessing(d),/data-next-check/);
 d.gate.enabled=true;assert.doesNotMatch(renderProcessing(d,46000),/data-next-check/);
});
test('animation requires a recent claim and valid lease, and expires without another poll',()=>{
 const d=fixture();assert.equal(processingState(d).state,'idle');
 d.running=[{started_at:'2026-10-10T08:59:30Z',lease_until:'2026-10-10T09:00:20Z'}];
 assert.equal(processingState(d).animate,true);assert.equal(processingState(d,21000).state,'stalled');
 assert.equal(processingState(d,46000).animate,false);
 d.running[0].lease_until=null;assert.equal(processingState(d).animate,false);
 d.running[0]={started_at:'2026-10-10T08:50:00Z',lease_until:'2026-10-10T09:01:00Z'};assert.equal(processingState(d).state,'unconfirmed');
});
test('paused, idle, stale queue, failure and unavailable states are distinct',()=>{
 const d=fixture();d.gate.enabled=false;assert.equal(processingState(d).state,'paused');
 d.gate.enabled=true;d.oldest_due='2026-10-10T08:00:00Z';assert.equal(processingState(d).state,'stalled');
 d.latest_worker_record='2026-10-10T08:59:00Z';assert.equal(processingState(d).state,'idle');
 d.recent=[{event:'failed'}];assert.equal(processingState(d).state,'failed');
 assert.equal(processingState(null).state,'unavailable');
});
test('job titles and failure codes are escaped; missing counts do not render false zeros',()=>{
 const d=fixture();d.recent=[{title:'<script>bad</script>',error_code:'<img>',event:'failed',at:time}];
 assert.doesNotMatch(renderProcessing(d),/<script>|<img>/);assert.match(renderProcessing(null),/—/);
});
test('monitor uses verified admin access, user JWT, no analytics integrations, GET only and no-store',async()=>{
 const req=method=>new Request('https://veeays.com/admin/api/quick-reads',{method});
 for(const [state,access,status] of [[{},true,401],[{user:{id:'member'},accessToken:'jwt'},false,403],[{user:{id:'owner'},accessToken:'jwt'},true,200]]){
 const calls=[];const r=await adminEndpoint(req('GET'),{QUICK_READ_AUTO_ENABLED:'true'},{session:async()=>state,call:async(e,t,n,b)=>{calls.push(n);assert.equal(t,'jwt');assert.deepEqual(b,{});return n==='veeays_admin_access'?access:fixture();},visitors:()=>assert.fail()});
 assert.equal(r.status,status);assert.match(r.headers.get('cache-control'),/no-store/);
 assert.deepEqual(calls,status===401?[]:status===403?['veeays_admin_access']:['veeays_admin_access','veeays_admin_quick_reads']);
 }
 assert.equal((await adminEndpoint(req('POST'),{},{session:()=>assert.fail()})).status,405);
});
test('database snapshots reconcile queue scope and deny anonymous/member access without mutating jobs',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema veeays_admin;grant usage on schema veeays_admin to authenticated;
 create function veeays_admin.has_access() returns boolean language sql as $$select current_setting('request.jwt.claim.sub',true)='owner'$$;
 create table jobs(id int,title text);
 create table job_quick_reads(job_id text,status text,error_code text,updated_at timestamptz,generated_at timestamptz,lease_until timestamptz);
 create table quick_read_auto_queue(job_id text,state text,inserted_at timestamptz,next_attempt_at timestamptz,updated_at timestamptz);
 create table quick_read_rollout_stop(id boolean,enabled boolean);create table quick_read_auto_control(id boolean,enabled boolean,activated_at timestamptz);
 insert into jobs values(1,'Queued'),(2,'Done'),(3,'Failed'),(4,'Running');
 insert into quick_read_auto_queue select id::text,case id when 1 then 'pending' when 2 then 'done' when 3 then 'stopped' else 'running' end,now()-interval '1 hour',now(),now() from jobs;
 insert into job_quick_reads values('2','ready',null,now(),now(),null),('3','failed','validation',now(),null,null),('4','running',null,now(),null,now()+interval '3 minutes'),('999','ready',null,now(),now(),null);
 insert into quick_read_rollout_stop values(true,false);insert into quick_read_auto_control values(true,true,now());`);
 await db.exec(await readFile(new URL('../migrations/admin-quick-reads.sql',import.meta.url),'utf8'));
 await db.exec('set role anon');await assert.rejects(db.query('select public.veeays_admin_quick_reads()'));
 await db.exec("reset role;set role authenticated;set request.jwt.claim.sub='member'");await assert.rejects(db.query('select public.veeays_admin_quick_reads()'));
 await db.exec("set request.jwt.claim.sub='owner'");
 const d=(await db.query('select public.veeays_admin_quick_reads() d')).rows[0].d;
 assert.deepEqual(d.counts,{queued:1,processing:1,completed:1,failed:1,stopped_other:0,total:4});assert.equal(d.all_reads.ready,2);
 assert.equal(d.throughput.last_hour,1);assert.equal(d.running[0].title,'Running');assert.equal(d.latest_completion.title,'Done');assert.equal(d.recent.length,4);
 await assert.rejects(db.query('select * from public.job_quick_reads'));
 await db.exec('reset role');assert.equal((await db.query('select count(*) n from quick_read_auto_queue')).rows[0].n,4);
 }finally{await db.close();}
});
test('polling supports older browsers and skewed tablet clocks, rejects stale server data, and clears on denied access',async()=>{
 const root={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]},events={},timeouts=new Map();
 let mono=0,id=0,requests=0,status=200,snapshotOffset=0;
 const doc={hidden:false,getElementById:()=>null,addEventListener:(name,fn)=>events[name]=fn};
 const ctx=vm.createContext({document:doc,window:{addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),requestAnimationFrame:()=>1,cancelAnimationFrame(){}},performance:{now:()=>mono},Date:class extends Date{static now(){return Date.parse(time)+mono+8*3600000;}},Intl,AbortSignal:{},AbortController,
 setTimeout:(fn,delay)=>{timeouts.set(++id,{fn,delay});return id;},clearTimeout:i=>timeouts.delete(i),setInterval:()=>1,clearInterval(){},
 fetch:async(url,options)=>{requests++;assert.equal(url,'/admin/api/quick-reads');assert.equal(options.method,undefined);assert.equal(options.cache,'no-store');return {status,ok:status===200,headers:{get:()=>new Date(Date.parse(time)+mono).toUTCString()},json:async()=>({...fixture(),checked_at:new Date(Date.parse(time)+mono+snapshotOffset).toISOString()})};}});
 const source=(await readFile(new URL('../public/admin-quick-reads.js',import.meta.url),'utf8')).replace(/^import [^\n]+\n/,'const updateProcessingCard=()=>{};\n').replaceAll('export ','');
 vm.runInContext(source,ctx);ctx.root=root;vm.runInContext('startProcessingMonitor(root)',ctx);
 const flush=()=>new Promise(resolve=>setImmediate(resolve));await flush();
 assert.equal(requests,1);assert.match(root.innerHTML,/79/);assert.equal([...timeouts.values()][0].delay,15000);
 doc.hidden=true;events.visibilitychange();assert.equal(timeouts.size,0);
 doc.hidden=false;mono+=15000;events.visibilitychange();await flush();assert.equal(requests,2);
 snapshotOffset=-60000;await [...timeouts.values()][0].fn();await flush();assert.match(root.innerHTML,/invalid or stale snapshot/);assert.doesNotMatch(root.innerHTML,/>79</);
 status=403;const timer=[...timeouts.values()][0];timeouts.clear();await timer.fn();await flush();
 assert.equal(timeouts.size,0);assert.doesNotMatch(root.innerHTML,/>79</);assert.match(root.innerHTML,/Monitoring unavailable/);
});
