import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {configuration} from '../src/notifications.js';
import {digestWindow,digestMessage,processDigest,runDailyDigest,previewDailyDigest,scheduledDailyDigest,DIGEST_CRON} from '../src/daily-digest.js';
import worker from '../src/worker.js';
const original=globalThis.fetch;afterEach(()=>{globalThis.fetch=original;});
const uid='11111111-1111-4111-8111-111111111111';
const env={SUPABASE_URL:'https://test.supabase.co',SITE_URL:'https://veeays.test',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test',
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',RESEND_API_KEY:'re_test',DAILY_DIGEST_MODE:'enabled',DAILY_DIGEST_START_AT:'2026-01-01T00:00:00Z'};
const config={...configuration(env,true),publicKey:env.SUPABASE_PUBLISHABLE_KEY};
const item={job_id:'1',title:'<Marketing>',company:'Example',location:'Philippines',match_score:75,salary_min_usd:1500,salary_max_usd:2000,salary_period:'monthly'};
const res=x=>new Response(JSON.stringify(x));
function mock(options={}) {
  const state={delivery:{id:'22222222-2222-4222-8222-222222222222',user_id:uid,digest_day:'2026-10-03',payload:null,first_attempt_at:null},calls:[],deferred:[],checks:0,reads:0,accepted:0};
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(input),name=url.pathname.split('/').at(-1);
    if(url.hostname==='api.resend.com') {
      assert.ok(state.delivery.first_attempt_at);
      state.calls.push({key:init.headers['Idempotency-Key'],body:init.body});
      if(options.timeoutOnce && state.calls.length===1) throw new Error('private timeout');
      if(options.providerStatus) return new Response('{}',{status:options.providerStatus});
      if(options.invalidReceipt) return res({});
      return res({id:'receipt-1'});
    }
    if(name==='check_daily_digest') {
      state.checks++;
      if(options.checkError || (options.optOutBeforeSend && state.checks>1)) return res({error:options.checkError || 'recipient_not_eligible'});
      return res({email:options.changeEmail && state.checks>1 ? 'changed@example.com' : 'alex@example.com',profile:{full_name:'Alex'},items:options.items || [item]});
    }
    if(name==='profiles') return res([{plan:'pro',plan_status:'active',pro_expires_at:null}]);
    if(name==='job_preferences') return res([{daily_digest:!options.optOut,email_strong_matches:false}]);
    if(name==='daily_digest_matches') return res(options.items || [item]);
    if(name==='public_jobs') {
      assert.equal(init.headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);
      assert.equal(init.headers.Authorization,undefined);assert.equal(url.searchParams.get('select'),'id');
      state.reads++;
      return res(options.removed || (options.removeBeforeSend && state.reads>1) ? [] : [{id:1}]);
    }
    if(name===uid) return res({id:uid,email:options.changeEmail && state.checks>1 ? 'changed@example.com' : 'alex@example.com',
      email_confirmed_at:options.unconfirmed ? null : '2026-01-01',deleted_at:options.deleted ? '2026-01-01' : null,
      banned_until:options.banned ? '2099-01-01' : null});
    const body=JSON.parse(init.body || '{}');
    if(name==='freeze_daily_digest') {state.delivery.payload ||= body.p_payload;return res(state.delivery.payload);}
    if(name==='start_daily_digest_attempt') {state.delivery.first_attempt_at ||= new Date().toISOString();return res(state.delivery.first_attempt_at);}
    if(name==='accept_daily_digest') {
      if(options.failDbOnce && state.calls.length===1) return new Response('{}',{status:500});
      state.accepted++;return res(true);
    }
    if(name==='defer_daily_digest') {state.deferred.push(body);return res(true);}
    if(name==='claim_daily_digest') return res(options.noClaim ? [] : [state.delivery]);
    throw new Error('Unexpected request: '+name);
  };
  return state;
}

test('digest window is fixed at 08:00 Manila, including late-day and midnight boundaries',()=>{
  assert.deepEqual(digestWindow(Date.parse('2026-10-03T00:00:00Z')),{day:'2026-10-03',end:'2026-10-03T00:00:00.000Z'});
  assert.equal(digestWindow(Date.parse('2026-10-03T23:59:00Z')).day,'2026-10-03');
  assert.equal(digestWindow(Date.parse('2026-10-04T00:00:00Z')).day,'2026-10-04');
});
test('default disabled, wrong cron, and before activation never access network',async()=>{
  globalThis.fetch=()=>{throw new Error('Network forbidden');};
  for(const mode of [undefined,'disabled','true']) assert.equal((await runDailyDigest({...env,DAILY_DIGEST_MODE:mode},Date.now())).status,'disabled');
  await scheduledDailyDigest({cron:'*/15 * * * *'},env);
  await worker.scheduled({cron:DIGEST_CRON,scheduledTime:Date.now()},{...env,DAILY_DIGEST_MODE:'disabled',STRONG_MATCH_MODE:'enabled'});
  await worker.scheduled({cron:'*/15 * * * *',scheduledTime:Date.now()},{...env,STRONG_MATCH_MODE:'disabled'});
  assert.equal((await runDailyDigest({...env,DAILY_DIGEST_START_AT:'2099-01-01T00:00:00Z'},Date.now())).status,'before_activation');
  await assert.rejects(runDailyDigest({...env,DAILY_DIGEST_START_AT:''},Date.now()),/start/);
  const cfg=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  assert.equal(cfg.vars.DAILY_DIGEST_MODE,'disabled');assert.equal(cfg.keep_vars,true);
  assert.equal(cfg.vars.STRONG_MATCH_MODE,'enabled');assert.equal(cfg.vars.STRONG_MATCH_START_AT,'2026-10-03T04:15:00Z');
  assert.ok(cfg.triggers.crons.includes('*/15 * * * *'));assert.ok(cfg.triggers.crons.includes(DIGEST_CRON));
});
test('digest email matches brand, escapes content, and includes all required links',()=>{
  const m=digestMessage(config,[item],{profile:{full_name:'<Alex>'},email:'alex@example.com'},'2026-10-03');
  assert.equal(m.from,'VeeAys Jobs <jobs@veeays.com>');assert.match(m.html,/veeays-logo.png/);
  assert.match(m.html,/&lt;Marketing&gt;/);assert.match(m.html,/&lt;Alex&gt;/);assert.match(m.html,/75% match/);
  assert.match(m.html,/\$1,500–\$2,000\/month/);assert.match(m.html,/\/jobs\/1/);assert.match(m.html,/\/matches/);
  assert.match(m.html,/\/email-preferences/);assert.doesNotMatch(m.html,/STRONG MATCH ALERT|<Marketing>/);
});
test('durable attempt precedes provider and accepted receipt',async()=>{
  const s=mock();assert.equal(await processDigest(env,config,{...s.delivery},'token'),'accepted');
  assert.equal(s.accepted,1);assert.equal(s.calls.length,1);assert.match(s.calls[0].key,new RegExp(uid+'-2026-10-03$'));
});
test('timeout and receipt commit failure replay identical frozen payload and deterministic daily key',async()=>{
  for(const option of [{timeoutOnce:true},{failDbOnce:true}]) {
    const s=mock(option);assert.equal(await processDigest(env,config,{...s.delivery},'token'),'retry');
    assert.equal(await processDigest(env,config,{...s.delivery},'new-token'),'accepted');
    assert.deepEqual(s.calls[0],s.calls[1]);
  }
});
test('empty, invalid, ineligible, unconfirmed, banned, deleted, nonpublic or changed digests never send',async()=>{
  for(const option of [{checkError:'no_new_matches'},{checkError:'recipient_not_eligible'},
    {checkError:'frozen_matches_changed'},{items:[]},{items:Array(11).fill(item)},
    {items:[{...item,job_id:'not-an-id'}]},{unconfirmed:true},{banned:true},{deleted:true},{removed:true},
    {optOutBeforeSend:true},{removeBeforeSend:true},{changeEmail:true}]) {
    const s=mock(option);assert.ok(['skipped','held'].includes(await processDigest(env,config,{...s.delivery},'token')));
    assert.equal(s.calls.length,0,JSON.stringify(option));
  }
});
test('retry classification handles rate limit, conflict, server, rejection and unknown outcomes',async()=>{
  for(const [option,status] of [[{providerStatus:429},'retry'],[{providerStatus:409},'retry'],[{providerStatus:500},'retry'],[{providerStatus:400},'held'],[{invalidReceipt:true},'retry']]) {
    const s=mock(option);assert.equal(await processDigest(env,config,{...s.delivery},'token'),status);
    assert.equal(s.deferred.at(-1).p_status,status);
  }
  const s=mock();assert.equal(await processDigest(env,config,{...s.delivery,first_attempt_at:'2000-01-01'},'token'),'held');
  assert.equal(s.calls.length,0);
});

test('live preflight is read-only, ignores Strong Match opt-in, checks Auth and public key access, and does not expose addresses',async()=>{
  for(const options of [{},{items:[]},{optOut:true}]) {
    const s=mock(options),mockFetch=globalThis.fetch;
    globalThis.fetch=async(input,init={})=>{
      const url=new URL(input);
      assert.notEqual(url.hostname,'api.resend.com');
      if(init.method==='POST') assert.equal(url.pathname,'/rest/v1/rpc/daily_digest_matches');
      assert.ok(!['PATCH','PUT','DELETE'].includes(init.method));
      return mockFetch(input,init);
    };
    const result=await previewDailyDigest({...env,DAILY_DIGEST_MODE:'disabled'},uid,Date.now());
    assert.equal(result.status,options.optOut ? 'recipient_not_eligible' : options.items ? 'no_new_matches' : 'ready');
    assert.doesNotMatch(JSON.stringify(result),/alex@example/);assert.equal(s.calls.length,0);
  }
});
