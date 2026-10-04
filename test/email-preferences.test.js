import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {emailPreferences} from '../src/email-preferences.js';
import {setEmailPreferences} from '../src/auth.js';
const originalFetch=globalThis.fetch;afterEach(()=>{globalThis.fetch=originalFetch;});
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const site='https://veeays.test',uid='11111111-1111-4111-8111-111111111111';
function mock(options={}) {
  const writes=[],row={email_strong_matches:true,daily_digest:false,target_roles:['General VA'],minimum_salary_usd:1500,
    schedule_preferences:['us'],employment_types:['full_time'],experience_level:'mid',skills:['Excel'],industries:['Finance']};
  globalThis.fetch=async(input,init)=>{
    const url=new URL(input);assert.equal(init.headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);
    assert.equal(init.headers.Authorization,'Bearer user_access');
    if(url.pathname==='/auth/v1/user')return new Response(JSON.stringify({id:uid,email:'alex@example.com'}));
    if(url.pathname==='/rest/v1/profiles')return new Response(JSON.stringify([{plan:options.free ? 'free' : 'pro',plan_status:'active'}]));
    assert.equal(url.pathname,'/rest/v1/job_preferences');assert.equal(url.searchParams.get('user_id'),'eq.'+uid);
    if(init.method==='PATCH'){
      const payload=JSON.parse(init.body);writes.push(payload);
      if(options.fail) return new Response('{}',{status:500});
      Object.assign(row,payload);return new Response(JSON.stringify(options.noRow ? [] : [row]));
    }
    return new Response(JSON.stringify(options.noPrefs ? [] : [row]));
  };
  return {writes,row};
}
function post(body,extra={}) {return new Request(site+'/email-preferences',{method:'POST',headers:{cookie:'veeays_access=user_access',origin:site,'content-type':'application/x-www-form-urlencoded',...extra},body});}
test('login and same-origin guards reject missing or foreign origins before any network',async()=>{
  globalThis.fetch=()=>{throw new Error('No network');};
  const response=await emailPreferences(new Request(site+'/email-preferences'),env);
  assert.equal(response.status,303);assert.match(response.headers.get('location'),/return=%2Femail-preferences/);
  assert.equal((await emailPreferences(post('email_strong_matches=true&daily_digest=false',{origin:'https://evil.test'}),env)).status,403);
  const request=post('email_strong_matches=true&daily_digest=false');request.headers.delete('origin');
  assert.equal((await emailPreferences(request,env)).status,403);
});
test('settings page has native accessible switches, one save action and no trailing My Matches link',async()=>{
  const s=mock();const page=await emailPreferences(new Request(site+'/email-preferences',{headers:{cookie:'veeays_access=user_access'}}),env);
  const html=await page.text();assert.equal(page.status,200);
  assert.match(html,/Choose which VeeAys job updates land in your inbox/);
  assert.match(html,/90%\+ matches/);assert.match(html,/Daily · 8:00 AM/);
  assert.equal((html.match(/role="switch"/g)||[]).length,2);
  assert.match(html,/name="email_strong_matches" value="true"[^>]*checked/);
  assert.doesNotMatch(html,/name="daily_digest" value="true"[^>]*checked/);
  assert.equal((html.match(/type="submit"/g)||[]).length,1);
  assert.doesNotMatch(html,/type="radio"|<p><a href="\/matches">My Matches/);assert.equal(s.writes.length,0);
  assert.match(page.headers.get('content-security-policy'),/form-action 'self'/);assert.equal(page.headers.get('cache-control'),'no-store');
});
test('all four combined boolean states persist in one authenticated-user PATCH without touching other fields',async()=>{
  for(const strong of [false,true]) for(const digest of [false,true]) {
    const s=mock(),before=structuredClone(s.row);
    const response=await emailPreferences(post(`email_strong_matches=${strong}&daily_digest=${digest}`),env);
    assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/email-preferences?saved=1');
    assert.deepEqual(s.writes,[{email_strong_matches:strong,daily_digest:digest}]);
    assert.deepEqual(s.row,{...before,email_strong_matches:strong,daily_digest:digest});
  }
});
test('native no-JavaScript hidden/checkbox submissions persist both on and off states',async()=>{
  for(const strong of [false,true]) for(const digest of [false,true]) {
    const s=mock();const body=`email_strong_matches=false${strong ? '&email_strong_matches=true' : ''}&daily_digest=false${digest ? '&daily_digest=true' : ''}`;
    assert.equal((await emailPreferences(post(body),env)).status,303);
    assert.deepEqual(s.writes,[{email_strong_matches:strong,daily_digest:digest}]);
  }
});
test('enhanced save returns success JSON without redirect and retains all unrelated fields',async()=>{
  const s=mock(),before=structuredClone(s.row);
  const response=await emailPreferences(post('email_strong_matches=false&daily_digest=true',{accept:'application/json'}),env);
  assert.equal(response.status,200);assert.equal(response.headers.get('location'),null);
  assert.deepEqual(await response.json(),{saved:true});
  assert.deepEqual(s.writes,[{email_strong_matches:false,daily_digest:true}]);
  assert.deepEqual(s.row,{...before,email_strong_matches:false,daily_digest:true});
  assert.equal((await emailPreferences(post('email_strong_matches=false&daily_digest=true&plan=pro',{accept:'application/json'}),env)).status,400);
  assert.equal(s.writes.length,1);
});
test('reject unrelated property injection, missing fields, ambiguous duplicates and non-boolean values without writes',async()=>{
  const s=mock();
  const unrelated=['target_roles','minimum_salary_usd','salary','schedule_preferences','employment_types','experience_level','skills','industries','plan','plan_status','pro_expires_at','user_id','profile','__proto__','constructor'];
  for(const field of unrelated) assert.equal((await emailPreferences(post(`email_strong_matches=true&daily_digest=false&${field}=attacker`),env)).status,400,field);
  for(const body of ['', 'daily_digest=true','email_strong_matches=true','email_strong_matches=1&daily_digest=true',
    'email_strong_matches=true&daily_digest=null','email_strong_matches=true&daily_digest=True',
    'email_strong_matches=true&daily_digest=true&daily_digest=false',
    'email_strong_matches=false&daily_digest=false&daily_digest=false',
    'email_strong_matches=true&email_strong_matches=true&daily_digest=false'])
    assert.equal((await emailPreferences(post(body),env)).status,400,body);
  assert.equal(s.writes.length,0);
});
test('write helper independently rejects extra fields and non-boolean inputs',async()=>{
  globalThis.fetch=()=>{throw new Error('No network');};
  for(const input of [{email_strong_matches:true,daily_digest:false,plan:'pro'},
    {email_strong_matches:'true',daily_digest:false},{email_strong_matches:true},null])
    await assert.rejects(setEmailPreferences(env,'user_access',uid,input),/Invalid email preferences/);
});
test('unsupported forms and oversized bodies cannot write; save failures do not report success',async()=>{
  const s=mock();assert.equal((await emailPreferences(post('{}',{'content-type':'application/json'}),env)).status,415);
  assert.equal((await emailPreferences(post('x'.repeat(4097)),env)).status,413);assert.equal(s.writes.length,0);
  for(const option of [{fail:true},{noRow:true}]) {
    mock(option);const response=await emailPreferences(post('email_strong_matches=true&daily_digest=false'),env);
    assert.equal(response.status,503);assert.equal(response.headers.get('location'),null);
  }
});
test('saved confirmation is accessible; accounts without preferences see onboarding instead of a form',async()=>{
  mock();const page=await emailPreferences(new Request(site+'/email-preferences?saved=1',{headers:{cookie:'veeays_access=user_access'}}),env);
  assert.match(await page.text(),/role="status"[^>]*>.*Preferences saved/s);
  mock({noPrefs:true});const empty=await emailPreferences(new Request(site+'/email-preferences',{headers:{cookie:'veeays_access=user_access'}}),env);
  const html=await empty.text();assert.match(html,/Set up job preferences/);assert.doesNotMatch(html,/role="switch"/);
});
