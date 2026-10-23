import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {CORE,NICHES,questionsFor,rankNiches,validateAnswers} from '../public/niche-model.js';
import {nicheEndpoint,nicheJobs,savedFinder} from '../src/niche-finder.js';
import {handle} from '../src/worker.js';
const original=globalThis.fetch;afterEach(()=>globalThis.fetch=original);
const env={SITE_URL:'https://veeays.test',SUPABASE_URL:'https://db.test',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
function answers(picks={}){const a=Object.fromEntries(CORE.map(q=>[q.id,picks[q.id]||'unsure']));for(const q of questionsFor(a).slice(12))a[q.id]=picks[q.id]||'unsure';return a;}
test('all 12 niches can rank first without experience, with distinct adaptive followups',()=>{
 for(const niche of NICHES){const a={};for(const q of CORE)a[q.id]=q.choices.slice().sort((a,b)=>(b.weights[niche.id]||0)-(a.weights[niche.id]||0))[0].id;for(const q of questionsFor(a).slice(12))a[q.id]=q.choices.slice().sort((a,b)=>(b.weights[niche.id]||0)-(a.weights[niche.id]||0))[0].id;assert.equal(rankNiches(a)[0].id,niche.id,niche.id);assert.equal(questionsFor(a).length,14);assert.equal(new Set(questionsFor(a).map(q=>q.id)).size,14);}
});
test('uncertain answers stay neutral and deterministic; malformed and obsolete adaptive answers reject',()=>{
 const a=answers(),r=rankNiches(a);assert.equal(r.length,3);assert.ok(r.every(n=>n.score===0&&n.reasons.length===0));assert.deepEqual(rankNiches(a),r);
 for(const bad of [null,[],{}, {...a,interest:'injected'},{...a,role:'admin'}])assert.throws(()=>validateAnswers(bad));
 const creative=answers({interest:'create',strength:'visual',learning:'stories'});assert.notDeepEqual(questionsFor(creative).slice(12).map(q=>q.id),questionsFor(a).slice(12).map(q=>q.id));
});
function fixture({user=true,confirmed=true,saved=null,preferences=true,failSave=false,failJobs=false}={}){
 const writes=[];const member={id:'member-a',email_confirmed_at:confirmed?'2026-10-23':null,user_metadata:{full_name:'Member',niche_finder:saved}};
 globalThis.fetch=async(input,init={})=>{const u=new URL(input);if(u.pathname==='/auth/v1/user'){
  if(init.method==='PUT'){writes.push({path:u.pathname,...JSON.parse(init.body)});if(failSave)return Response.json({message:'sensitive backend detail'},{status:500});member.user_metadata={...member.user_metadata,...JSON.parse(init.body).data};}
  return user?Response.json(member):Response.json({}, {status:401});
 }
 if(u.pathname==='/rest/v1/public_jobs'){if(failJobs)return new Response('',{status:503});return Response.json([{id:123,title:'Customer <script>alert(1)</script>',company:'Example',category:'Customer Support',location:'Philippines'}]);}
 if(u.pathname==='/rest/v1/job_preferences'){if(init.method==='PATCH'||init.method==='POST'){writes.push({path:u.pathname,...JSON.parse(init.body)});return Response.json([{user_id:'member-a',...JSON.parse(init.body)}]);}return Response.json(preferences?[{user_id:'member-a',target_roles:['Existing'],minimum_salary_usd:1200,daily_digest:false,email_strong_matches:false}]:[]);}
 throw Error('Unexpected request '+u.pathname);
 };return {member,writes};
}
function req(path='',data=null,origin=env.SITE_URL){return new Request(env.SITE_URL+'/niche-finder'+path,{method:data?'POST':'GET',headers:{cookie:'veeays_access=test',...(data?{origin,'content-type':'application/x-www-form-urlencoded'}:{})},...(data?{body:new URLSearchParams(data)}:{})});}
const saved={version:1,answers:answers(),selected:['va','support','data'],updatedAt:'2026-10-23T00:00:00Z'};
test('auth and verified-email gates; cross-origin and oversized writes rejected',async()=>{
 let f=fixture({user:false});assert.match((await nicheEndpoint(req(),env)).headers.get('location'),/login\?return=%2Fniche-finder/);assert.equal(f.writes.length,0);
 fixture({confirmed:false});assert.match((await nicheEndpoint(req(),env)).headers.get('location'),/check-email/);
 f=fixture();assert.equal((await nicheEndpoint(req('',{answers:JSON.stringify(saved.answers)},'https://evil.test'),env)).status,403);assert.equal(f.writes.length,0);
 assert.equal((await nicheEndpoint(req('',{answers:'x'.repeat(13000)}),env)).status,413);
});
test('results persist only under niche metadata; no preferences, emails, payments or paid APIs touched',async()=>{
 const f=fixture();const r=await handle(req('',{answers:JSON.stringify(saved.answers)}),env);assert.equal(r.status,303);assert.equal(f.writes.length,1);assert.deepEqual(Object.keys(f.writes[0].data),['niche_finder']);assert.deepEqual(f.member.user_metadata.full_name,'Member');assert.equal(savedFinder(f.member).results.length,3);
 const page=await nicheEndpoint(req(),env);const html=await page.text();assert.equal(page.headers.get('cache-control'),'no-store');assert.match(html,/Three paths worth exploring/);assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);assert.match(html,/&lt;script&gt;/);
});
test('chosen niches update only target_roles on existing matching profile and use current user id',async()=>{
 const f=fixture({saved});const form=new URLSearchParams();form.append('selected','support');form.append('selected','design');const r=await nicheEndpoint(req('/preferences',form),env);assert.equal(r.status,303);assert.deepEqual(f.writes[0],{path:'/rest/v1/job_preferences',target_roles:['Customer Support','Graphic Design']});assert.deepEqual(f.writes[1].data.niche_finder.selected,['support','design']);
});
test('new matching profile can be created; invalid selections and incomplete answers never write',async()=>{
 let f=fixture({saved,preferences:false});assert.equal((await nicheEndpoint(req('/preferences',{selected:'va'}),env)).status,303);assert.deepEqual(f.writes[0],{path:'/rest/v1/job_preferences',user_id:'member-a',target_roles:['General VA'],email_strong_matches:false,daily_digest:false});
 f=fixture({saved});for(const data of [{selected:'admin'},{selected:''}])assert.equal((await nicheEndpoint(req('/preferences',data),env)).status,400);assert.equal((await nicheEndpoint(req('',{answers:'{}'}),env)).status,400);assert.equal(f.writes.length,0);
});
test('edit retains answers; retake leaves saved data untouched; save and listing failures are honest',async()=>{
 let f=fixture({saved});let html=await(await nicheEndpoint(req('?edit=1'),env)).text();assert.match(html,/nf-data/);assert.match(html,/"interest":"unsure"/);html=await(await nicheEndpoint(req('?retake=1'),env)).text();assert.match(html,/"answers":\{\}/);assert.equal(f.writes.length,0);
 fixture({saved,failSave:true});const r=await nicheEndpoint(req('',{answers:JSON.stringify(saved.answers)}),env);assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/sensitive backend/);
 fixture({saved,failJobs:true});html=await(await nicheEndpoint(req(),env)).text();assert.match(html,/Jobs could not load/);
});
test('eligible jobs reuse public_jobs, restrict niche category and filter specialized titles',async()=>{
 let called;globalThis.fetch=async url=>{called=new URL(url);return Response.json([]);};await nicheJobs(env,NICHES.find(n=>n.id==='video'));assert.equal(called.pathname,'/rest/v1/public_jobs');assert.equal(called.searchParams.get('category'),'eq.Design & Creative');assert.match(called.searchParams.get('or'),/video/);assert.equal(called.searchParams.get('limit'),'3');
});
test('signup email carries the finder return path and verification session accepts it; ordinary login stays optional',async()=>{
 let signupPayload;globalThis.fetch=async(url,init={})=>{const u=new URL(url);if(u.pathname==='/auth/v1/signup'){signupPayload=u;return Response.json({user:{id:'new-member'}});}if(u.pathname==='/auth/v1/user')return Response.json({id:'new-member',email_confirmed_at:'2026-10-23'});if(u.pathname==='/auth/v1/token')return Response.json({access_token:'a',refresh_token:'b',expires_in:3600,user:{id:'existing-member'}});throw Error(u.pathname);};
 const r=await handle(new Request(env.SITE_URL+'/signup',{method:'POST',headers:{origin:env.SITE_URL},body:new URLSearchParams({email:'test@example.com',password:'test-password-123',full_name:'Test Member'})}),env);
 assert.equal(r.status,303);assert.match(r.headers.get('location'),/return=%2Fniche-finder/);assert.equal(new URL(signupPayload.searchParams.get('redirect_to')).searchParams.get('return'),'/niche-finder');
 const callback=await handle(new Request(env.SITE_URL+'/auth/session',{method:'POST',headers:{origin:env.SITE_URL,'content-type':'application/json'},body:JSON.stringify({access_token:'a',refresh_token:'b',return:'/niche-finder'})}),env);assert.equal((await callback.json()).redirect,'/niche-finder');assert.match(callback.headers.get('set-cookie'),/HttpOnly/);
 const login=await handle(new Request(env.SITE_URL+'/login',{method:'POST',headers:{origin:env.SITE_URL},body:new URLSearchParams({email:'test@example.com',password:'test-password-123'})}),env);assert.equal(login.headers.get('location'),'/');
});
test('account metadata dates and selected ids are sanitized and never become authorization claims',()=>{
 const value=savedFinder({user_metadata:{niche_finder:{...saved,updatedAt:'invalid',selected:['va','va','admin'],plan:'pro'}}});assert.equal(value.updatedAt,null);assert.deepEqual(value.selected,['va']);assert.equal(value.plan,undefined);
});
test('completion count follows successful save only; visits, edits and failed saves never count',async()=>{
 let count=0;const counted=new Set(),countEnv={...env,ACTIVE_VISITORS:{getByName:()=>({fetch:async(url,init)=>{const {id}=JSON.parse(init.body);if(!counted.has(id)){counted.add(id);count++;}return Response.json({recorded:true});}})}};
 fixture();await nicheEndpoint(req(),countEnv);assert.equal(count,0);const completion_id=crypto.randomUUID(),payload={answers:JSON.stringify(saved.answers),completion_id};await nicheEndpoint(req('',payload),countEnv);await nicheEndpoint(req('',payload),countEnv);assert.equal(count,1);
 fixture({saved});await nicheEndpoint(req('?edit=1'),countEnv);await nicheEndpoint(req('/preferences',{selected:'va'}),countEnv);assert.equal(count,1);
 fixture({failSave:true});assert.equal((await nicheEndpoint(req('',{...payload,completion_id:crypto.randomUUID()}),countEnv)).status,502);assert.equal(count,1);
});
