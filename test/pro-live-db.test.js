import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const uid='11111111-1111-4111-8111-111111111111';
const rid='22222222-2222-4222-8222-222222222222';
async function database() {
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create table public.profiles(id uuid primary key,full_name text,plan text not null,plan_status text not null,pro_expires_at timestamptz);
    insert into public.profiles values('${uid}','Alex','free','inactive',null);`);
  await db.exec(await readFile(new URL('../migrations/006_pro_live_checkout.sql',import.meta.url),'utf8'));
  await db.query(`insert into public.pro_payments(id,user_id,checkout_id,amount,currency,status) values($1,$2,'cs_fixture',49900,'PHP','pending')`,[rid,uid]);
  return db;
}
async function accept(db, overrides={}) {
  const v={id:rid,checkout:'cs_fixture',payment:'pay_fixture',event:'evt_fixture',amount:49900,currency:'PHP',state:'paid',live:true,time:new Date().toISOString(),...overrides};
  return (await db.query('select public.accept_pro_payment($1,$2,$3,$4,$5,$6,$7,$8,$9) as outcome',Object.values(v))).rows[0].outcome;
}

// Minimal model of the production metadata observed in the read-only review.
async function productionDatabase() {
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,email text,full_name text,
      plan text not null default 'free' check(plan in ('free','pro')),plan_status text not null default 'active',
      pro_expires_at timestamptz,onboarding_completed boolean not null default false,
      created_at timestamptz not null default now(),updated_at timestamptz not null default now());
    alter table public.profiles enable row level security;
    create policy "Users can read own profile" on public.profiles for select to authenticated using ((select auth.uid())=id);
    grant all on public.profiles to anon,authenticated,service_role;
    create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$ begin
      insert into public.profiles(id,email,full_name) values(new.id,new.email,new.raw_user_meta_data->>'full_name') on conflict(id) do nothing;return new;end $$;
    create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
    create function public.set_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now();return new;end $$;
    create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
    create function public.update_my_profile(new_full_name text default null,new_onboarding_completed boolean default null) returns void
      language plpgsql security definer set search_path='' as $$ begin if auth.uid() is null then raise exception 'Not authenticated';end if;
      update public.profiles set full_name=coalesce(nullif(trim(new_full_name),''),full_name),
        onboarding_completed=coalesce(new_onboarding_completed,onboarding_completed),updated_at=now() where id=auth.uid();end $$;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`);
  await db.exec(await readFile(new URL('../migrations/006_pro_live_checkout.sql',import.meta.url),'utf8'));
  await db.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,'fixture@example.invalid','{"full_name":"Fixture"}')`,[uid]);
  await db.query(`insert into public.pro_payments(id,user_id,checkout_id,amount,currency,status) values($1,$2,'cs_fixture',49900,'PHP','pending')`,[rid,uid]);
  return db;
}
test('actual migration: successful activation, renewal and duplicate event idempotency',async()=>{
  const db=await database();try{
    const time=new Date().toISOString();const first=await accept(db,{time});assert.equal(first.outcome,'granted');
    assert.equal(Date.parse(first.expires_at)-Date.parse(time),30*86400000);
    const repeated=await accept(db,{time,event:'evt_retry'});assert.equal(repeated.duplicate,true);assert.equal(repeated.expires_at,first.expires_at);
    await db.query(`insert into public.pro_payments(id,user_id,checkout_id,amount,currency,status) values($1,$2,'cs_second',49900,'PHP','pending')`,['33333333-3333-4333-8333-333333333333',uid]);
    const second=await accept(db,{id:'33333333-3333-4333-8333-333333333333',checkout:'cs_second',payment:'pay_second',time});
    assert.equal(second.outcome,'extended');assert.equal(Date.parse(second.expires_at)-Date.parse(first.expires_at),30*86400000);
  }finally{await db.close();}
});
test('expired, inactive and unlimited existing Pro entitlement outcomes',async()=>{
  const db=await database();try{
    for(const [status,expiry,outcome] of [['active',new Date(Date.now()-86400000).toISOString(),'granted'],['inactive',new Date(Date.now()+86400000).toISOString(),'granted'],['active',null,'unlimited_preserved']]) {
      await db.query(`update public.profiles set plan='pro',plan_status=$1,pro_expires_at=$2`,[status,expiry]);
      await db.exec(`update public.pro_payments set status='pending',payment_id=null,confirmed_at=null,entitlement_outcome=null;`);
      const result=await accept(db);assert.equal(result.outcome,outcome);if(expiry===null)assert.equal(result.expires_at,null);
    }
  }finally{await db.close();}
});
test('wrong amount/currency/state/mode/reference/time rejected without granting',async()=>{
  const db=await database();try{
    for(const override of [{amount:1},{currency:'USD'},{state:'pending'},{live:false},{live:null},{checkout:'cs_other'},{time:null},{time:'2000-01-01T00:00:00Z'}]) await assert.rejects(accept(db,override));
    assert.equal((await db.query('select plan from public.profiles')).rows[0].plan,'free');
    assert.equal((await db.query('select status from public.pro_payments')).rows[0].status,'pending');
  }finally{await db.close();}
});
test('atomic rollback when profile or payment ledger write fails; payment IDs cannot credit two purchases',async()=>{
  const db=await database();try{
    await db.exec(`create function fail_write() returns trigger language plpgsql as $$ begin raise exception 'forced failure'; end $$;
      create trigger fail_receipt before update on public.pro_payments for each row execute function fail_write();`);
    await assert.rejects(accept(db),/forced failure/);
    assert.equal((await db.query('select plan from public.profiles')).rows[0].plan,'free');
    await db.exec('drop trigger fail_receipt on public.pro_payments;');
    await accept(db);const before=(await db.query('select pro_expires_at from public.profiles')).rows[0].pro_expires_at;
    await db.query(`insert into public.pro_payments(id,user_id,checkout_id,amount,currency,status) values($1,$2,'cs_second',49900,'PHP','pending')`,['33333333-3333-4333-8333-333333333333',uid]);
    await assert.rejects(accept(db,{id:'33333333-3333-4333-8333-333333333333',checkout:'cs_second'}),/unique/);
    assert.deepEqual((await db.query('select pro_expires_at from public.profiles')).rows[0].pro_expires_at,before);
  }finally{await db.close();}
});
test('RLS/service boundary and profile trigger deny browser writes even through security-definer RPC',async()=>{
  const db=await database();try{
    await db.exec(`grant select,update on public.profiles to authenticated;
      create function public.bad_old_rpc() returns void language sql security definer as $$ update public.profiles set plan='pro' $$;
      grant execute on function public.bad_old_rpc() to authenticated;
      set role authenticated;`);
    await assert.rejects(db.query('select * from public.pro_payments'),/permission denied/);
    await assert.rejects(accept(db),/permission denied/);
    await assert.rejects(db.query(`update public.profiles set plan='pro'`),/Browser cannot/);
    await assert.rejects(db.query('select public.bad_old_rpc()'),/Browser cannot/);
    await db.query(`update public.profiles set full_name='Changed'`);
    await db.exec('reset role;');
    assert.equal((await db.query('select plan,full_name from public.profiles')).rows[0].plan,'free');
  }finally{await db.close();}
});
test('overlapping duplicate deliveries have one entitlement outcome',async()=>{
  const db=await database();try{
    const time=new Date().toISOString();
    const results=await Promise.all([accept(db,{time}),accept(db,{time,event:'evt_retry'})]);
    assert.equal(results.filter(r=>r.duplicate===false).length,1);
    assert.equal(results.filter(r=>r.duplicate===true).length,1);
    assert.equal(Date.parse(results[0].expires_at)-Date.parse(time),30*86400000);
  }finally{await db.close();}
});

test('production defaults: service ledger permissions are narrowed without changing existing profile grants',async()=>{
  const db=await productionDatabase();try{
    for(const privilege of ['SELECT','INSERT','UPDATE']) assert.equal((await db.query(`select has_table_privilege('service_role','public.pro_payments',$1) as allowed`,[privilege])).rows[0].allowed,true);
    for(const privilege of ['DELETE','TRUNCATE','REFERENCES','TRIGGER']) assert.equal((await db.query(`select has_table_privilege('service_role','public.pro_payments',$1) as allowed`,[privilege])).rows[0].allowed,false);
    assert.equal((await db.query(`select has_table_privilege('service_role','public.profiles','DELETE') as allowed`)).rows[0].allowed,true);
    for(const role of ['anon','authenticated']) {
      assert.equal((await db.query(`select has_table_privilege($1,'public.pro_payments','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as allowed`,[role])).rows[0].allowed,false);
      assert.equal((await db.query(`select has_function_privilege($1,'public.accept_pro_payment(uuid,text,text,text,integer,text,text,boolean,timestamptz)','EXECUTE') as allowed`,[role])).rows[0].allowed,false);
    }
    await db.exec('set role service_role;');
    assert.equal((await db.query('select count(*)::int as n from public.pro_payments')).rows[0].n,1);
    await assert.rejects(db.exec('delete from public.pro_payments'),/permission denied/);
    await assert.rejects(db.exec('truncate public.pro_payments'),/permission denied/);
    assert.equal((await accept(db)).outcome,'granted');
    await db.exec('reset role;');
  }finally{await db.close();}
});

test('production signup and existing authenticated onboarding RPC survive the guard',async()=>{
  const db=await productionDatabase();try{
    assert.deepEqual((await db.query('select plan,plan_status,pro_expires_at from public.profiles')).rows[0],{plan:'free',plan_status:'active',pro_expires_at:null});
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[uid]);
    await db.exec(`set request.jwt.claim.role='authenticated';set role authenticated;select public.update_my_profile('Updated fixture',true);reset role;reset request.jwt.claim.role;`);
    assert.deepEqual((await db.query('select full_name,onboarding_completed,plan from public.profiles')).rows[0],{full_name:'Updated fixture',onboarding_completed:true,plan:'free'});
  }finally{await db.close();}
});

test('account deletion preserves receipts in every checkout state and never affects other members',async()=>{
  for(const state of ['creating','pending','creation_failed','confirmed']) {
    const db=await productionDatabase();try{
      if(state==='confirmed') await accept(db); else await db.query('update public.pro_payments set status=$1',[state]);
      const before=(await db.query('select * from public.pro_payments')).rows[0];
      await db.query(`insert into auth.users(id,email,raw_user_meta_data) values('33333333-3333-4333-8333-333333333333','other@example.invalid','{}')`);
      await db.query('delete from auth.users where id=$1',[uid]);
      const after=(await db.query('select * from public.pro_payments')).rows[0];
      assert.deepEqual(after,{...before,user_id:null});
      assert.equal((await db.query('select count(*)::int as n from public.profiles where id=$1',[uid])).rows[0].n,0);
      assert.equal((await db.query(`select plan from public.profiles where id='33333333-3333-4333-8333-333333333333'`)).rows[0].plan,'free');
    }finally{await db.close();}
  }
});

test('verified payment after deletion is recorded once without granting or reattaching to a recreated account',async()=>{
  const db=await productionDatabase();try{
    await db.query('delete from auth.users where id=$1',[uid]);
    await db.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,'recreated@example.invalid','{}')`,[uid]);
    await assert.rejects(accept(db,{checkout:'cs_other'}),/ownership mismatch/);
    await assert.rejects(accept(db,{amount:1}),/Invalid live payment/);
    const first=await accept(db);assert.deepEqual(first,{duplicate:false,expires_at:null,outcome:'account_deleted'});
    const repeated=await accept(db,{event:'evt_retry'});assert.deepEqual(repeated,{duplicate:true,expires_at:null,outcome:'account_deleted'});
    await assert.rejects(accept(db,{payment:'pay_other'}),/already credited/);
    const receipt=(await db.query('select user_id,status,payment_id,entitlement_outcome,entitlement_expires_at from public.pro_payments')).rows[0];
    assert.deepEqual(receipt,{user_id:null,status:'confirmed',payment_id:'pay_fixture',entitlement_outcome:'account_deleted',entitlement_expires_at:null});
    assert.equal((await db.query('select plan from public.profiles where id=$1',[uid])).rows[0].plan,'free');
  }finally{await db.close();}
});

test('confirmation before deletion retains original audit outcome on replay after deletion',async()=>{
  const db=await productionDatabase();try{
    const first=await accept(db);await db.query('delete from auth.users where id=$1',[uid]);
    const repeated=await accept(db,{event:'evt_retry'});assert.deepEqual(repeated,{...first,duplicate:true});
    const receipt=(await db.query('select user_id,entitlement_outcome,entitlement_expires_at = $1::timestamptz as expiry_unchanged from public.pro_payments',[first.expires_at])).rows[0];
    assert.equal(receipt.user_id,null);assert.equal(receipt.entitlement_outcome,'granted');assert.equal(receipt.expiry_unchanged,true);
  }finally{await db.close();}
});
