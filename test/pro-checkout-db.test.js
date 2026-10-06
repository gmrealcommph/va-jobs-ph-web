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
  await db.exec(await readFile(new URL('../migrations/005_pro_test_checkout.sql',import.meta.url),'utf8'));
  await db.query(`insert into public.pro_test_payments(id,user_id,checkout_id,amount,currency,status) values($1,$2,'cs_fixture',49900,'PHP','pending')`,[rid,uid]);
  return db;
}
async function accept(db, overrides={}) {
  const v={id:rid,checkout:'cs_fixture',payment:'pay_fixture',event:'evt_fixture',amount:49900,currency:'PHP',state:'paid',live:false,time:new Date().toISOString(),...overrides};
  return (await db.query('select public.accept_pro_test_payment($1,$2,$3,$4,$5,$6,$7,$8,$9) as outcome',Object.values(v))).rows[0].outcome;
}
test('actual migration: successful activation, renewal and duplicate event idempotency',async()=>{
  const db=await database();try{
    const time=new Date().toISOString();const first=await accept(db,{time});assert.equal(first.outcome,'granted');
    assert.equal(Date.parse(first.expires_at)-Date.parse(time),30*86400000);
    const repeated=await accept(db,{time,event:'evt_retry'});assert.equal(repeated.duplicate,true);assert.equal(repeated.expires_at,first.expires_at);
    await db.query(`insert into public.pro_test_payments(id,user_id,checkout_id,amount,currency,status) values($1,$2,'cs_second',49900,'PHP','pending')`,['33333333-3333-4333-8333-333333333333',uid]);
    const second=await accept(db,{id:'33333333-3333-4333-8333-333333333333',checkout:'cs_second',payment:'pay_second',time});
    assert.equal(second.outcome,'extended');assert.equal(Date.parse(second.expires_at)-Date.parse(first.expires_at),30*86400000);
  }finally{await db.close();}
});
test('expired, inactive and unlimited existing Pro entitlement outcomes',async()=>{
  const db=await database();try{
    for(const [status,expiry,outcome] of [['active',new Date(Date.now()-86400000).toISOString(),'granted'],['inactive',new Date(Date.now()+86400000).toISOString(),'granted'],['active',null,'unlimited_preserved']]) {
      await db.query(`update public.profiles set plan='pro',plan_status=$1,pro_expires_at=$2`,[status,expiry]);
      await db.exec(`update public.pro_test_payments set status='pending',payment_id=null,confirmed_at=null,entitlement_outcome=null;`);
      const result=await accept(db);assert.equal(result.outcome,outcome);if(expiry===null)assert.equal(result.expires_at,null);
    }
  }finally{await db.close();}
});
test('wrong amount/currency/state/mode/reference/time rejected without granting',async()=>{
  const db=await database();try{
    for(const override of [{amount:1},{currency:'USD'},{state:'pending'},{live:true},{live:null},{checkout:'cs_other'},{time:null},{time:'2000-01-01T00:00:00Z'}]) await assert.rejects(accept(db,override));
    assert.equal((await db.query('select plan from public.profiles')).rows[0].plan,'free');
    assert.equal((await db.query('select status from public.pro_test_payments')).rows[0].status,'pending');
  }finally{await db.close();}
});
test('atomic rollback when profile or payment ledger write fails; payment IDs cannot credit two purchases',async()=>{
  const db=await database();try{
    await db.exec(`create function fail_write() returns trigger language plpgsql as $$ begin raise exception 'forced failure'; end $$;
      create trigger fail_receipt before update on public.pro_test_payments for each row execute function fail_write();`);
    await assert.rejects(accept(db),/forced failure/);
    assert.equal((await db.query('select plan from public.profiles')).rows[0].plan,'free');
    await db.exec('drop trigger fail_receipt on public.pro_test_payments;');
    await accept(db);const before=(await db.query('select pro_expires_at from public.profiles')).rows[0].pro_expires_at;
    await db.query(`insert into public.pro_test_payments(id,user_id,checkout_id,amount,currency,status) values($1,$2,'cs_second',49900,'PHP','pending')`,['33333333-3333-4333-8333-333333333333',uid]);
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
    await assert.rejects(db.query('select * from public.pro_test_payments'),/permission denied/);
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
