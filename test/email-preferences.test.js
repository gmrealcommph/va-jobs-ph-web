import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {emailPreferences} from '../src/email-preferences.js';
const originalFetch=globalThis.fetch;afterEach(()=>{globalThis.fetch=originalFetch;});
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const site='https://veeays.test',uid='11111111-1111-4111-8111-111111111111';
function mock() {
  const writes=[];
  globalThis.fetch=async(input,init)=>{
    const url=new URL(input);
    assert.equal(init.headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);
    assert.equal(init.headers.Authorization,'Bearer user_access');
    if(url.pathname==='/auth/v1/user')return new Response(JSON.stringify({id:uid,email:'alex@example.com'}));
    assert.equal(url.pathname,'/rest/v1/job_preferences');assert.equal(url.searchParams.get('user_id'),'eq.'+uid);
    if(init.method==='PATCH'){writes.push(JSON.parse(init.body));return new Response(JSON.stringify([{...writes.at(-1)}]));}
    return new Response(JSON.stringify([{email_strong_matches:true,daily_digest:false}]));
  };
  return writes;
}
test('email preferences require login, preserve return path and reject cross-site POST without network',async()=>{
  globalThis.fetch=()=>{throw new Error('No network');};
  const response=await emailPreferences(new Request(site+'/email-preferences'),env);
  assert.equal(response.status,303);assert.match(response.headers.get('location'),/return=%2Femail-preferences/);
  assert.equal((await emailPreferences(new Request(site+'/email-preferences',{method:'POST',headers:{origin:'https://evil.test'}}),env)).status,403);
});

test('daily digest has its own control and patches only daily_digest for the authenticated user',async()=>{
  const writes=mock(),cookie='veeays_access=user_access';
  const page=await emailPreferences(new Request(site+'/email-preferences',{headers:{cookie}}),env);
  const html=await page.text();assert.match(html,/Daily Job Digest/);assert.match(html,/name="daily_digest" value="false" checked/);
  const response=await emailPreferences(new Request(site+'/email-preferences',{method:'POST',headers:{cookie,origin:site,
    'content-type':'application/x-www-form-urlencoded'},body:'daily_digest=true&user_id=attacker&target_roles=changed'}),env);
  assert.equal(response.status,303);assert.deepEqual(writes,[{daily_digest:true}]);
});
test('combined, duplicate and invalid preferences are rejected without patching',async()=>{
  const writes=mock(),cookie='veeays_access=user_access';
  for(const body of ['daily_digest=true&email_strong_matches=false','daily_digest=true&daily_digest=false','daily_digest=1','plan=pro']) {
    const response=await emailPreferences(new Request(site+'/email-preferences',{method:'POST',headers:{cookie,origin:site,
      'content-type':'application/x-www-form-urlencoded'},body}),env);
    assert.equal(response.status,400);
  }
  assert.equal(writes.length,0);
});
test('authenticated page shows current preference; POST patches only alert preference for session user',async()=>{
  const writes=mock();const cookie='veeays_access=user_access';
  const page=await emailPreferences(new Request(site+'/email-preferences',{headers:{cookie}}),env);
  assert.equal(page.status,200);assert.match(await page.text(),/value="true" checked/);assert.equal(writes.length,0);
  const response=await emailPreferences(new Request(site+'/email-preferences',{method:'POST',headers:{cookie,origin:site,'content-type':'application/x-www-form-urlencoded'},body:'email_strong_matches=false&user_id=attacker&plan=pro'}),env);
  assert.equal(response.status,303);assert.deepEqual(writes,[{email_strong_matches:false}]);
});
