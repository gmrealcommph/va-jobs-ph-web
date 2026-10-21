import test from 'node:test';
import assert from 'node:assert/strict';
import {resumeEndpoint,ResumeBudget,validateSuggestions,normalizeResume,boundedText} from '../src/resume-studio.js';
import {parseResume,validateDraft} from '../public/resume-tools.js';
const text='Experience\nI answered customer questions and documented support requests.';
const req=(body={text,consent:true},origin='https://test.local')=>new Request('https://test.local/api/resume/review',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
const env={RESUME_STUDIO_ENABLED:'true',RESUME_AI_ENABLED:'true',RESUME_OPENAI_KEY:'fake-test-only',RESUME_AI_MODEL:'gpt-5-mini'};
const deps={session:async()=>({user:{id:'test-user'},accessToken:'fake'}),profile:async()=>({plan:'pro',plan_status:'active',pro_expires_at:new Date(Date.now()+86400000).toISOString()}),send:()=>{throw Error('Unexpected provider call');}};
test('parser preserves unknown text without guessing credentials',()=>{const p=parseResume('Jane Doe\nExperience\nHelped classmates\nSkills\nWriting');assert.equal(p.name,'');assert.equal(p.projects,'Jane Doe');assert.equal(p.experience,'Helped classmates');assert.equal(p.skills,'Writing');assert.throws(()=>parseResume('x'.repeat(6001)));});
test('draft validation rejects executable or oversized structures',()=>{assert.throws(()=>validateDraft({version:1,sections:{__evil:'hello'}}));assert.throws(()=>validateDraft({version:1,sections:{name:'a'.repeat(121)}}));assert.equal(validateDraft({version:1,sections:{name:'Jane'}}).name,'Jane');});
test('output cannot introduce generated claims or unmatched source',()=>{assert.throws(()=>validateSuggestions([{topic:'evidence',quote:'Increased sales 30%'}],text));assert.throws(()=>validateSuggestions([{topic:'invent',quote:'Experience'}],text));assert.equal(validateSuggestions([{topic:'clarity',quote:'customer questions'}],text)[0].topic,'clarity');assert.throws(()=>normalizeResume('x'.repeat(6001)));});
test('streaming body bound rejects oversized UTF-8 bodies',async()=>{await assert.rejects(boundedText(new Response('a'.repeat(100)),50));});
test('disabled feature, CSRF, free/expired users and missing budget never call AI',async()=>{
  assert.equal((await resumeEndpoint(req(),{},deps)).status,404);
  assert.equal((await resumeEndpoint(req({},'https://evil.local'),env,deps)).status,403);
  assert.equal((await resumeEndpoint(req(),env,{...deps,session:async()=>({})})).status,401);
  for(const p of [{plan:'free'},{plan:'pro',plan_status:'active',pro_expires_at:'2000-01-01'},{plan:'pro',plan_status:'active',pro_expires_at:'invalid'}])assert.equal((await resumeEndpoint(req(),env,{...deps,profile:async()=>p})).status,403);
  assert.equal((await resumeEndpoint(req(),env,deps)).status,503);
  assert.equal((await resumeEndpoint(req({text,consent:false}),env,deps)).status,400);
});
test('budget reservation precedes single bounded mocked provider call',async()=>{
  const events=[];const budget={idFromName:()=>1,get:()=>({fetch:async()=>{events.push('reserve');return new Response('');}})};
  const r=await resumeEndpoint(req(),{...env,RESUME_BUDGET:budget},{...deps,send:async(url,init)=>{events.push('provider');assert.equal(url,'https://api.openai.com/v1/chat/completions');const body=JSON.parse(init.body);assert.equal(body.store,false);assert.equal(body.max_completion_tokens,1200);return Response.json({choices:[{message:{content:JSON.stringify({suggestions:[{topic:'clarity',quote:'customer questions'}]})}}]});}});
  assert.equal(r.status,200);assert.deepEqual(events,['reserve','provider']);assert.equal((await r.json()).suggestions.length,1);
  const denied={idFromName:()=>1,get:()=>({fetch:async()=>new Response('',{status:409})})};assert.equal((await resumeEndpoint(req(),{...env,RESUME_BUDGET:denied},deps)).status,409);
});
function memoryStorage(){const data=new Map();return {data,get:async k=>data.get(k),put:async(k,v)=>data.set(k,structuredClone(v)),delete:async k=>data.delete(k),list:async({prefix})=>new Map([...data].filter(([k])=>k.startsWith(prefix))),getAlarm:async()=>null,setAlarm:async()=>{},transaction:async function(fn){return fn(this);}};}
test('durable budget enforces dedupe, cooldown, quota and global ceiling',async()=>{
  const s=memoryStorage(),b=new ResumeBudget({storage:s},{RESUME_SPEND_CEILING_MICRO_USD:'600000',RESUME_MAX_CALL_MICRO_USD:'100000'});
  const reserve=(u,h)=>b.fetch(new Request('https://budget/reserve',{method:'POST',body:JSON.stringify({uid:u.repeat(64),hash:h.repeat(64)})}));
  assert.equal((await reserve('a','b')).status,200);assert.equal((await reserve('a','b')).status,409);assert.equal((await reserve('a','c')).status,429);
  for(const h of ['c','d','e','f']){s.data.get('user:'+'a'.repeat(64)).last-=61000;assert.equal((await reserve('a',h)).status,200);}
  s.data.get('user:'+'a'.repeat(64)).last-=61000;assert.equal((await reserve('a','0')).status,429);
  assert.equal((await reserve('b','0')).status,200);assert.equal((await reserve('c','1')).status,503);assert.equal(s.data.get('spent'),600000);
  assert.ok(!JSON.stringify([...s.data]).includes('customer'));
});
test('invalid spend config fails closed and expired metadata cleans up without resetting spend',async()=>{const s=memoryStorage(),b=new ResumeBudget({storage:s},{});assert.equal((await b.fetch(new Request('https://budget',{method:'POST',body:JSON.stringify({uid:'a'.repeat(64),hash:'b'.repeat(64)})}))).status,503);s.data.set('user:old',{last:0});s.data.set('spent',100);await b.alarm();assert.equal(s.data.has('user:old'),false);assert.equal(s.data.get('spent'),100);});
