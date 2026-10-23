import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
test('reminder RLS enforces ownership, active Pro, existing applications, suspension and deletion cascade',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema veeays_admin;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
  create function veeays_admin.member_active() returns boolean language sql stable as $$select coalesce(current_setting('request.active',true),'true')!='false'$$;
  grant usage on schema auth,veeays_admin to authenticated;
  create table auth.users(id uuid primary key);create table profiles(id uuid primary key,plan text,plan_status text,pro_expires_at timestamptz);
  create table job_applications(user_id uuid references auth.users(id) on delete cascade,job_id bigint,primary key(user_id,job_id));
  grant select on profiles to authenticated;
  insert into auth.users values('${uid}'),('${other}');insert into profiles values('${uid}','pro','active',now()+interval '1 day'),('${other}','free','active',null);
  insert into job_applications values('${uid}',1),('${other}',2);`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261023091543_pro_application_reminders.sql',import.meta.url),'utf8'));
  await db.exec(`set role authenticated;select set_config('request.uid','${uid}',false)`);
  await db.query('insert into job_application_reminders values($1,1,$2,$3)',[uid,'2099-01-01','Follow up']);
  await assert.rejects(db.query('insert into job_application_reminders values($1,2,$2,$3)',[uid,'2099-01-01','No application']));
  await assert.rejects(db.query('update job_application_reminders set user_id=$1',[other]));
  await db.exec(`select set_config('request.uid','${other}',false)`);assert.equal((await db.query('select * from job_application_reminders')).rows.length,0);
  await assert.rejects(db.query('insert into job_application_reminders values($1,2,$2,$3)',[other,'2099-01-01','Free account']));
  await db.exec(`reset role;update profiles set pro_expires_at=now()-interval '1 day' where id='${uid}';set role authenticated;select set_config('request.uid','${uid}',false)`);
  assert.equal((await db.query('select * from job_application_reminders')).rows.length,1);await assert.rejects(db.query("update job_application_reminders set label='Expired'"));
  await db.exec(`select set_config('request.active','false',false)`);assert.equal((await db.query('select * from job_application_reminders')).rows.length,0);
  await db.exec(`select set_config('request.active','true',false);delete from job_application_reminders`);assert.equal((await db.query('select * from job_application_reminders')).rows.length,0);
  await db.exec(`reset role;update profiles set pro_expires_at=now()+interval '1 day' where id='${uid}';set role authenticated;select set_config('request.uid','${uid}',false)`);
  await db.query('insert into job_application_reminders values($1,1,$2,$3)',[uid,'2099-01-01','Delete cascade']);
  await db.exec(`reset role;delete from auth.users where id='${uid}'`);assert.equal((await db.query('select * from job_application_reminders')).rows.length,0);
  await db.exec('set role anon');await assert.rejects(db.query('select * from job_application_reminders'));
 }finally{await db.close();}
});
