import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
async function database(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create schema veeays_admin;grant usage on schema veeays_admin to authenticated;
 create function veeays_admin.has_access() returns boolean language sql as $$select current_setting('request.jwt.claim.sub',true)='${owner}'$$;
 create table auth.users(id uuid primary key,created_at timestamptz,email_confirmed_at timestamptz);
 create table profiles(id uuid primary key,plan text,plan_status text,pro_expires_at timestamptz);
 create table pro_payments(user_id uuid,livemode boolean,status text,amount integer,paid_at timestamptz);
 create table jobs(id integer,status text,posted_at timestamptz,job_url text,source text,source_job_id text);
 create table daily_digest_deliveries(status text,accepted_at timestamptz);
 create table strong_match_batches(status text,accepted_at timestamptz);
 -- Keep this cohort in today's Manila window even during the first hour after midnight.
 insert into auth.users values('${owner}',date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila',now()),('${other}',date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila',null);
 insert into profiles values('${owner}','pro','active',now()+interval '2 days'),('${other}','pro','active',null);
 insert into pro_payments values('${owner}',true,'confirmed',49900,now()),('${owner}',true,'confirmed',49900,now()),('${other}',true,'pending',49900,null);
 insert into jobs values(1,'active',now()-interval '31 days','https://example.test/job','lever','one'),(2,'active',null,'https://example.test/job','lever','one');
 insert into daily_digest_deliveries values('retry',null),('accepted',now());
 insert into strong_match_batches values('held',null);`);
 for(const name of ['admin-extended.sql','admin-alert-outbox.sql'])await db.exec(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));
 return db;
}
test('extended aggregates distinguish verification, access and unique purchased members; duplicate candidates and acceptance are honest',async()=>{
 const db=await database();try{
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';`);
 const {rows}=await db.query(`select public.veeays_admin_extended((now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date) data`);
 const d=rows[0].data;assert.equal(d.members.registered,2);assert.equal(d.members.verified,1);assert.equal(d.members.active_pro_with_purchase,1);assert.equal(d.members.active_pro_without_purchase_record,1);assert.equal(d.members.expiring_7d,1);assert.equal(d.members.cohort_purchased_now,1);
 assert.equal(d.job_quality.duplicate_url_groups,1);assert.equal(d.job_quality.duplicate_source_groups,1);assert.equal(d.job_quality.active_posted_over_30d,1);assert.equal(d.job_quality.active_missing_posted_at,1);assert.equal(d.email.accepted_in_period,1);assert.equal(d.email.acceptance_is_delivery,false);assert.equal(d.revenue.net_available,false);
 await assert.rejects(db.exec(`select public.veeays_admin_extended(current_date-100,current_date)`));
 }finally{await db.close();}
});
test('anonymous and regular members cannot retrieve metrics, write alerts or read outbox',async()=>{
 const db=await database();try{
 await db.exec(`set role anon`);await assert.rejects(db.exec(`select public.veeays_admin_extended(current_date,current_date)`));
 await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${other}'`);
 await assert.rejects(db.exec(`select public.veeays_admin_extended(current_date,current_date)`));
 await assert.rejects(db.exec(`select * from veeays_admin.alert_outbox`));
 await assert.rejects(db.exec(`select public.veeays_admin_claim_alert('x','{"key":"x","severity":"warning"}')`));
 }finally{await db.close();}
});
test('durable alert lease prevents duplicate claims, rejects stale acknowledgements and allows bounded retries',async()=>{
 const db=await database();try{
 await db.exec('set role service_role');
 const claim=async()=> (await db.query(`select public.veeays_admin_claim_alert('quota','{"key":"quota","severity":"critical"}') token`)).rows[0].token;
 const first=await claim();assert.ok(first);assert.equal(await claim(),null);
 assert.equal((await db.query(`select public.veeays_admin_ack_alert('quota','${owner}') ok`)).rows[0].ok,false);
 await db.exec(`reset role;update veeays_admin.alert_outbox set lease_until=now()-interval '1 second';set role service_role`);
 const next=await claim();assert.ok(next);assert.notEqual(next,first);
 assert.equal((await db.query(`select public.veeays_admin_ack_alert('quota','${first}') ok`)).rows[0].ok,false);
 assert.equal((await db.query(`select public.veeays_admin_ack_alert('quota','${next}') ok`)).rows[0].ok,true);
 assert.equal(await claim(),null);
 }finally{await db.close();}
});
