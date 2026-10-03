import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {sourceFingerprint} from '../src/quick-read-generation.js';
const source='Coordinate client success operations in the Philippines.\nSalesforce and Excel experience required.\nPH work authorization required; no visa sponsorship.\nAI-generated or incomplete application answers will be auto-rejected.';
const token='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function database() {
  const db=new PGlite({extensions:{pgcrypto}});
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema extensions;
    create table public.jobs(id bigint primary key,title text,company text,description text,status text,philippines_eligible boolean,
      salary_min numeric,salary_max numeric,salary_currency text,salary_period text,employment_type text,internal_notes text);
    create view public.public_jobs as select id,title,company,description from public.jobs where status='active' and philippines_eligible and id<>3;
    grant select on public.public_jobs to anon,authenticated;
    insert into public.jobs(id,title,company,description,status,philippines_eligible,salary_min,salary_max,salary_currency,salary_period,employment_type,internal_notes)
    values(1,'Client Success Operations Coordinator','TechnologyAdvice','${source}','active',true,37500,46000,'PHP','month','Full Time','private');
    insert into public.jobs select 2,title,company,description,'inactive',true,salary_min,salary_max,salary_currency,salary_period,employment_type,internal_notes from public.jobs where id=1;
    insert into public.jobs select 3,title,company,description,'active',true,salary_min,salary_max,salary_currency,salary_period,employment_type,internal_notes from public.jobs where id=1;`);
  await db.exec(await readFile(new URL('../migrations/004_job_quick_read.sql',import.meta.url),'utf8'));
  return db;
}
const scalar=async(db,sql)=>(await db.query(sql)).rows[0].value;
test('migration and privileges: only public display fields, dedupe/inactive gate, no public cache or writes',async()=>{
  const db=await database();
  try {
    await db.exec('set role anon');
    const extra=await scalar(db,"select public.public_job_detail_enrichment('1') as value");
    assert.equal(extra.salary_min,37500);assert.equal(extra.employment_type,'Full Time');assert.equal(extra.internal_notes,undefined);
    assert.equal(await scalar(db,"select public.public_job_detail_enrichment('2') as value"),null);
    assert.equal(await scalar(db,"select public.public_job_detail_enrichment('3') as value"),null);
    await assert.rejects(db.query('select * from public.job_quick_reads'),/permission denied/);
    await assert.rejects(db.query(`select public.claim_job_quick_read('1','source-organizer-v2','${token}')`),/permission denied/);
  } finally {await db.close();}
});
test('claim lease, cross-job rate limit, finish revision binding, unchanged skip and changed regeneration',async()=>{
  const db=await database();
  try {
    const claim=()=>scalar(db,`select public.claim_job_quick_read('1','source-organizer-v2','${token}') as value`);
    const c=await claim();assert.equal(c.status,'claimed');assert.equal(c.source_hash,await sourceFingerprint(source));
    assert.equal((await claim()).status,'busy');
    await db.exec('update public.jobs set status=\'active\' where id=2');
    assert.equal((await scalar(db,`select public.claim_job_quick_read('2','source-organizer-v2','${token}') as value`)).status,'rate_limited');
    // DB stores service-validated payloads; Worker independently validates full structure.
    const payload=JSON.stringify({version:2,formatter:'source-organizer-v2'});
    assert.equal((await scalar(db,`select public.finish_job_quick_read('1','${token}','${payload}','test',2,null) as value`)).status,'ready');
    assert.equal((await claim()).status,'unchanged');
    assert.deepEqual((await scalar(db,"select public.public_job_detail_enrichment('1') as value")).quick_read,JSON.parse(payload));
    await db.query("update public.jobs set description=description || ' Changed source.' where id=1");
    assert.equal((await scalar(db,"select public.public_job_detail_enrichment('1') as value")).quick_read,null);
    await db.exec("update public.quick_read_control set next_claim_at='-infinity'");
    assert.equal((await claim()).status,'claimed');
    await db.query("update public.jobs set description=description || ' Another change.' where id=1");
    assert.equal((await scalar(db,`select public.finish_job_quick_read('1','${token}','${payload}','test',2,null) as value`)).status,'source_changed');
  } finally {await db.close();}
});
test('failed unchanged source has cooldown and candidates bounded; only eligible visible jobs',async()=>{
  const db=await database();
  try {
    await scalar(db,`select public.claim_job_quick_read('1','source-organizer-v2','${token}') as value`);
    await scalar(db,`select public.finish_job_quick_read('1','${token}',null,'test',2,'provider_invalid_json') as value`);
    assert.equal((await scalar(db,`select public.claim_job_quick_read('1','source-organizer-v2','${token}') as value`)).status,'retry_later');
    assert.equal((await db.query("select * from public.quick_read_candidates('0',1900,'source-organizer-v2')")).rows.length,0);
    await db.exec("update public.job_quick_reads set retry_after=now()-interval '1 second'");
    assert.deepEqual((await db.query("select * from public.quick_read_candidates('0',5,'source-organizer-v2')")).rows,[{id:'1'}]);
  } finally {await db.close();}
});
