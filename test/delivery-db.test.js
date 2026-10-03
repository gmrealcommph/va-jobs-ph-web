import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const uid='11111111-1111-4111-8111-111111111111';
const token='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
async function database() {
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
    create table public.profiles(id uuid primary key,plan text not null,plan_status text not null,pro_expires_at timestamptz);
    create table public.job_preferences(user_id uuid primary key,email_strong_matches boolean not null);
    create table public.jobs(id bigint primary key,status text,philippines_eligible boolean,duplicate_rank integer);
    create view public.public_jobs as select id from public.jobs where status='active' and philippines_eligible=true and duplicate_rank=1;
    create table public.job_match_notifications(id bigint primary key,user_id uuid not null,job_id bigint not null,match_score integer not null,notification_type text not null,notified_at timestamptz,discovered_at timestamptz not null default now()-interval '1 hour');
    insert into auth.users values('${uid}','alex@example.com',now(),null,null);
    insert into public.profiles values('${uid}','pro','active',null);
    insert into public.job_preferences values('${uid}',true);
    insert into public.jobs select generate_series(1,12),'active',true,1;
    insert into public.job_match_notifications(id,user_id,job_id,match_score,notification_type)
      select x,'${uid}',x,100,'strong_match' from generate_series(1,12) x;`);
  for(const name of ['001_manual_notification_delivery.sql','002_production_strong_matches.sql'])
    await db.exec(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));
  return db;
}
const claim=async(db,t=token)=> (await db.query(`select * from public.claim_strong_match_batch($1,now()-interval '1 day')`,[t])).rows[0];

test('confirmed live schema: discovered_at controls cutoff, collection age and oldest-five ordering without created_at',async()=>{
  const db=await database();try {
    const columns=(await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='job_match_notifications'")).rows.map(r=>r.column_name);
    assert.ok(columns.includes('discovered_at'));
    assert.ok(!columns.includes('created_at'));
    // Reverse ID/time ordering, exclude historical/recent matches and each public-view filter.
    await db.exec(`update public.job_match_notifications set discovered_at=now()-id*interval '1 hour';
      update public.job_match_notifications set discovered_at=now()-interval '2 days' where id=12;
      update public.job_match_notifications set discovered_at=now()-interval '14 minutes' where id=11;
      update public.jobs set status='closed' where id=10;
      update public.jobs set philippines_eligible=false where id=9;
      update public.jobs set duplicate_rank=2 where id=8;
      insert into public.job_match_notifications values(165,'${uid}',1,100,'strong_match',now(),now()-interval '1 hour');
      insert into public.manual_strong_match_deliveries(notification_id,payload,resend_id,accepted_at)
        values('165','{}','01a0ffb9-6f37-7945-8b53-bae78da5284b',now());`);
    assert.ok((await claim(db)).id);
    const ids=(await db.query('select notification_id from public.strong_match_batch_items order by notification_id::bigint')).rows.map(r=>r.notification_id);
    assert.deepEqual(ids,['3','4','5','6','7']);
    assert.ok((await db.query('select notified_at from public.job_match_notifications where id=165')).rows[0].notified_at);
  }finally{await db.close();}
});
test('real SQL migrations: five-item claim, lease fencing, frozen payload and atomic acceptance',async()=>{
  const db=await database();try {
    const b=await claim(db);assert.ok(b.id);
    assert.equal((await db.query('select * from public.strong_match_batch_items')).rows.length,5);
    assert.equal(await claim(db,other),undefined,'lease/cooldown must exclude overlapping invocation');
    const payload={from:'sender',to:['alex@example.com'],subject:'fixed'};
    await db.query('select public.freeze_strong_match_batch($1,$2,$3)',[b.id,token,payload]);
    const frozen=await db.query('select public.freeze_strong_match_batch($1,$2,$3) as p',[b.id,token,{subject:'changed'}]);
    assert.deepEqual(frozen.rows[0].p,payload);
    await assert.rejects(db.query('select public.start_strong_match_attempt($1,$2)',[b.id,other]),/attempt refused/);
    await db.query('select public.start_strong_match_attempt($1,$2)',[b.id,token]);
    assert.equal((await db.query('select count(*)::int as n from public.job_match_notifications where notified_at is not null')).rows[0].n,0);
    // Force notification-write failure: receipt must roll back too.
    await db.exec(`create function public.fail_ack() returns trigger language plpgsql as $$ begin raise exception 'forced ack failure'; end $$;
      create trigger ack_failure before update on public.job_match_notifications for each row execute function public.fail_ack();`);
    await assert.rejects(db.query('select public.accept_strong_match_batch($1,$2,$3)',[b.id,token,'receipt']),/forced ack failure/);
    assert.equal((await db.query('select resend_id from public.strong_match_batches')).rows[0].resend_id,null);
    await db.exec('drop trigger ack_failure on public.job_match_notifications');
    await db.query('select public.accept_strong_match_batch($1,$2,$3)',[b.id,token,'receipt']);
    await db.query('select public.accept_strong_match_batch($1,$2,$3)',[b.id,token,'receipt']);
    assert.equal((await db.query('select count(*)::int as n from public.job_match_notifications where notified_at is not null')).rows[0].n,5);
    assert.equal(await claim(db),undefined,'one grouped email per user per 24 hours');
    await db.exec(`update public.strong_match_batches set created_at=now()-interval '25 hours'`);
    assert.equal(await claim(db),undefined,'cooldown also starts at acceptance after a delayed retry');
    await db.exec(`update public.strong_match_batches set accepted_at=now()-interval '25 hours'`);
    assert.ok((await claim(db)).id,'remaining notifications are available after cooldown');
  }finally{await db.close();}
});
test('real SQL retries retain membership; expired unknown outcome is held and blocks further user sends',async()=>{
  const db=await database();try {
    const b=await claim(db);
    await db.query('select public.freeze_strong_match_batch($1,$2,$3)',[b.id,token,{to:['alex@example.com']}]);
    await db.query('select public.start_strong_match_attempt($1,$2)',[b.id,token]);
    await db.query("select public.defer_strong_match_batch($1,$2,'retry','unknown')",[b.id,token]);
    assert.equal(await claim(db),undefined,'backoff must defer retry');
    await db.exec("update public.strong_match_batches set next_attempt_at=now()-interval '1 minute'");
    assert.equal((await claim(db,other)).id,b.id);
    await db.exec("update public.strong_match_batches set first_attempt_at=now()-interval '24 hours',lease_until=now()-interval '1 minute'");
    assert.equal(await claim(db),undefined);
    assert.equal((await db.query('select status from public.strong_match_batches')).rows[0].status,'held');
    assert.equal((await db.query('select count(*)::int as n from public.strong_match_batch_items')).rows[0].n,5);
  }finally{await db.close();}
});
test('real SQL selection excludes manual ledger, digest, inactive job, opt-out and recent matches; private permissions',async()=>{
  const db=await database();try {
    await db.exec(`insert into public.manual_strong_match_deliveries(notification_id,payload) values('1','{}');
      update public.job_match_notifications set notification_type='daily_digest' where id=2;
      update public.jobs set status='closed' where id=3;
      update public.job_match_notifications set discovered_at=now() where id=4;`);
    const b=await claim(db);assert.ok(b);
    const ids=(await db.query('select notification_id from public.strong_match_batch_items')).rows.map(r=>r.notification_id);
    for(const id of ['1','2','3','4'])assert.ok(!ids.includes(id));
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from public.strong_match_batches'),/permission denied/);
    await assert.rejects(db.query('select * from public.claim_strong_match_batch($1,now())',[token]),/permission denied/);
    await db.exec('reset role');
  }finally{await db.close();}
  const db2=await database();try {
    await db2.exec('update public.job_preferences set email_strong_matches=false');
    assert.equal(await claim(db2),undefined);
  }finally{await db2.close();}
});
