import {test, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../src/worker.js';

const env = {SITE_URL:'https://veeays.test', SUPABASE_URL:'https://fixture.example', SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; });
const now = () => Math.floor(Date.now() / 1000);
const claims = () => ({sub:'member', exp:now()+3600, amr:[{method:'recovery', timestamp:now()-10}]});
const token = value => `e30.${Buffer.from(JSON.stringify(value)).toString('base64url')}.fixture-signature`;
function request(method, access, extra={}) {
  return new Request(env.SITE_URL+'/reset-password?type=recovery', {
    method, headers:{cookie:`veeays_access=${access}`, origin:env.SITE_URL, 'content-type':'application/x-www-form-urlencoded', ...extra},
    ...(method === 'POST' ? {body:'password=new-password&type=recovery'} : {})
  });
}
function mock({valid=true, refreshed=null, updateStatus=200}={}) {
  const writes=[];
  globalThis.fetch=async (input, init) => {
    const url=new URL(input);
    if(url.pathname === '/auth/v1/token' && refreshed) return Response.json(refreshed);
    assert.equal(url.pathname, '/auth/v1/user');
    if(init.method === 'PUT') {
      writes.push(init);
      return Response.json({}, {status:updateStatus});
    }
    return Response.json(valid ? {id:'member'} : {}, {status:valid ? 200 : 401});
  };
  return writes;
}

test('reset GET, HEAD and POST reject ordinary, malformed, stale and mismatched sessions', async () => {
  const writes=mock();
  const base=claims();
  for(const value of [
    {...base, amr:[{method:'password', timestamp:now()}]},
    {...base, amr:[{method:'otp', timestamp:now()}]},
    {...base, amr:undefined, user_metadata:{type:'recovery'}},
    {...base, amr:{method:'recovery', timestamp:now()}},
    {...base, amr:[{method:'recovery', timestamp:now()-901}]},
    {...base, amr:[{method:'recovery', timestamp:now()+60}]},
    {...base, amr:[{method:'recovery', timestamp:String(now())}]},
    {...base, exp:now()-1}, {...base, sub:'another-member'}, null
  ]) {
    for(const method of ['GET','HEAD','POST']) {
      const response=await handle(request(method, token(value)), env);
      assert.equal(response.status, 401);
      assert.doesNotMatch(await response.text(), /name="password"/);
    }
  }
  assert.equal((await handle(request('POST', 'malformed'), env)).status, 401);
  assert.equal(writes.length, 0);
});

test('forged recovery claims cannot bypass Supabase token validation', async () => {
  const writes=mock({valid:false});
  assert.equal((await handle(request('POST', token(claims())), env)).status, 401);
  assert.equal(writes.length, 0);
});

test('validated recent recovery session renders form and updates password with the same token', async () => {
  const writes=mock();
  const access=token(claims());
  const get=await handle(request('GET', access), env);
  assert.equal(get.status, 200);
  assert.match(await get.text(), /name="password"/);
  const post=await handle(request('POST', access), env);
  assert.equal(post.status, 200);
  assert.match(await post.text(), /Your new password is saved/);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].headers.Authorization, `Bearer ${access}`);
  assert.deepEqual(JSON.parse(writes[0].body), {password:'new-password'});
});

test('refreshed sessions must still carry a recent recovery claim and persist rotated cookies', async () => {
  for(const method of ['password','recovery']) {
    const access=token({...claims(), amr:[{method, timestamp:now()-10}]});
    const writes=mock({valid:false, refreshed:{access_token:access, refresh_token:'rotated', user:{id:'member'}}});
    const response=await handle(request('POST','expired', {cookie:'veeays_refresh=saved'}), env);
    assert.equal(response.status, method === 'recovery' ? 200 : 401);
    assert.equal(writes.length, method === 'recovery' ? 1 : 0);
    if(method === 'recovery') assert.ok(response.headers.getSetCookie().some(c=>c.startsWith('veeays_refresh=rotated;')));
  }
});

test('recovery password submission still rejects cross-origin requests and upstream failure', async () => {
  const writes=mock({updateStatus:400});
  const access=token(claims());
  assert.equal((await handle(request('POST', access, {origin:'https://other.test'}), env)).status, 403);
  assert.equal(writes.length, 0);
  const response=await handle(request('POST', access), env);
  assert.equal(response.status, 400);
  assert.doesNotMatch(await response.text(), /Your new password is saved/);
});
