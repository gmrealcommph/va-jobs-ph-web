import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const uid='11111111-1111-4111-8111-111111111111',token='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function setup(){
 const d=new PGlite();await d.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema veeays_private;create schema veeays_job_health;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
 create table public.profiles(id uuid primary key,plan text,plan_status text,pro_expires_at timestamptz);
 create table public.job_preferences(user_id uuid,daily_digest boolean,email_strong_matches boolean);
 create table veeays_private.deletion_requests(user_id uuid);
 create table veeays_job_health.observations(job_id bigint,source text,source_job_id text,job_url text,status text,checked_at timestamptz);
 create table public.jobs(id bigint primary key,title text,company text,category text,employment_type text,location text,salary_min_usd integer,salary_max_usd integer,salary_period text,first_imported_at timestamptz,created_at timestamptz,original_posted_at timestamptz,posted_at timestamptz,status text,philippines_eligible boolean,source text,source_job_id text,job_url text);
 create view public.public_jobs as select * from public.jobs where status='active' and philippines_eligible;
 insert into auth.users values('${uid}','member@example.com',now(),null,null);
 insert into public.profiles values('${uid}','free','active',null);
 insert into public.job_preferences values('${uid}',true,true);
 select set_config('test.uid','${uid}',false);`);
 await d.exec(await readFile(new URL('../docs/job-alerts-install.sql',import.meta.url),'utf8'));
 await d.exec(`select public.save_my_job_alerts(true,'weekly','{}','{}',null,null,true);
 update veeays_alerts.settings set consent_at=now()-interval '7 days';
 insert into public.jobs(id,title,company,category,employment_type,first_imported_at,created_at,posted_at,status,philippines_eligible,source,source_job_id,job_url)
 select n,'Job '||n,'Employer '||n,'Marketing','full_time',date_trunc('day',now())-interval '2 hours',now()-interval '2 hours',now()-interval '2 hours','active',true,'lever',n::text,'https://example.com/'||n from generate_series(1,12)n;
 update veeays_alerts.settings set frequency='daily';update public.profiles set plan='pro';update veeays_alerts.control set enabled=true;`);return d;
}
async function claim(d){return (await d.query(`select public.claim_job_alert('${token}') r`)).rows[0].r;}
const call=async(d,n,args=[]) => (await d.query(`select public.${n}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args)).rows[0].r;
test('SQL matcher excludes hidden, ineligible, old employer date, closed source and repeats; salary period is exact',async()=>{
 const d=await setup();try{
 await d.exec(`update public.jobs set status='hidden' where id=1;update public.jobs set philippines_eligible=false where id=2;update public.jobs set posted_at=now()-interval '50 days' where id=3;
 insert into veeays_job_health.observations values(4,'lever','4','https://example.com/4','closed',now());
 update public.jobs set salary_min_usd=1500,salary_period='monthly' where id=5;
 update public.jobs set salary_min_usd=2000,salary_period='yearly' where id=6;
 update veeays_alerts.settings set minimum_usd=1000,salary_period='monthly',include_unknown_salary=false;`);
 const rows=(await d.query(`select veeays_alerts.matches('${uid}',date_trunc('day',now())) r`)).rows[0].r;assert.deepEqual(rows.map(x=>x.job_id),['5']);
 await d.exec(`insert into veeays_alerts.notified(user_id,job_key) values('${uid}','employer 5|job 5')`);
 assert.deepEqual((await d.query(`select veeays_alerts.matches('${uid}',date_trunc('day',now())) r`)).rows[0].r,[]);
 }finally{await d.close();}
});
test('lease, immutable retry payload, retry horizon, accepted ledger and repeated claim',async()=>{
 const d=await setup();try{
 const x=await claim(d);assert.equal(x.items.length,10);assert.equal(await claim(d),null);
 assert.equal((await call(d,'check_job_alert',[x.id,token])).email,'member@example.com');
 const payload={to:['member@example.com'],subject:'fixed'};
 assert.deepEqual(await call(d,'freeze_job_alert',[x.id,token,payload]),payload);
 assert.deepEqual(await call(d,'freeze_job_alert',[x.id,token,{subject:'changed'}]),payload);
 assert.equal(await call(d,'start_job_alert',[x.id,token]),true);
 assert.equal(await call(d,'finish_job_alert',[x.id,token,'provider',null,false]),true);
 assert.equal(await call(d,'finish_job_alert',[x.id,token,'provider',null,false]),false);
 assert.equal((await d.query('select count(*)::int n from veeays_alerts.notified')).rows[0].n,10);
 assert.equal(await claim(d),null);
 }finally{await d.close();}
});
test('consent, downgrade, deletion preparation, quota and unsubscribe send barrier',async()=>{
 const d=await setup();try{
 const x=await claim(d);
 await d.exec(`update public.profiles set plan='free'`);assert.equal((await call(d,'check_job_alert',[x.id,token])).error,'entitlement_changed');
 await assert.rejects(call(d,'save_my_job_alerts',[true,'daily',[],[],null,null,true]),/Invalid preferences/);
 await d.exec(`update public.profiles set plan='pro';insert into veeays_private.deletion_requests values('${uid}')`);
 assert.equal((await call(d,'check_job_alert',[x.id,token])).error,'recipient_ineligible');await d.exec('delete from veeays_private.deletion_requests');
 await call(d,'freeze_job_alert',[x.id,token,{to:['member@example.com']}]);
 await d.exec(`update veeays_alerts.control set daily_cap=1;insert into veeays_alerts.events(code) values('provider_attempt')`);
 assert.equal(await call(d,'start_job_alert',[x.id,token]),false);await d.exec(`delete from veeays_alerts.events where code='provider_attempt'`);
 assert.equal(await call(d,'start_job_alert',[x.id,token]),true);
 const unsub=(await d.query('select token from veeays_alerts.settings')).rows[0].token;
 assert.equal(await call(d,'unsubscribe_job_alert',[unsub]),false);
 await assert.rejects(d.exec(`delete from auth.users where id='${uid}'`),/delivery in progress/);
 await call(d,'finish_job_alert',[x.id,token,null,'transient_or_unknown_outcome',true]);
 assert.equal(await call(d,'unsubscribe_job_alert',[unsub]),true);
 assert.equal((await call(d,'check_job_alert',[x.id,token])).error,'recipient_ineligible');
 await d.exec(`delete from auth.users where id='${uid}'`);assert.equal((await d.query('select count(*)::int n from veeays_alerts.settings')).rows[0].n,0);
 }finally{await d.close();}
});
test('private tables and sender RPCs deny members and anonymous users',async()=>{
 const d=await setup();try{
 for(const role of ['anon','authenticated']){await d.exec('set role '+role);await assert.rejects(d.query('select * from veeays_alerts.settings'),/permission denied/);await assert.rejects(d.query(`select public.claim_job_alert('${token}')`),/permission denied/);await d.exec('reset role');}
 }finally{await d.close();}
});

test('uncertain sends stay reserved after retry horizon, suppression races and deletion cascade are safe',async()=>{
 const d=await setup();try{
 const x=await claim(d);await call(d,'freeze_job_alert',[x.id,token,{to:['member@example.com']}]);assert.equal(await call(d,'start_job_alert',[x.id,token]),true);
 // Provider event can arrive before the send receipt is committed.
 assert.equal(await call(d,'suppress_job_alert',['provider_early']),false);
 await call(d,'finish_job_alert',[x.id,token,'provider_early',null,false]);
 assert.equal((await d.query('select suppressed from veeays_alerts.settings')).rows[0].suppressed,true);
 assert.equal((await d.query("select count(*)::int n from veeays_alerts.notified where outcome='accepted'")).rows[0].n,10);
 await d.exec(`update veeays_alerts.settings set suppressed=false,enabled=true;update veeays_alerts.deliveries set state='retry',first_attempt_at=now()-interval '24 hours',lease_until=null;update veeays_alerts.control set next_send_at=null`);
 await claim(d);assert.equal((await d.query('select state from veeays_alerts.deliveries')).rows[0].state,'held');
 const remaining=(await d.query(`select veeays_alerts.matches('${uid}',date_trunc('day',now())) r`)).rows[0].r;assert.equal(remaining.length,2);
 await d.exec(`delete from auth.users where id='${uid}'`);
 for(const t of ['settings','deliveries','events','notified'])assert.equal((await d.query('select count(*)::int n from veeays_alerts.'+t)).rows[0].n,0);
 }finally{await d.close();}
});
