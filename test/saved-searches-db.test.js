import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
test('database enforces ownership, Pro expiry, five slots, replacement, deletion and account cascade',async()=>{
 const db=new PGlite();try {
 await db.exec(`create role anon; create role authenticated; create schema auth; create schema veeays_admin;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
 create function veeays_admin.member_active() returns boolean language sql stable as $$select true$$;
 grant usage on schema auth,veeays_admin to authenticated;
 create table auth.users(id uuid primary key);
 create table public.profiles(id uuid primary key,plan text,plan_status text,pro_expires_at timestamptz);
 grant select on public.profiles to authenticated;
 insert into auth.users values ('${uid}'),('${other}');
 insert into public.profiles values ('${uid}','pro','active',now()+interval '1 day'),('${other}','free','active',null);`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261019140757_pro_saved_searches.sql',import.meta.url),'utf8'));
 await db.exec(`set role authenticated; select set_config('request.uid','${uid}',false);`);
 for(let i=1;i<=5;i++)await db.query('insert into saved_job_searches(user_id,slot,name) values ($1,$2,$3)',[uid,i,'Preset '+i]);
 await assert.rejects(db.query('insert into saved_job_searches(user_id,slot,name) values ($1,6,$2)',[uid,'Sixth']));
 await db.query("insert into saved_job_searches(user_id,slot,name) values ($1,1,'Changed') on conflict(user_id,slot) do update set name=excluded.name",[uid]);
 assert.equal((await db.query('select count(*)::int n from saved_job_searches')).rows[0].n,5);
 await assert.rejects(db.query('update saved_job_searches set user_id=$1 where slot=1',[other]));
 await db.exec(`select set_config('request.uid','${other}',false)`);
 assert.equal((await db.query('select * from saved_job_searches')).rows.length,0);
 await assert.rejects(db.query("insert into saved_job_searches(user_id,slot,name) values ($1,1,'Free')",[other]));
 await db.exec(`reset role; update profiles set pro_expires_at=now()-interval '1 day' where id='${uid}'; set role authenticated; select set_config('request.uid','${uid}',false)`);
 await assert.rejects(db.query("update saved_job_searches set name='Expired' where slot=1"));
 await db.exec('delete from saved_job_searches where slot=1');
 assert.equal((await db.query('select count(*)::int n from saved_job_searches')).rows[0].n,4);
 await db.exec('reset role; set role anon');await assert.rejects(db.query('select * from saved_job_searches'));
 await db.exec(`reset role; delete from auth.users where id='${uid}'`);
 assert.equal((await db.query('select * from saved_job_searches')).rows.length,0);
 }finally{await db.close();}
});
