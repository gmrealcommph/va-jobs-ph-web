import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {batchMessage,processBatch,runStrongMatches,scheduledStrongMatches} from '../src/strong-matches.js';
import {handle} from '../src/worker.js';
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
const uid='11111111-1111-4111-8111-111111111111';
const env={SUPABASE_URL:'https://test.supabase.co',SITE_URL:'https://veeays.test',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test',
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',RESEND_API_KEY:'re_test',STRONG_MATCH_MODE:'enabled',STRONG_MATCH_START_AT:'2026-01-01T00:00:00Z'};
const config={url:new URL(env.SUPABASE_URL),site:env.SITE_URL,key:env.SUPABASE_SERVICE_ROLE_KEY,modernKey:true,publicKey:env.SUPABASE_PUBLISHABLE_KEY};
const profile={plan:'pro',plan_status:'active',pro_expires_at:null,full_name:'Alex'};
const job={id:1,title:'<Marketing>',company:'Example',location:'Philippines',employment_type:'full_time',salary_min_usd:1500,salary_max_usd:2000,salary_period:'monthly',status:'active'};
const notification={id:1,user_id:uid,job_id:1,match_score:100,notification_type:'strong_match',notified_at:null};
const res=x=>new Response(JSON.stringify(x));
function mock(options={}) {
  const state={batch:{id:'22222222-2222-4222-8222-222222222222',user_id:uid,payload:null,first_attempt_at:null},providerCalls:[],deferred:[],accepted:0,reads:0,profileReads:0};
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(input); const name=url.pathname.split('/').at(-1);
    if(url.hostname==='api.resend.com') {
      assert.equal(state.batch.first_attempt_at!==null,true);
      assert.equal(state.accepted,0);
      state.providerCalls.push({key:init.headers['Idempotency-Key'],body:init.body});
      if(options.timeoutOnce && state.providerCalls.length===1) throw new Error('private upstream timeout');
      if(options.providerStatus) return new Response('{}',{status:options.providerStatus});
      return res({id:'receipt-1'});
    }
    if(name===uid) return res({id:uid,email:options.emailChanged && state.profileReads>1 ? 'changed@example.com' : 'alex@example.com',email_confirmed_at:options.unconfirmed ? null : '2026-01-01'});
    if(name==='profiles') {
      state.profileReads++;
      return res([{...profile,...options.profile,...(options.expire && state.profileReads>1 ? {pro_expires_at:'2000-01-01'} : {})}]);
    }
    if(name==='job_preferences') return res([{email_strong_matches:options.optOut ? false : true}]);
    if(name==='strong_match_batch_items') return res([{notification_id:'1',job_id:'1',match_score:100}]);
    if(name==='job_match_notifications') return res([{...notification,...options.notification}]);
    if(name==='public_jobs') {
      assert.equal(init.headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);
      state.reads++;
      return res(options.removed || (options.removeBeforeSend && state.reads>1) ? [] : [job]);
    }
    if(name==='jobs') return res([{...job,...options.job}]);
    const body=JSON.parse(init.body||'{}');
    if(name==='freeze_strong_match_batch') {state.batch.payload=body.p_payload;return res(state.batch.payload);}
    if(name==='start_strong_match_attempt') {state.batch.first_attempt_at ||= new Date().toISOString();return res(state.batch.first_attempt_at);}
    if(name==='accept_strong_match_batch') {
      if(options.failDbOnce && state.providerCalls.length===1) return new Response('{}',{status:500});
      state.accepted++;return res(true);
    }
    if(name==='defer_strong_match_batch') {state.deferred.push(body);return res(true);}
    if(name==='claim_strong_match_batch') return res(options.noClaim ? [] : [state.batch]);
    throw new Error('Unexpected request '+name);
  };
  return state;
}
test('disabled/missing mode, wrong cron and retired manual endpoint never fetch',async()=>{
  globalThis.fetch=()=>{throw new Error('Network forbidden');};
  for(const mode of [undefined,'disabled','true']) assert.equal((await runStrongMatches({...env,STRONG_MATCH_MODE:mode})).status,'disabled');
  await scheduledStrongMatches({cron:'* * * * *'},env);
  assert.equal((await handle(new Request(env.SITE_URL+'/internal/strong-match/165',{method:'POST'}),{...env,STRONG_MATCH_MODE:'disabled'})).status,410);
  await assert.rejects(runStrongMatches({...env,STRONG_MATCH_START_AT:''}),/cutoff/);
});
test('batch email uses brand, compact metadata, escaped job cards, supported scores and preferences link',()=>{
  const msg=batchMessage(config,[{notification,job},{notification:{...notification,match_score:null},job:{id:2,title:'Second'}}],{profile,email:'alex@example.com'});
  assert.equal(msg.from,'VeeAys Jobs <jobs@veeays.com>');
  assert.match(msg.html,/veeays-logo.png/);assert.match(msg.html,/Philippines · Full-time · \$1,500–\$2,000\/month/);
  assert.match(msg.html,/&lt;Marketing&gt;/);assert.match(msg.html,/100% match/);assert.match(msg.text,/Manage email preferences/);
  assert.match(msg.subject,/2 new strong matches/);assert.doesNotMatch(msg.html,/Matches your|<Marketing>/);
});
test('provider acceptance precedes atomic DB receipt and acknowledgement',async()=>{
  const s=mock();assert.equal(await processBatch(env,config,{...s.batch},'token'),'accepted');assert.equal(s.accepted,1);assert.equal(s.providerCalls.length,1);
});
test('timeout and DB failure after acceptance replay identical frozen payload and key',async()=>{
  for(const option of [{timeoutOnce:true},{failDbOnce:true}]) {
    const s=mock(option);assert.equal(await processBatch(env,config,{...s.batch},'token'),'retry');
    assert.equal(await processBatch(env,config,{...s.batch},'token-2'),'accepted');
    assert.deepEqual(s.providerCalls[0],s.providerCalls[1]);assert.equal(s.accepted,1);
  }
});
test('recipient eligibility, public job availability, notification identity and confirmed email fail closed',async()=>{
  for(const option of [{profile:{plan:'free'}},{profile:{plan_status:'inactive'}},{profile:{pro_expires_at:'2000-01-01'}},
    {optOut:true},{unconfirmed:true},{removed:true},{job:{is_active:false}},{notification:{notification_type:'daily_digest'}},
    {notification:{notified_at:'2026-01-01'}},{notification:{user_id:'other'}},{expire:true},{emailChanged:true},{removeBeforeSend:true}]) {
    const s=mock(option);assert.ok(['skipped','held'].includes(await processBatch(env,config,{...s.batch},'token')));
    assert.equal(s.providerCalls.length,0,JSON.stringify(option));
  }
});
test('expired unknown outcome never retries provider',async()=>{
  const s=mock();s.batch.first_attempt_at=new Date(Date.now()-24*3600000).toISOString();
  assert.equal(await processBatch(env,config,{...s.batch},'token'),'held');assert.equal(s.providerCalls.length,0);
});
test('rate limits/server errors retry; permanent rejection is quarantined; no claims send nothing',async()=>{
  for(const status of [429,500,409,422]) {
    const s=mock({providerStatus:status});await processBatch(env,config,{...s.batch},'token');
    assert.equal(s.deferred[0].p_status,status===422 ? 'held' : 'retry');assert.equal(s.accepted,0);
  }
  const s=mock({noClaim:true});await runStrongMatches(env);assert.equal(s.providerCalls.length,0);
});
test('per-run bound is three batch claims',async()=>{
  const s=mock();const fetchMock=globalThis.fetch;let claims=0;
  globalThis.fetch=async(input,init)=>{
    if(new URL(input).pathname.endsWith('claim_strong_match_batch')) {
      claims++;s.accepted=0;s.batch={...s.batch,id:crypto.randomUUID(),payload:null,first_attempt_at:null};
    }
    return fetchMock(input,init);
  };
  await runStrongMatches({...env,STRONG_MATCH_MAX_BATCHES:'3'});assert.equal(claims,3);assert.equal(s.providerCalls.length,3);
  claims=0;s.providerCalls=[];
  await runStrongMatches(env);assert.equal(claims,1);assert.equal(s.providerCalls.length,1);
});
