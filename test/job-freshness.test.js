import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {freshnessNotice} from '../src/job-freshness.js';
import {card,detail} from '../src/render.js';

test('freshness warning covers whole days 31 through 45 on listings and detail',()=>{
 const now=Date.now();
 for(const days of [30,31,45,46]){
  const job={id:1,title:'Support',company:'Example',posted_at:new Date(now-days*86400000).toISOString()};
  assert.equal(Boolean(freshnessNotice(job,now)),days===31||days===45);
  if(days===31){assert.match(card(job),/Confirm availability/);assert.match(detail(job),/Confirm availability/);}
 }
 for(const posted_at of [null,'invalid',new Date(now+86400000).toISOString()])assert.equal(freshnessNotice({posted_at},now),'');
});

test('public freshness preserves undated, evergreen and matching open evidence without changing records',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema veeays_job_health;
 create table jobs(id bigint primary key,title text,company text,description text,category text,location text,remote boolean,workplace_type text,source text,source_job_id text,job_url text,posted_at timestamptz,collected_at timestamptz,company_logo_url text,original_posted_at timestamptz,status text default 'active',philippines_eligible boolean default true);
 create table veeays_job_health.reviews(job_id bigint,state text,expires_at timestamptz);
 create table veeays_job_health.observations(job_id bigint,source text,source_job_id text,job_url text,status text,checked_at timestamptz,original_posted_at timestamptz,date_provenance text);
 insert into jobs(id,title,company,source,source_job_id,job_url,posted_at)
 select i,'Role '||i,'Company','lever',i::text,'https://jobs.lever.co/test/'||i,now()-interval '60 days' from generate_series(1,13)i;
 update jobs set posted_at=null where id=1;
 update jobs set posted_at=now()-interval '45 days 23 hours' where id=2;
 update jobs set posted_at=now()-interval '46 days' where id=3;
 insert into veeays_job_health.reviews values(4,'evergreen',now()+interval '1 day'),(5,'evergreen',now()-interval '1 day');
 insert into veeays_job_health.observations select id,source,source_job_id,job_url,'open',now()-interval '7 days',null,'unknown' from jobs where id in (6,7,8,9);
 insert into veeays_job_health.observations select id,source,source_job_id,job_url,'unknown',now()-interval '1 day',null,'unknown' from jobs where id=6;
 insert into veeays_job_health.observations select id,source,source_job_id,job_url,'closed',now()-interval '1 day',null,'unknown' from jobs where id=7;
 update jobs set job_url='https://jobs.lever.co/test/changed' where id=8;
 update jobs set source_job_id='changed' where id=9;
 update jobs set posted_at=now()-interval '1 day',original_posted_at=now()-interval '60 days' where id=10;
 update jobs set posted_at=now()-interval '60 days',original_posted_at=now()-interval '1 day' where id=11;
 update jobs set posted_at=now()-interval '1 day' where id in (12,13);
 update jobs set philippines_eligible=false where id=12;
 update jobs set status='inactive' where id=13;
 create view public_jobs as select id,title,company,description,category,location,remote,workplace_type,source,job_url,posted_at,collected_at,company_logo_url from jobs where status='active' and philippines_eligible;
 grant select on public_jobs to anon,authenticated;`);
 const migration=(await import('node:fs/promises')).readdir;
 const file=(await migration(new URL('../supabase/migrations/',import.meta.url))).find(n=>n.endsWith('_job_freshness.sql'));
 await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.exec('set role anon');
 assert.deepEqual((await db.query('select id from public_jobs order by id')).rows.map(r=>r.id),[1,2,4,6,11]);
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from jobs')).rows[0].n,13);
 assert.equal((await db.query('select count(*)::int n from veeays_job_health.observations')).rows[0].n,6);
 await db.exec(`update jobs set title='Reimported',status='active' where id=3`);
 assert.equal((await db.query('select count(*)::int n from public_jobs where id=3')).rows[0].n,0);
 }finally{await db.close();}
});
