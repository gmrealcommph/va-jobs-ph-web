import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('attribution deduplicates sessions, registrations and Pro buyers; access and dates enforced',async()=>{
 const db=new PGlite();
 const admin='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222',user='33333333-3333-4333-8333-333333333333';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema veeays_admin;
 create function veeays_admin.has_access() returns boolean language sql as $$select current_setting('request.jwt.claim.sub',true)='${admin}'$$;
 create table auth.users(id uuid primary key,created_at timestamptz);
 create table public.pro_payments(user_id uuid,livemode boolean,status text,paid_at timestamptz,payment_id text default 'pay_live',confirmed_at timestamptz default now(),amount integer default 49900);
 insert into auth.users values('${user}',now());`);
 await db.exec(await readFile(new URL('../migrations/admin-traffic.sql',import.meta.url),'utf8'));
 const record=`select public.veeays_traffic_record('${session}','/','facebook','paid_social','october','Paid campaigns')`;
 await db.exec(`set role service_role;${record};${record};reset role;update veeays_admin.traffic_sessions set created_at=now()-interval '1 minute';set role service_role;select public.veeays_traffic_register('${session}','${user}');select public.veeays_traffic_register('${session}','${user}');reset role;`);
 await db.exec(`insert into pro_payments(user_id,livemode,status,paid_at) values('${user}',true,'confirmed',now()),('${user}',true,'confirmed',now()),('${user}',false,'confirmed',now());set role authenticated;set request.jwt.claim.sub='${admin}'`);
 const query=`select public.veeays_admin_traffic((now() at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date) data`;
 const d=(await db.query(query)).rows[0].data;assert.equal(d.sessions,1);assert.equal(d.registrations,1);assert.equal(d.sources[0].pro_conversions,1);
 await assert.rejects(db.exec(`select * from veeays_admin.traffic_sessions`));
 await assert.rejects(db.exec(record));
 await db.exec(`set request.jwt.claim.sub='${user}'`);await assert.rejects(db.exec(query));
 await db.exec(`reset role;set role anon`);await assert.rejects(db.exec(query));await assert.rejects(db.exec(record));
 await db.exec(`reset role;set role service_role;select public.veeays_traffic_forget('${session}');reset role;`);
 assert.equal((await db.query('select count(*) n from veeays_admin.traffic_sessions')).rows[0].n,0);
 }finally{await db.close();}
});
