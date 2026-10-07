import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {generateWithProvider,sourceFingerprint,sourceUnits,SECTIONS,validateSelection} from '../src/quick-read-generation.js';
import {generateJob} from '../src/quick-read-service.js';
import {providerFailureDiagnostics} from '../src/quick-read-provider-diagnostics.js';
const source='About the role\nCoordinate customer relationships across a distributed team.\nClear communication and accurate reporting are part of the role.';
const env={QUICK_READ_PROVIDER:'openai',QUICK_READ_MODEL:'test-model',OPENAI_API_KEY:'SECRET_SENTINEL'};
const token='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const response=data=>async()=>({ok:true,status:200,json:async()=>data});
async function failure(data) {
  try { await generateWithProvider(env,source,async(url,init)=>{
    assert.equal(JSON.parse(init.body).max_output_tokens,16000);
    return response(data)(url,init);
  }); assert.fail('Expected failure'); }
  catch(error) { assert.equal(error.message,'provider_incomplete'); return error; }
}
for(const [name,data,expected] of [
  ['unfinished empty response',{status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[]},
    {code:'response_not_completed',status:'incomplete',reason:'max_output_tokens',output_array:true,output_count:0,text_present:false}],
  ['unfinished response with text',{status:'in_progress',output:[{content:[{type:'output_text',text:'PRIVATE_GENERATED_CONTENT'}]}]},
    {status:'in_progress',content_array:true,text_count:1,text_present:true}],
  ['completed response missing output',{status:'completed'},
    {code:'missing_output_array',output_array:false,output_count:0}],
  ['completed response with non-array output',{status:'completed',output:{private:'PRIVATE_GENERATED_CONTENT'}},
    {code:'missing_output_array',output_array:false}],
  ['missing status with empty text',{output:[{content:[{type:'output_text',text:''}]}]},
    {status:'missing',text_count:1,text_present:false}],
  ['unfinished missing content',{status:'failed',output:[{}]},
    {status:'failed',content_array:false,text_count:0}],
]) test(name,async()=>{
  const error=await failure(data);
  for(const [key,value] of Object.entries(expected)) assert.equal(error.quickReadProviderDiagnostics[key],value);
  assert.equal(error.quickReadProviderDiagnostics.http_status,200);
  assert.ok(JSON.stringify(error.quickReadProviderDiagnostics).length<2048);
  assert.doesNotMatch(JSON.stringify(error.quickReadProviderDiagnostics),/PRIVATE_GENERATED_CONTENT|SECRET_SENTINEL/);
});
test('completed empty/missing-content output retains existing provider_invalid_output classification',async()=>{
  for(const output of [[],[{}],[{content:[]}]]) {
    await assert.rejects(generateWithProvider(env,source,response({status:'completed',output})),error=>{
      assert.equal(error.message,'provider_invalid_output');
      assert.equal(error.quickReadProviderDiagnostics,undefined);return true;
    });
  }
});
test('unknown statuses/reasons, bodies, model IDs, headers and reasoning cannot enter metadata',async()=>{
  const error=await failure({status:'PERSONAL_DATA',model:'PERSONAL_DATA',incomplete_details:{reason:'PERSONAL_DATA'},
    output:[{type:'reasoning',summary:'PERSONAL_DATA',content:[{type:'output_text',text:'PERSONAL_DATA'}]}],
    prompt:'PERSONAL_DATA',headers:{Authorization:'SECRET_SENTINEL'}});
  assert.equal(error.quickReadProviderDiagnostics.status,'other');
  assert.equal(error.quickReadProviderDiagnostics.reason,'other');
  assert.doesNotMatch(JSON.stringify(error.quickReadProviderDiagnostics),/PERSONAL_DATA|SECRET_SENTINEL/);
});
test('counts and structural scan are bounded; known reason and missing HTTP remain safe',()=>{
  const d=providerFailureDiagnostics({status:'incomplete',incomplete_details:{reason:'content_filter'},
    output:Array.from({length:2000},()=>({content:Array.from({length:300},()=>({type:'output_text',text:'private'}))}))});
  assert.equal(d.output_count,1000);assert.equal(d.text_count,256);assert.equal(d.scan_truncated,true);
  assert.equal(d.reason,'content_filter');assert.equal(d.http_status,null);
});
test('HTTP failure behavior remains unchanged and does not capture response body',async()=>{
  await assert.rejects(generateWithProvider(env,source,async()=>({ok:false,status:429,json:()=>assert.fail('Do not read error body')})),/provider_http_429/);
});
test('service forwards only structural incomplete metadata; null payload and error stay unchanged',async()=>{
  let finished;
  const result=await generateJob(env,'1',{call:async(e,name,args)=>name==='claim_job_quick_read_recovery'?
    {status:'claimed',description:source,source_hash:await sourceFingerprint(source)}:(finished=args,{status:'failed'}),
    generate:()=>generateWithProvider(env,source,response({status:'incomplete',output:[]}))});
  assert.deepEqual(result,{job_id:'1',status:'failed',error:'provider_incomplete'});
  assert.equal(finished.p_payload,null);assert.equal(finished.p_error,'provider_incomplete');
  assert.equal(finished.p_model,'test-model');assert.equal(finished.p_diagnostics.version,2);
});
async function database() {
  const db=new PGlite({extensions:{pgcrypto}});
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema extensions;
    create table public.jobs(id bigint primary key,description text,status text,philippines_eligible boolean);
    create view public.public_jobs as select * from public.jobs where status='active' and philippines_eligible;
    insert into public.jobs values (1,'${source}','active',true),(2,'${source}','active',true);`);
  for(const file of ['004_job_quick_read.sql','007_quick_read_recovery.sql']) await db.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
  return db;
}
const scalar=async(db,sql,args=[])=>(await db.query(sql,args)).rows[0].value;
test('008 accepts bounded v2 and v1/null, rejects payload leakage, and preserves function ACL and ready row',async()=>{
  const db=await database();try {
    const selection={...Object.fromEntries(SECTIONS.map(k=>[k,[]])),other_details:sourceUnits(source).map(u=>u.id)};
    await scalar(db,`select public.claim_job_quick_read_recovery('1','source-organizer-v2','${token}','source-limits-v1') as value`);
    await scalar(db,`select public.finish_job_quick_read_with_diagnostics('1','${token}',$1,'test-model',2,null,null,'source-limits-v1') as value`,[validateSelection(selection,source)]);
    const readyBefore=await scalar(db,"select to_jsonb(q) as value from public.job_quick_reads q where job_id='1'");
    const aclBefore=await scalar(db,"select proacl::text as value from pg_proc where oid='public.quick_read_valid_diagnostics(jsonb)'::regprocedure");
    const d=providerFailureDiagnostics({status:'incomplete',output:[]},200);
    const valid=value=>scalar(db,'select public.quick_read_valid_diagnostics($1) as value',[value]);
    assert.equal(await valid(d),false,'007 intentionally rejects new format');
    await db.exec(await readFile(new URL('../migrations/008_quick_read_provider_diagnostics.sql',import.meta.url),'utf8'));
    assert.equal(await valid(d),true);assert.equal(await valid(null),true);
    const {failureDiagnostics}=await import('../src/quick-read-diagnostics.js');
    assert.equal(await valid(failureDiagnostics(selection,source,'source_omitted')),true);
    for(const invalid of [{...d,prompt:'private'},{...d,status:'private'},{...d,reason:'private'},
      {...d,provider:'private'},{...d,output_count:1001},{...d,text_count:257},{...d,http_status:600},
      {...d,http_status:'200'},{...d,text_present:'private'},{...d,kind:'private'},
      {...d,code:'private'},{...d,output_count:0.5},{...d,text_count:-1},
      Object.fromEntries(Object.entries(d).filter(([key])=>key!=='http_status'))]) assert.equal(await valid(invalid),false);
    assert.deepEqual(await scalar(db,"select to_jsonb(q) as value from public.job_quick_reads q where job_id='1'"),readyBefore);
    assert.equal(await scalar(db,"select proacl::text as value from pg_proc where oid='public.quick_read_valid_diagnostics(jsonb)'::regprocedure"),aclBefore);
    await db.exec("update public.quick_read_control set next_claim_at=now()-interval '1 minute'");
    await scalar(db,`select public.claim_job_quick_read_recovery('2','source-organizer-v2','${token}','source-limits-v1') as value`);
    const result=await scalar(db,`select public.finish_job_quick_read_with_diagnostics('2','${token}',null,'test-model',2,'provider_incomplete',$1,'source-limits-v1') as value`,[d]);
    assert.equal(result.status,'failed');
    const stored=await scalar(db,"select jsonb_build_object('diagnostics',failure_diagnostics,'error',error_code,'lease',lease_until,'token',claim_token,'cooldown_ok',retry_after>now()+interval '59 minutes') as value from public.job_quick_reads where job_id='2'");
    assert.deepEqual(stored.diagnostics,d);assert.equal(stored.error,'provider_incomplete');assert.equal(stored.cooldown_ok,true);
    assert.equal(stored.lease,null);assert.equal(stored.token,null);
    await db.exec('set role anon');await assert.rejects(valid(d),/permission denied/);
    await db.exec('reset role');
    const migration007=await readFile(new URL('../migrations/007_quick_read_recovery.sql',import.meta.url),'utf8');
    const rollback=migration007.match(/create function public\.quick_read_valid_diagnostics\(d jsonb\)[\s\S]*?end \$\$;/)[0].replace('create function','create or replace function');
    await db.exec(rollback);
    assert.equal(await valid(d),false);assert.equal(await valid(null),true);
    assert.equal(await valid(failureDiagnostics(selection,source,'source_omitted')),true);
    assert.deepEqual(await scalar(db,"select failure_diagnostics as value from public.job_quick_reads where job_id='2'"),d);
    assert.deepEqual(await scalar(db,"select to_jsonb(q) as value from public.job_quick_reads q where job_id='1'"),readyBefore);
  } finally {await db.close();}
});
