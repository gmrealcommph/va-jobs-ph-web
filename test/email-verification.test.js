import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import worker,{handle} from '../src/worker.js';
import {verificationResend,scheduledVerification,verificationReturn} from '../src/email-verification.js';
import {renderVerification} from '../public/admin-verification.js';
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fixture',SITE_URL:'https://veeays.com',RESEND_API_KEY:'fixture',EMAIL_VERIFICATION_REMINDERS_ENABLED:'true',EMAIL_VERIFICATION_START_AT:'2026-10-01T00:00:00Z'};
const id='11111111-1111-4111-8111-111111111111';
const req=(fields={},headers={})=>new Request(env.SITE_URL+'/auth/resend',{method:'POST',headers:{origin:env.SITE_URL,'cf-connecting-ip':'192.0.2.1',...headers},body:new URLSearchParams({email:'member@example.test',return:'/apply/101',...fields})});

test('resend is POST and same-origin only; durable reservation precedes provider; generic response prevents enumeration',async()=>{
 const calls=[];const deps={usage:async()=>({available:true,daily:{used:11,limit:100},monthly:{used:55,limit:3000}}),session:async()=>({user:null}),call:async(e,n,b)=>{calls.push({n,b});return true;},send:async(e,p,b)=>{calls.push({p,b:JSON.parse(b.body)});return {response:new Response(null,{status:400})};}};
 const response=await verificationResend(req(),env,deps);
 assert.equal(response.status,303);assert.equal(calls.length,2);assert.match(calls[0].b.p_email_hash,/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(calls[0]).includes('member@'),false);
 assert.equal(new URL(calls[1].p,env.SUPABASE_URL).pathname,'/auth/v1/resend');assert.equal(calls[1].b.type,'signup');assert.equal(new URL(calls[1].p,env.SUPABASE_URL).searchParams.get('redirect_to'),'https://veeays.com/auth/callback?return=%2Fapply%2F101');
 assert.equal(response.headers.get('location'),'/check-email?requested=1&return=%2Fapply%2F101');
 calls.length=0;assert.equal((await verificationResend(req({}, {origin:'https://evil.test'}),env,deps)).status,403);assert.equal(calls.length,0);
 assert.equal((await verificationResend(new Request(env.SITE_URL+'/auth/resend'),env,deps)).status,405);
 for(const allowed of [false]){await verificationResend(req(),env,{...deps,call:async()=>allowed,send:()=>assert.fail('limited')});}
 await verificationResend(req(),env,{...deps,call:async()=>{throw Error('DB down');},send:()=>assert.fail('storage outage')}).then(r=>assert.equal(r.status,503));
 await verificationResend(req(),env,{...deps,session:async()=>({user:{email:'verified@example.test',email_confirmed_at:'now'}}),call:()=>assert.fail('already verified')});
 assert.equal(verificationReturn('//evil.test'),'');assert.equal(verificationReturn('/apply/101?redirect=evil'),'');
});

test('Apply Now gates anonymous and unverified users and returns verified users to stored employer destination',async()=>{
 const old=globalThis.fetch;let user=null;
 globalThis.fetch=async(input)=>{const path=new URL(input).pathname;return Response.json(path==='/auth/v1/user'?user:path==='/rest/v1/profiles'?[]:[{id:101,title:'Selected role',job_url:'https://employer.test/101'}]);};
 try{
  const request=path=>new Request(env.SITE_URL+path,{headers:user?{cookie:'veeays_access=token'}:{}});
  let r=await handle(request('/apply/101'),env);assert.match(r.headers.get('location'),/signup\?return=%2Fapply%2F101/);
  user={id,email:'member@example.test'};r=await handle(request('/apply/101'),env);assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/check-email?return=%2Fapply%2F101');
  r=await handle(request('/check-email?return=%2Fapply%2F101'),env);assert.equal(r.status,200);assert.match(await r.text(),/name="return" value="\/apply\/101"/);assert.match(r.headers.get('cache-control'),/no-store/);
  r=await handle(request('/auth/callback?return=%2Fapply%2F101'),env);assert.equal(r.status,200);assert.match(await r.text(),/auth-callback.js/);
  user.email_confirmed_at='2026-10-14T00:00:00Z';r=await handle(request('/apply/101?redirect=https://evil.test'),env);assert.equal(r.status,302);assert.equal(r.headers.get('location'),'https://employer.test/101');assert.match(r.headers.get('cache-control'),/no-store/);
 }finally{globalThis.fetch=old;}
});

test('unconfirmed login keeps selected job and offers resend; successful callback retains application path',async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async input=>new URL(input).pathname==='/auth/v1/user'?Response.json({id,email_confirmed_at:'now'}):Response.json({code:'email_not_confirmed'},{status:400});
 try{
  let r=await handle(new Request(env.SITE_URL+'/login',{method:'POST',headers:{origin:env.SITE_URL},body:new URLSearchParams({email:'member@example.test',password:'longpassword',return:'/apply/101'})}),env);
  assert.match(r.headers.get('location'),/check-email\?email=member%40example.test&return=%2Fapply%2F101/);
  r=await handle(new Request(env.SITE_URL+'/auth/session',{method:'POST',headers:{origin:env.SITE_URL,'content-type':'application/json'},body:JSON.stringify({access_token:'access',refresh_token:'refresh',return:'/apply/101'})}),env);
  assert.equal((await r.json()).redirect,'/apply/101');assert.equal(r.headers.getSetCookie().length,2);
 }finally{globalThis.fetch=old;}
});

const quota=async()=>({available:true,daily:{used:11,limit:100},monthly:{used:55,limit:3000}});
test('reminders recheck Auth, use deterministic keys, persist receipt and fail closed on quota',async()=>{
 const calls=[];const person={id:'reminder-id',user_id:id,email:'member@example.test'};let confirmed=false;
 const deps={usage:quota,call:async(e,n,b)=>{calls.push({n,b});return n.endsWith('_claim')?person:true;},send:async(input,init)=>{
  if(String(input).includes('/auth/v1/'))return Response.json({id,email:person.email,email_confirmed_at:confirmed?'now':null});
  calls.push({message:JSON.parse(init.body),key:init.headers['Idempotency-Key']});return Response.json({id:'receipt'});
 }};
 await scheduledVerification({},env,deps);assert.equal(calls[1].key,'veeays-verification-reminder-id');assert.equal(calls[2].b.p_state,'sent');assert.equal(calls[2].b.p_receipt,'receipt');
 calls.length=0;confirmed=true;await scheduledVerification({},env,deps);assert.equal(calls.length,2);assert.equal(calls[1].b.p_state,'skipped');
 for(const q of [{available:false},{available:true,stale:true},{available:true,daily:{used:85,limit:100},monthly:{used:55,limit:3000}}])await scheduledVerification({},env,{...deps,usage:async()=>q,call:()=>assert.fail('quota gate')});
 await scheduledVerification({},{...env,EMAIL_VERIFICATION_REMINDERS_ENABLED:'false'},{call:()=>assert.fail('disabled')});
 await assert.rejects(scheduledVerification({},{...env,EMAIL_VERIFICATION_START_AT:''},deps),/cohort/);
 const tasks=[];worker.scheduled({cron:'*/15 * * * *'}, {...env,EMAIL_VERIFICATION_REMINDERS_ENABLED:'false'}, {waitUntil:p=>tasks.push(p)});assert.equal(tasks.length,0);
});

async function database(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema veeays_admin;
 create function veeays_admin.has_access() returns boolean language sql as $$select current_setting('request.jwt.claim.sub',true)='${id}'$$;
 create table auth.users(id uuid primary key,email text,created_at timestamptz,email_confirmed_at timestamptz,deleted_at timestamptz,is_anonymous boolean,banned_until timestamptz);
 insert into auth.users(id,email,created_at) values('${id}','member@example.test',now()-interval '25 hours');`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261014134315_priority_1_email_verification.sql',import.meta.url),'utf8'));
 return db;
}
test('real SQL: reminder stages, lease, frozen identity, retry horizon, cap, deletion and admin-only data',async()=>{
 const db=await database();try{
  const claim=async()=> (await db.query("select public.veeays_verification_reminder_claim(now()-interval '6 days') r")).rows[0].r;
  await db.exec('set role service_role');const first=await claim();assert.equal(first.stage,24);assert.equal(await claim(),null);
  await db.exec("reset role;update veeays_verification.reminders set next_attempt_at=now()-interval '1 second';set role service_role;");assert.equal((await claim()).id,first.id);
  await db.query("select public.veeays_verification_reminder_finish($1,'sent','receipt')",[first.id]);assert.equal(await claim(),null);
  await db.exec("reset role;update auth.users set created_at=now()-interval '73 hours';update veeays_verification.reminders set first_attempt_at=now()-interval '49 hours';set role service_role");
  const second=await claim();assert.equal(second.stage,72);
  await db.exec("reset role;update veeays_verification.reminders set first_attempt_at=now()-interval '24 hours',next_attempt_at=now()-interval '1 second' where stage=72;set role service_role;");assert.equal(await claim(),null);
  await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='other';`);await assert.rejects(db.query('select public.veeays_admin_verification_snapshot()'),/Admin access/);
  await assert.rejects(db.query("select public.veeays_verification_reminder_claim(now())"),/permission denied/);
  await assert.rejects(db.query('select * from veeays_verification.reminders'),/permission denied/);
  await db.exec(`set request.jwt.claim.sub='${id}'`);const data=(await db.query('select public.veeays_admin_verification_snapshot() d')).rows[0].d;assert.equal(data.unverified,1);assert.equal(data.reminders.review,1);assert.equal(data.members[0].email,'member@example.test');
  await db.exec(`reset role;delete from auth.users where id='${id}'`);assert.equal((await db.query('select count(*) n from veeays_verification.reminders')).rows[0].n,0);
 }finally{await db.close();}
});
test('real SQL: resend cooldown and rolling address, IP and global caps are durable and inaccessible to members',async()=>{
 const db=await database();try{
  const email='a'.repeat(64),ip='b'.repeat(64);const claim=async(e=email,i=ip)=>(await db.query('select public.veeays_verification_resend_claim($1,$2) ok',[e,i])).rows[0].ok;
  await db.exec('set role service_role');assert.equal(await claim(),true);assert.equal(await claim(),false);
  for(let n=0;n<2;n++){await db.exec("reset role;update veeays_verification.resend_attempts set attempted_at=attempted_at-interval '61 seconds';set role service_role");assert.equal(await claim(),true);}
  await db.exec("reset role;update veeays_verification.resend_attempts set attempted_at=attempted_at-interval '61 seconds';set role service_role");assert.equal(await claim(),false);
  for(let n=0;n<7;n++)assert.equal(await claim(n.toString(16).padStart(64,'0')),true);assert.equal(await claim('c'.repeat(64)),false);
  await db.exec("reset role;truncate veeays_verification.resend_attempts;set role service_role");
  for(let n=0;n<20;n++)assert.equal(await claim(n.toString(16).padStart(64,'0'),n.toString(16).padStart(64,'0')),true);
  assert.equal(await claim('d'.repeat(64),'e'.repeat(64)),false);
  await db.exec('reset role;set role authenticated');await assert.rejects(claim(),/permission denied/);
 }finally{await db.close();}
});
test('admin verification escapes member data and distinguishes provider acceptance from delivery',()=>{
 const html=renderVerification({available:true,verified:1,unverified:1,total:2,reminders:{sent:2},members:[{email:'<script>alert(1)</script>'}]});
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/does not confirm inbox delivery/);
});

test('unknown provider outcome and failed receipt commit retry identical reminder payload and key',async()=>{
 const sent=[];const person={id:'frozen',user_id:id,email:'member@example.test'};let attempt=0;
 const deps={usage:quota,call:async(e,n)=>n.endsWith('_claim')?person:false,send:async(input,init)=>{
  if(String(input).includes('/auth/v1/'))return Response.json({id,email:person.email});
  sent.push({body:init.body,key:init.headers['Idempotency-Key']});if(attempt++===0)throw Error('timeout');return Response.json({id:'accepted'});
 }};
 await assert.rejects(scheduledVerification({},env,deps),/timeout/);
 await assert.rejects(scheduledVerification({},env,deps),/receipt not committed/);
 assert.deepEqual(sent[0],sent[1]);
});

test('real SQL: cohort, age, confirmed/deleted/banned/anonymous exclusions and ten-reminder daily ceiling',async()=>{
 const db=await database();try{
  await db.exec(`delete from auth.users;
  insert into auth.users(id,email,created_at) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'fixture'||n||'@example.test',now()-interval '25 hours' from generate_series(1,20) n;
  update auth.users set email_confirmed_at=now() where email like 'fixture1@%';
  update auth.users set deleted_at=now() where email like 'fixture2@%';
  update auth.users set banned_until=now()+interval '1 day' where email like 'fixture3@%';
  update auth.users set is_anonymous=true where email like 'fixture4@%';
  update auth.users set created_at=now()-interval '8 days' where email like 'fixture5@%';
  update auth.users set created_at=now()-interval '23 hours' where email like 'fixture6@%';
  set role service_role;`);
  assert.equal((await db.query("select public.veeays_verification_reminder_claim(now()) r")).rows[0].r,null);
  const ids=new Set();for(let n=0;n<10;n++){
   const r=(await db.query("select public.veeays_verification_reminder_claim(now()-interval '6 days') r")).rows[0].r;
   assert.ok(r);assert.ok(!ids.has(r.id));ids.add(r.id);assert.match(r.email,/fixture(?:[7-9]|1\d|20)@/);
  }
  assert.equal((await db.query("select public.veeays_verification_reminder_claim(now()-interval '6 days') r")).rows[0].r,null);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select public.veeays_admin_verification_snapshot()'),/permission denied/);
 }finally{await db.close();}
});
