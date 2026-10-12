import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {PaymentTracker,playPaymentCelebration} from '../public/admin-live.js';
const event=(n,at='2026-10-09T10:00:01Z')=>({event_id:n.toString(16).padStart(32,'0'),confirmed_at:at,amount_minor:49900,currency:'PHP'});
const snap=(events,at='2026-10-09T10:00:30Z')=>({available:true,generated_at:at,events});
test('payment alerts baseline silently, deduplicate, and recover without replaying history',()=>{
 const tracker=new PaymentTracker();assert.deepEqual(tracker.observe(snap([event(1,'2026-10-09T09:00:00Z')],'2026-10-09T10:00:00Z')),[]);
 assert.deepEqual(tracker.observe({available:false}),[]);
 assert.deepEqual(tracker.observe(snap([event(1,'2026-10-09T09:00:00Z'),event(2),event(2),event(3,'2026-10-09T09:59:59Z')])),[event(2)]);
 assert.deepEqual(tracker.observe(snap([event(2)])),[]);
 assert.deepEqual(tracker.observe(snap([{...event(4),amount_minor:0},event(5,'2026-10-09T11:00:00Z')])),[]);
});
test('celebration requires enabled audio and plays an ascending major arpeggio under one second',()=>{
 assert.equal(playPaymentCelebration(null),false);assert.equal(playPaymentCelebration({state:'suspended'}),false);
 const notes=[];const ctx={state:'running',currentTime:0,destination:{},createOscillator(){let note={frequency:{setValueAtTime(f){note.f=f;}},connect(){},start(t){note.start=t;},stop(t){note.stop=t;}};notes.push(note);return note;},createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}};
 assert.equal(playPaymentCelebration(ctx),true);assert.deepEqual(notes.map(n=>n.f),[523.25,659.25,783.99,1046.5,2093]);assert.ok(notes.every(n=>n.stop<1));assert.ok(notes[3].start>notes[0].start);
});
test('payment snapshot protects live verified records and leaves the ledger unchanged',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema veeays_admin;grant usage on schema veeays_admin to authenticated;
 create function veeays_admin.has_access() returns boolean language sql as $$select current_setting('request.jwt.claim.sub',true)='owner'$$;
 create table public.pro_payments(id integer primary key,payment_id text,amount integer,currency text,livemode boolean,status text,paid_at timestamptz,confirmed_at timestamptz);
 insert into public.pro_payments values (1,'pay_live',49900,'PHP',true,'confirmed',now()-interval '1 day',now()),(2,'pay_test',49900,'PHP',false,'confirmed',now(),now()),(3,null,49900,'PHP',true,'pending',null,null),(4,'old',49900,'PHP',true,'confirmed',now()-interval '2 days',now()-interval '2 days'),(5,null,49900,'PHP',true,'confirmed',now(),now());`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261009012419_admin_payment_notifications.sql',import.meta.url),'utf8'));
 await db.exec('set role anon');await assert.rejects(db.query('select public.veeays_admin_payment_snapshot()'));
 await db.exec("reset role;set role authenticated;set request.jwt.claim.sub='member'");await assert.rejects(db.query('select public.veeays_admin_payment_snapshot()'));
 await db.exec("set request.jwt.claim.sub='owner'");const data=(await db.query('select public.veeays_admin_payment_snapshot() data')).rows[0].data;
 assert.equal(data.events.length,1);assert.equal(data.events[0].amount_minor,49900);assert.match(data.events[0].event_id,/^[a-f0-9]{32}$/);assert.deepEqual(Object.keys(data.events[0]).sort(),['amount_minor','confirmed_at','currency','event_id']);
 await assert.rejects(db.query('select * from public.pro_payments'));
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int count from public.pro_payments')).rows[0].count,5);
 }finally{await db.close();}
});
