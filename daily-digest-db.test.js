import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const uid='11111111-1111-4111-8111-111111111111';
const token='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
// The project deliberately contains no copy of Matching V2. Supply the exact production SQL
// separately for these optional local integration tests; it is never deployed by this project.
const integration={skip:!process.env.MATCHING_V2_SQL};
async function database() {
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create function auth.uid() returns uuid language sql as $$select '${uid}'::uuid$$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
    create table public.profiles(id uuid primary key,plan text,plan_status text,pro_expires_at timestamptz,full_name text);
    create table public.job_preferences(user_id uuid primary key,email_strong_matches boolean,daily_digest boolean,
      target_roles text[],minimum_salary_usd integer,employment_types text[],schedule_preferences text[],experience_level text,skills text[]);
    create table public.jobs(id bigint primary key,title text,company text,description text,category text,employment_type text,
      engagement_type text,salary_min_usd integer,salary_max_usd integer,salary_period text,location text,remote boolean,
      philippines_eligible boolean,source text,job_url text,posted_at timestamptz,collected_at timestamptz,status text,
      workplace_type text,company_logo_url text,schedule_region text,experience_level text,skills text[] default '{}',
      created_at timestamptz,updated_at timestamptz);
    create view public.public_jobs as with ranked_jobs as (
      select jobs.*,row_number() over(partition by lower(trim(company)),lower(trim(title)) order by
        case when source=any(array['workable','lever','greenhouse','ashby']) then 1 when source='himalayas' then 2 else 3 end,
        posted_at desc nulls last,collected_at desc nulls last,id desc) as duplicate_rank
      from public.jobs where status='active' and philippines_eligible=true)
      select id,title,company,description,category,location,remote,workplace_type,source,job_url,posted_at,collected_at,company_logo_url
      from ranked_jobs where duplicate_rank=1;
    insert into auth.users values('${uid}','alex@example.com',now(),null,null);
    insert into public.profiles values('${uid}','pro','active',null,'Alex');
    insert into public.job_preferences values('${uid}',false,true,array['General VA'],null,'{}','{}',null,'{}');
    insert into public.jobs(id,title,company,status,philippines_eligible,source,job_url,created_at,posted_at,collected_at)
      select n,'Virtual Assistant '||n,'Company '||n,'active',true,'workable','https://example.com/'||n,
        date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'-interval '1 hour',
        date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'-n*interval '1 minute',now()
      from generate_series(1,12) n;`);
  // Verbatim supplied production SQL, only executed in this isolated local database.
  await db.exec(await readFile(process.env.MATCHING_V2_SQL,'utf8'));
  await db.exec(await readFile(new URL('../migrations/003_daily_digest.sql',import.meta.url),'utf8'));
  return db;
}
const end=`date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'`;
const claim=async(db,t=token)=>(await db.query(`select * from public.claim_daily_digest($1,${end},${end})`,[t])).rows[0];
const check=async(db,d,t=token)=>(await db.query('select public.check_daily_digest($1,$2) as result',[d.id,t])).rows[0].result;

test('actual frozen Matching V2: digest intersects fresh public jobs and preserves engine ordering; no notification rows required',integration,async()=>{
  const db=await database();try {
    const before=(await db.query("select pg_get_functiondef('public._get_job_matches_for_user(uuid,integer)'::regprocedure) as f")).rows[0].f;
    await db.exec(`update public.jobs set created_at=${end}-interval '2 days',updated_at=now() where id=1;
      update public.jobs set created_at=${end} where id=2;
      update public.jobs set status='closed' where id=3;
      update public.jobs set philippines_eligible=false where id=4;
      update public.jobs set title='Virtual Assistant 6',company='Company 6',source='himalayas' where id=5;`);
    const expected=(await db.query(`select m.job_id::text as id from public._get_job_matches_for_user('${uid}',100) with ordinality m
      join public.jobs j on j.id=m.job_id join public.public_jobs v on v.id=m.job_id
      where coalesce(j.created_at,j.collected_at,j.posted_at)>=${end}-interval '24 hours'
        and coalesce(j.created_at,j.collected_at,j.posted_at)<${end}
      order by m.ordinality limit 10`)).rows.map(x=>x.id);
    const d=await claim(db),result=await check(db,d);
    assert.deepEqual(result.items.map(x=>x.job_id),expected);assert.deepEqual(expected,['6','7','8','9','10','11','12']);
    assert.equal(result.items[0].match_score,100);assert.equal(result.email,'alex@example.com');
    assert.equal((await db.query('select email_strong_matches from public.job_preferences')).rows[0].email_strong_matches,false);
    const after=(await db.query("select pg_get_functiondef('public._get_job_matches_for_user(uuid,integer)'::regprocedure) as f")).rows[0].f;
    assert.equal(before,after);
    assert.equal((await db.query("select to_regclass('public.job_match_notifications') as n")).rows[0].n,null);
  }finally{await db.close();}
});
test('ten maximum, unique per-user/day, leases, stale-token fencing, frozen payload and accepted finality',integration,async()=>{
  const db=await database();try {
    const d=await claim(db);assert.ok(d.id);assert.equal(await claim(db,other),undefined);
    const result=await check(db,d);assert.equal(result.items.length,10);
    assert.deepEqual(result.items.map(x=>x.job_id),Array.from({length:10},(_,i)=>String(i+1)));
    await assert.rejects(check(db,d,other),/lease lost/);
    const payload={to:['alex@example.com'],subject:'fixed',text:'fixed'};
    await db.query('select public.freeze_daily_digest($1,$2,$3)',[d.id,token,payload]);
    const frozen=(await db.query('select public.freeze_daily_digest($1,$2,$3) as p',[d.id,token,{subject:'changed'}])).rows[0].p;
    assert.deepEqual(frozen,payload);
    await assert.rejects(db.query('select public.start_daily_digest_attempt($1,$2)',[d.id,other]),/lease lost/);
    await db.query('select public.start_daily_digest_attempt($1,$2)',[d.id,token]);
    await assert.rejects(db.query('select public.accept_daily_digest($1,$2,$3)',[d.id,other,'receipt']),/receipt refused/);
    assert.equal((await db.query('select public.accept_daily_digest($1,$2,$3) as ok',[d.id,token,'receipt'])).rows[0].ok,true);
    assert.equal((await db.query('select public.accept_daily_digest($1,$2,$3) as ok',[d.id,other,'receipt'])).rows[0].ok,true);
    assert.equal(await claim(db),undefined);assert.equal((await db.query('select count(*)::int as n from public.daily_digest_deliveries')).rows[0].n,1);
    await assert.rejects(db.query(`insert into public.daily_digest_deliveries(user_id,digest_day,window_end)
      values('${uid}',(${end} at time zone 'Asia/Manila')::date,${end})`),/unique/);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from public.daily_digest_deliveries'),/permission denied/);
    await assert.rejects(db.query(`select public.daily_digest_matches('${uid}',${end})`),/permission denied/);
  }finally{await db.close();}
});
test('send-time eligibility, changed jobs and email prevent attempts; uncertain attempts expire safely',integration,async()=>{
  const db=await database();try {
    const d=await claim(db);await check(db,d);
    await db.query('select public.freeze_daily_digest($1,$2,$3)',[d.id,token,{to:['alex@example.com'],subject:'fixed'}]);
    for(const mutation of ["update public.profiles set plan='free'","update public.profiles set plan_status='inactive'",
      "update public.profiles set pro_expires_at=now()",'update public.job_preferences set daily_digest=false',
      'update auth.users set email_confirmed_at=null','update auth.users set deleted_at=now()',
      "update auth.users set banned_until=now()+interval '1 day'"]) {
      await db.exec(mutation);assert.equal((await check(db,d)).error,'recipient_not_eligible');
      await assert.rejects(db.query('select public.start_daily_digest_attempt($1,$2)',[d.id,token]),/refused/);
      await db.exec("update public.profiles set plan='pro',plan_status='active',pro_expires_at=null; update public.job_preferences set daily_digest=true; update auth.users set email_confirmed_at=now(),deleted_at=null,banned_until=null;");
    }
    await db.exec("update auth.users set email='changed@example.com'");
    await assert.rejects(db.query('select public.start_daily_digest_attempt($1,$2)',[d.id,token]),/attempt refused/);
    await db.exec("update auth.users set email='alex@example.com'; update public.jobs set status='closed' where id=1;");
    assert.equal((await check(db,d)).error,'frozen_matches_changed');
    await db.exec("update public.jobs set status='active' where id=1;");
    await db.query('select public.start_daily_digest_attempt($1,$2)',[d.id,token]);
    await db.query('select public.defer_daily_digest($1,$2,$3,$4)',[d.id,token,'retry','unknown']);
    await db.exec("update public.daily_digest_deliveries set first_attempt_at=now()-interval '23 hours',next_attempt_at=now();");
    assert.equal(await claim(db),undefined);
    assert.equal((await db.query('select status,last_error from public.daily_digest_deliveries')).rows[0].status,'held');
  }finally{await db.close();}
});
test('top-100 limitation, empty digest, created/collected/posted fallbacks and half-open 24-hour bounds',integration,async()=>{
  const db=await database();try {
    await db.exec(`update public.jobs set created_at=${end}-interval '2 days';
      update public.jobs set created_at=${end}-interval '24 hours' where id=1;
      update public.jobs set created_at=null,collected_at=${end}-interval '1 hour' where id=2;
      update public.jobs set created_at=null,collected_at=null,posted_at=${end}-interval '1 hour' where id=3;
      update public.jobs set created_at=null,collected_at=null,posted_at=null where id=4;
      update public.jobs set created_at=${end}-interval '24 hours 1 second' where id=5;`);
    const items=(await db.query(`select public.daily_digest_matches('${uid}',${end}) as items`)).rows[0].items;
    assert.deepEqual(new Set(items.map(x=>x.job_id)),new Set(['1','2','3']));
    await db.exec(`update public.jobs set title='Administrative Assistant '||id;
      insert into public.jobs(id,title,company,status,philippines_eligible,source,job_url,created_at,posted_at)
      select n,'Virtual Assistant '||n,'Company '||n,'active',true,'workable','https://example.com/'||n,
        ${end}-interval '2 days',${end}-interval '2 days' from generate_series(100,210) n;`);
    assert.equal((await db.query(`select public.daily_digest_matches('${uid}',${end}) as items`)).rows[0].items.length,0);
    const d=await claim(db);assert.equal((await check(db,d)).error,'no_new_matches');
    await db.query('select public.defer_daily_digest($1,$2,$3,$4)',[d.id,token,'skipped','no_new_matches']);
    assert.equal(await claim(db),undefined);
    assert.equal((await db.query('select payload,first_attempt_at from public.daily_digest_deliveries')).rows[0].payload,null);
  }finally{await db.close();}
});
