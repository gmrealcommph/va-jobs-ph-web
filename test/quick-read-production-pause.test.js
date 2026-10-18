import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
test('proposed pause blocks actual live auto/recovery definitions and permits in-flight finish',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});
 const token='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const scalar=async sql=>(await db.query(sql)).rows[0].value;
 try{
  await db.exec(`create schema extensions;create extension pgcrypto with schema extensions;
   create table jobs(id bigint,description text,status text,philippines_eligible boolean);
   create view public_jobs as select * from jobs;
   insert into jobs values(1,repeat('Eligible Philippines role description. ',5),'active',true),(2,repeat('Eligible Philippines role description. ',5),'active',true);
   create table quick_read_control(id boolean,next_claim_at timestamptz);insert into quick_read_control values(true,'-infinity');
   create table quick_read_auto_control(id boolean,enabled boolean,activated_at timestamptz);insert into quick_read_auto_control values(true,true,now()-interval '1 day');
   create table quick_read_rollout_stop(id boolean,enabled boolean,ongoing boolean,claims integer,reserved_usd numeric,worst_request_usd numeric,budget_usd numeric,cooldown_until timestamptz,pause_reason text);
   insert into quick_read_rollout_stop values(true,true,true,0,0,0.14,null,null,null);
   create table quick_read_auto_queue(job_id text,state text,attempts integer,next_attempt_at timestamptz,inserted_at timestamptz,updated_at timestamptz,recovery boolean,claim_token uuid,last_status text);
   insert into quick_read_auto_queue select id::text,'pending',0,now(),now(),now(),true,null,null from jobs;
   create table job_quick_reads(job_id text primary key,source_hash text,formatter_version text,status text,claim_token uuid,lease_until timestamptz,source_rules_version text,updated_at timestamptz,schema_version integer,error_code text,retry_after timestamptz,payload jsonb,failure_diagnostics jsonb,model text,generated_at timestamptz);`);
  const definitions=JSON.parse(await readFile(new URL('../evidence/production-20261018/database-functions.json',import.meta.url),'utf8'));
  for(const name of ['claim_job_quick_read_recovery','claim_job_quick_read_auto','finish_job_quick_read'])await db.exec(definitions.find(x=>x.proname===name).definition);
  assert.equal((await scalar(`select claim_job_quick_read_auto('1','source-organizer-v2','${token}','source-limits-v1') value`)).status,'claimed');
  await db.exec(await readFile(new URL('../docs/quick-read-pause-proposal.sql',import.meta.url),'utf8'));
  assert.equal((await scalar(`select claim_job_quick_read_auto('2','source-organizer-v2','${token}','source-limits-v1') value`)).status,'rollout_disabled');
  assert.equal((await scalar(`select claim_job_quick_read_recovery('2','source-organizer-v2','${token}','source-limits-v1') value`)).status,'rate_limited');
  assert.equal(await scalar('select count(*)::int value from job_quick_reads'),1);
  assert.equal((await scalar(`select finish_job_quick_read('1','${token}','{"version":2,"formatter":"source-organizer-v2"}','offline',2,null) value`)).status,'ready');
  assert.equal(await scalar("select next_claim_at='infinity'::timestamptz value from quick_read_control"),true);
  assert.equal(await scalar('select claims value from quick_read_rollout_stop'),1);
 }finally{await db.close();}
});
