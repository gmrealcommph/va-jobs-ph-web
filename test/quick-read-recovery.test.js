import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {generateJob,quickReadEndpoint} from '../src/quick-read-service.js';
import {failureDiagnostics} from '../src/quick-read-diagnostics.js';
import {sourceFingerprint,sourceUnits,SECTIONS,validateSelection,generateWithProvider} from '../src/quick-read-generation.js';
const source='About the role\nCoordinate customer relationships across a distributed team.\nClear communication and accurate reporting are part of the role.\nExcel experience is preferred.';
const token='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const selection=()=>({...Object.fromEntries(SECTIONS.map(k=>[k,[]])),other_details:sourceUnits(source).map(u=>u.id)});
const scalar=async(db,sql,args)=>(await db.query(sql,args)).rows[0].value;
async function database(recovery=true) {
 const db=new PGlite({extensions:{pgcrypto}});
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema extensions;
 create table public.jobs(id bigint primary key,description text,status text,philippines_eligible boolean);
 create view public.public_jobs as select * from public.jobs where status='active' and philippines_eligible;
 insert into public.jobs values (1,'${source}','active',true);`);
 for(const migration of recovery?['004_job_quick_read.sql','007_quick_read_recovery.sql']:['004_job_quick_read.sql']) await db.exec(await readFile(new URL('../migrations/'+migration,import.meta.url),'utf8'));
 return db;
}
const candidates=(db,cutoff=null,rules='source-limits-v1')=>db.query(`select * from public.quick_read_candidates_recovery('0',5,'source-organizer-v2',$1,$2)`,[rules,cutoff]).then(r=>r.rows);
const state=(db,cutoff=null)=>scalar(db,"select public.quick_read_recovery_state('source-organizer-v2','source-limits-v1',$1) as value",[cutoff]);
async function claim(db,rules='source-limits-v1') {return scalar(db,`select public.claim_job_quick_read_recovery('1','source-organizer-v2','${token}',$1) as value`,[rules]);}
async function finish(db,error=null,diagnostics=null,rules='source-limits-v1') {return scalar(db,`select public.finish_job_quick_read_with_diagnostics('1','${token}',$1,'test',2,$2,$3,$4) as value`,[error?null:validateSelection(selection(),source),error,diagnostics,rules]);}

test('additive migration preserves an existing successful cache byte-for-byte and its public projection',async()=>{
 const db=await database(false);try {
  await scalar(db,`select public.claim_job_quick_read('1','source-organizer-v2','${token}') as value`);
  await scalar(db,`select public.finish_job_quick_read('1','${token}',$1,'test',2,null) as value`,[validateSelection(selection(),source)]);
  const before=(await db.query('select * from public.job_quick_reads')).rows[0];
  const publicBefore=await scalar(db,"select public.public_job_detail_enrichment('1') as value");
  await db.exec(await readFile(new URL('../migrations/007_quick_read_recovery.sql',import.meta.url),'utf8'));
  const after=(await db.query('select * from public.job_quick_reads')).rows[0];
  assert.equal(after.failure_diagnostics,null);assert.equal(after.source_rules_version,null);
  delete after.failure_diagnostics;delete after.source_rules_version;assert.deepEqual(after,before);
  assert.deepEqual(await scalar(db,"select public.public_job_detail_enrichment('1') as value"),publicBefore);
  assert.equal((await claim(db,'source-limits-v2')).status,'unchanged');
 }finally{await db.close();}
});

test('null recovery deadlines fail open for reclaimability, with state counters partitioning all missing jobs',async()=>{
 const db=await database();try {
  await claim(db);await finish(db,'provider_incomplete');
  await db.exec('update public.job_quick_reads set retry_after=null');
  assert.deepEqual(await candidates(db),[{id:'1'}]);
  await db.exec("update public.job_quick_reads set status='running',lease_until=null");
  assert.deepEqual(await candidates(db),[{id:'1'}]);
  const s=await state(db);assert.equal(s.missing,s.candidates+s.deferred+s.terminal+s.attempted_failed);
  await db.query("update public.jobs set description=$1",[' '+ 'x'.repeat(40000)+' ']);
  assert.deepEqual(await candidates(db),[]);assert.equal((await state(db)).eligible,0);
 }finally{await db.close();}
});

test('expired running with matching hash/formatter/schema is selected; live lease waits; ready remains untouched',async()=>{
 const db=await database();try {
  await claim(db);await finish(db,'unsupported_requirement');
  await db.exec("update public.job_quick_reads set retry_after=now()-interval '1 second';update public.quick_read_control set next_claim_at='-infinity'");
  await claim(db);
  assert.deepEqual(await candidates(db),[]);assert.equal((await state(db)).deferred,1);
  await db.exec("update public.job_quick_reads set lease_until=now()-interval '1 second'");
  assert.deepEqual(await candidates(db),[{id:'1'}]);
  assert.deepEqual((await db.query("select * from public.quick_read_candidates('0',5,'source-organizer-v2')")).rows,[{id:'1'}]);
  await db.exec("update public.quick_read_control set next_claim_at='-infinity'");
  assert.equal((await claim(db)).status,'claimed');await finish(db);
  const before=(await db.query('select * from public.job_quick_reads')).rows;
  assert.equal((await claim(db)).status,'unchanged');assert.deepEqual(await candidates(db),[]);
  assert.deepEqual((await db.query('select * from public.job_quick_reads')).rows,before);
 }finally{await db.close();}
});

test('legacy deterministic failures are blocked without row rewrites; changed source/rules can recover',async()=>{
 const db=await database();try {
  await claim(db);
  // Simulate the legacy finisher, which stored no source-rules version.
  await scalar(db,`select public.finish_job_quick_read('1','${token}',null,'test',2,'unsupported_source') as value`);
  await db.exec("update public.job_quick_reads set source_rules_version=null,retry_after=now()-interval '1 hour'");
  const before=(await db.query('select * from public.job_quick_reads')).rows;
  assert.deepEqual(await candidates(db),[]);assert.equal((await state(db)).terminal,1);
  assert.equal((await claim(db)).status,'unsupported');
  assert.deepEqual((await db.query('select * from public.job_quick_reads')).rows,before);
  // A null legacy version is conservatively blocked under every rules version;
  // only known-version failures automatically retry when rules change.
  await db.exec("update public.job_quick_reads set source_rules_version='source-limits-v1',retry_after='infinity';update public.quick_read_control set next_claim_at='-infinity'");
  assert.deepEqual(await candidates(db,null,'source-limits-v2'),[{id:'1'}]);
  assert.equal((await claim(db,'source-limits-v2')).status,'claimed');
  await finish(db,'unsupported_source',null,'source-limits-v2');
  assert.equal(await scalar(db,"select retry_after='infinity'::timestamptz as value from public.job_quick_reads"),true);
  await db.query("update public.jobs set description=description || ' A source change.'");
  assert.deepEqual(await candidates(db),[{id:'1'}]);
 }finally{await db.close();}
});

test('recovery snapshot sees lower-ID cooldown/new jobs and never retries this run\'s unchanged failure',async()=>{
 const db=await database();try {
  const cutoff=new Date(Date.now()-10000).toISOString();
  await claim(db);await finish(db,'unsupported_requirement');
  await db.exec("update public.job_quick_reads set updated_at=now()-interval '1 day'");
  let s=await state(db,cutoff);assert.equal(s.deferred,1);assert.ok(s.next_check_at);
  await db.exec("update public.job_quick_reads set retry_after=now()-interval '1 second'");
  assert.deepEqual(await candidates(db,cutoff),[{id:'1'}]);
  await db.exec("update public.quick_read_control set next_claim_at='-infinity'");
  await claim(db);await finish(db,'unsupported_requirement');
  await db.exec("update public.job_quick_reads set retry_after=now()-interval '1 second'");
  s=await state(db,cutoff);assert.equal(s.attempted_failed,1);assert.equal(s.candidates,0);
  await db.query("insert into public.jobs values (99,$1,'active',true)",[source]);
  s=await state(db,cutoff);assert.equal(s.candidates,1);assert.deepEqual(await candidates(db,cutoff),[{id:'99'}]);
  // A later independent run can reconsider the transient failure.
  assert.deepEqual(await candidates(db),[{id:'1'},{id:'99'}]);
 }finally{await db.close();}
});

test('diagnostics are private, bounded, source-bound and cleared after success; invalid secrets never persist',async()=>{
 const db=await database();try {
  const bad={...selection(),requirements:[1,999],other_details:[0,2,3]};
  const diag=failureDiagnostics(bad,source,'invalid_source_reference');
  await claim(db);await finish(db,'invalid_source_reference',diag);
  assert.deepEqual(await scalar(db,'select failure_diagnostics as value from public.job_quick_reads'),diag);
  await db.exec('set role anon');
  await assert.rejects(db.query('select failure_diagnostics from public.job_quick_reads'),/permission denied/);
  await assert.rejects(state(db),/permission denied/);
  await assert.rejects(claim(db),/permission denied/);
  await db.exec("reset role;update public.job_quick_reads set retry_after=now()-interval '1 second';update public.quick_read_control set next_claim_at='-infinity'");
  await claim(db);
  await assert.rejects(finish(db,'invalid_schema',{...diag,provider_body:'secret-value'}),/Invalid diagnostic metadata/);
  assert.equal(await scalar(db,'select status as value from public.job_quick_reads'),'running');
  await finish(db);assert.equal(await scalar(db,'select failure_diagnostics as value from public.job_quick_reads'),null);
  assert.equal(await scalar(db,"select public.quick_read_valid_diagnostics($1) as value",[{...diag,selection:{other_details:['secret-value']}}]),false);
  const noVersion={...diag};delete noVersion.version;
  assert.equal(await scalar(db,"select public.quick_read_valid_diagnostics($1) as value",[noVersion]),false);
 }finally{await db.close();}
});

test('wrong token/source change cannot attach diagnostics or overwrite a newer result',async()=>{
 const db=await database();try {
  await claim(db);
  const diag=failureDiagnostics(selection(),source,'source_omitted');
  const wrong=await scalar(db,"select public.finish_job_quick_read_with_diagnostics('1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null,'test',2,'source_omitted',$1,'source-limits-v1') as value",[diag]);
  assert.equal(wrong.status,'claim_expired');
  await db.query("update public.jobs set description=description || ' changed'");
  assert.equal((await finish(db,'source_omitted',diag)).status,'source_changed');
  assert.equal(await scalar(db,'select failure_diagnostics as value from public.job_quick_reads'),null);
 }finally{await db.close();}
});

for(const code of ['unsupported_requirement','invalid_source_reference','preference_upgraded','source_omitted']) {
 test(`provider ${code} preserves offending integer selection without provider internals`,async()=>{
  const bad=selection();
  if(code==='unsupported_requirement') {bad.requirements=[1];bad.other_details=[0,2,3];}
  if(code==='invalid_source_reference') bad.other_details.push(999);
  if(code==='preference_upgraded') {bad.requirements=[3];bad.other_details=[0,1,2];}
  if(code==='source_omitted') bad.other_details.pop();
  let finishArgs;
  const result=await generateJob({OPENAI_API_KEY:'test-only',QUICK_READ_MODEL:'mock'},'1',{
   call:async(e,name,args)=>name==='claim_job_quick_read_recovery'?{status:'claimed',description:source,source_hash:await sourceFingerprint(source)}:(finishArgs=args,{status:'failed'}),
   generate:async()=>generateWithProvider({OPENAI_API_KEY:'secret-test',QUICK_READ_MODEL:'mock'},source,async()=>Response.json({status:'completed',id:'private-response-id',reasoning:'private-reasoning',output:[{content:[{type:'output_text',text:JSON.stringify(bad)}]}]}))
  });
  assert.equal(result.error,code);assert.deepEqual(finishArgs.p_diagnostics.selection,bad);
  for(const forbidden of ['secret-test','private-response-id','private-reasoning',source]) assert.ok(!JSON.stringify(finishArgs.p_diagnostics).includes(forbidden));
 });
}
test('unsafe reference strings are redacted and oversized selections are explicitly truncated',()=>{
 const diag=failureDiagnostics({...selection(),other_details:Array(900).fill('secret-string')},source,'invalid_source_reference');
 assert.equal(diag.truncated,true);assert.equal(diag.selection.other_details.length,512);assert.equal(diag.invalid_reference_count,900);
 assert.ok(!JSON.stringify(diag).includes('secret-string'));
});
test('diagnostics retain original provider IDs even when material routing was corrected before another guard failed',async()=>{
 const description=source+'\nReliable laptop and internet connection.\nAn additional ordinary sentence about the team.';
 const original={...selection(),responsibilities:[4],requirements:[5]};
 let failure;
 try {await generateWithProvider({OPENAI_API_KEY:'test',QUICK_READ_MODEL:'mock'},description,async()=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(original)}]}]}));}
 catch(error){failure=error;}
 assert.equal(failure.message,'unsupported_requirement');assert.deepEqual(failure.quickReadSelection,original);
 assert.deepEqual(failureDiagnostics(failure.quickReadSelection,description,failure.message).selection,original);
});
test('unsupported sources never call provider; uncommitted failures return actual finish state',async()=>{
 const long=Array.from({length:275},(_,i)=>`Source line ${i} describing ordinary work responsibilities.`).join('\n');
 let args;
 const result=await generateJob({},'15959',{call:async(e,name,a)=>name==='claim_job_quick_read_recovery'?{status:'claimed',description:long,source_hash:await sourceFingerprint(long)}:(args=a,{status:'failed'}),generate:()=>assert.fail('must not generate')});
 assert.equal(result.error,'unsupported_source');assert.equal(args.p_diagnostics,null);
 const claimExpired=await generateJob({},'1',{call:async(e,name)=>name==='claim_job_quick_read_recovery'?{status:'claimed',description:source,source_hash:await sourceFingerprint(source)}:{status:'claim_expired'},generate:async()=>{throw new Error('provider_incomplete');}});
 assert.equal(claimExpired.status,'claim_expired');assert.equal(claimExpired.error,undefined);
});
test('recovery endpoint checks auth/protocol, only queries state and passes the run cutoff to candidates',async()=>{
 const env={QUICK_READ_MODE:'manual',QUICK_READ_BATCH_ENABLED:'true',QUICK_READ_ADMIN_TOKEN:'x'.repeat(32),OPENAI_API_KEY:'test',QUICK_READ_MODEL:'mock'};
 const started=new Date().toISOString();const calls=[];
 const deps={call:async(e,name,args)=>{calls.push({name,args});return name==='quick_read_recovery_state'?{protocol_version:1,candidates:0}:[];}};
 const request=body=>new Request('https://test',{method:'POST',headers:{authorization:'Bearer '+env.QUICK_READ_ADMIN_TOKEN},body:JSON.stringify(body)});
 const response=await quickReadEndpoint(request({mode:'recovery',run_started_at:started}),env,null,deps);
 assert.equal(response.status,200);assert.equal(calls[0].name,'quick_read_recovery_state');assert.equal(calls.length,1);
 await quickReadEndpoint(request({limit:5,after_id:'0',run_started_at:started}),env,null,deps);
 assert.equal(calls[1].args.p_run_started_at,started);
 for(const body of [{mode:'recovery'},{mode:'recovery',run_started_at:'invalid'},{mode:'recovery',run_started_at:started,extra:'bad'},{limit:5,run_started_at:'2000-01-01T00:00:00.000Z'},{mode:'recovery',run_started_at:new Date(Date.now()+60000).toISOString()}]) assert.equal((await quickReadEndpoint(request(body),env,null,deps)).status,400);
 assert.equal((await quickReadEndpoint(new Request('https://test',{method:'POST',body:JSON.stringify({mode:'recovery',run_started_at:started})}),env,null,deps)).status,401);
});
