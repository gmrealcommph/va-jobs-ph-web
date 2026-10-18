import test from 'node:test';
import assert from 'node:assert/strict';
import {adminMembersEndpoint} from '../src/admin-members.js';
import {signIn} from '../src/auth.js';
import {memberChallenge} from '../public/admin-members.js';
import {adminEndpoint} from '../src/admin.js';
const actor='10000000-0000-4000-8000-000000000001',target='10000000-0000-4000-8000-000000000002';
const env={SITE_URL:'https://veeays.com',ADMIN_MEMBER_ACTIONS_ENABLED:'true'};
let sequence=0;
function setup(){
 const token=`20000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`,calls=[];
 const owner=actor.slice(0,-4)+String(sequence).padStart(4,'0');
 const deps={session:async()=>({user:{id:owner,email:'admin@example.invalid'},accessToken:'current'}),call:async(e,t,n,b,service)=>{calls.push({n,b,service,t});return n==='veeays_admin_access'?true:n==='veeays_admin_members'?{members:[{id:target}]}:b.p_action==='delete'?{checkouts:[{checkout_id:'cs_test'}]}:{ok:true};},verify:async()=>({response:{ok:true},data:{user:{id:owner},access_token:'fresh'}}),close:async()=>{calls.push({n:'close'});},logout:async()=>{calls.push({n:'logout'});}};
 const body={id:target,token,action:'delete',confirm:'DELETE '+target,password:'password',reason:'Manual review completed'};
 const req=(changes={},headers={})=>new Request('https://veeays.com/admin/api/members',{method:'POST',headers:{origin:'https://veeays.com','content-type':'application/json',cookie:`__Host-veeays_member=${owner}.${target}.${token}`,...headers},body:JSON.stringify({...body,...changes})});
 return {calls,deps,req};
}
test('anonymous and ordinary members are denied before member queries',async()=>{
 for(const anonymous of [true,false]){const {calls,deps}=setup();if(anonymous)deps.session=async()=>({});else deps.call=async()=>false;const response=await adminMembersEndpoint(new Request('https://veeays.com/admin/api/members'),env,deps);assert.equal(response.status,anonymous?401:403);assert.equal(calls.length,0);}
});
test('CAPTCHA configuration is returned only after admin authorization',async()=>{
 const {deps}=setup();const response=await adminMembersEndpoint(new Request('https://veeays.com/admin/api/members'),{...env,AUTH_CAPTCHA_ENABLED:'true',TURNSTILE_SITE_KEY:'public-site-key'},deps);
 assert.deepEqual((await response.json()).captcha,{required:true,site_key:'public-site-key'});
});
test('required CAPTCHA rejects missing, malformed and oversized tokens before password verification',async()=>{
 for(const captchaToken of [undefined,'',' ',123,{},'x'.repeat(2049)]){const {deps,req,calls}=setup();deps.verify=()=>assert.fail('No password attempt');assert.equal((await adminMembersEndpoint(req({captchaToken}),{...env,AUTH_CAPTCHA_ENABLED:'true',TURNSTILE_SITE_KEY:'public'},deps)).status,400);assert.equal(calls.filter(c=>c.service).length,0);}
 const {deps,req}=setup();deps.verify=()=>assert.fail();assert.equal((await adminMembersEndpoint(req(),{...env,AUTH_CAPTCHA_ENABLED:'true'},deps)).status,503);
});
test('valid CAPTCHA is forwarded to password reauthentication; provider rejection blocks actions',async()=>{
 for(const accepted of [true,false]){const {deps,req,calls}=setup();const verify=deps.verify;deps.verify=async(e,credentials)=>{assert.equal(credentials.captchaToken,'single-use-token');return accepted?verify():{response:{ok:false},data:{}};};
 assert.equal((await adminMembersEndpoint(req({captchaToken:'single-use-token'}),{...env,AUTH_CAPTCHA_ENABLED:'true',TURNSTILE_SITE_KEY:'public'},deps)).status,accepted?200:403);if(!accepted)assert.equal(calls.filter(c=>c.service).length,0);}
});
test('actual Supabase password transport sends CAPTCHA once without siteverify or session cookies',async()=>{
 const {deps,req,calls}=setup(),state=await deps.session(),original=globalThis.fetch;let count=0;
 try{globalThis.fetch=async(url,init)=>{count++;assert.equal(new URL(url).pathname,'/auth/v1/token');assert.equal(new URL(url).search,'?grant_type=password');const body=JSON.parse(init.body);assert.deepEqual(body.gotrue_meta_security,{captcha_token:'provider-token'});return Response.json({user:state.user,access_token:'temporary'});};deps.verify=signIn;
 const response=await adminMembersEndpoint(req({captchaToken:'provider-token'}),{...env,AUTH_CAPTCHA_ENABLED:'true',TURNSTILE_SITE_KEY:'public',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'},deps);
 assert.equal(response.status,200);assert.equal(count,1);assert.doesNotMatch(response.headers.get('set-cookie')||'',/veeays_access|veeays_refresh/);assert.ok(calls.some(c=>c.n==='logout'));
 }finally{globalThis.fetch=original;}
});
test('newly verified MFA and revoked fresh admin access fail closed and clean temporary sessions',async()=>{
 for(const mode of ['mfa','revoked','outage']){const {deps,req,calls}=setup(),verify=deps.verify,call=deps.call;deps.verify=async()=>{const fresh=await verify();if(mode==='mfa')fresh.data.user.factors=[{status:'verified'}];return fresh;};deps.call=async(e,t,...args)=>{if(t==='fresh'&&mode!=='mfa'){if(mode==='outage')throw Error('Unavailable');return false;}return call(e,t,...args);};
 assert.ok((await adminMembersEndpoint(req(),env,deps)).status>=400);assert.equal(calls.filter(c=>c.service).length,0);assert.ok(calls.some(c=>c.n==='logout'));}
});
test('challenge expiry, failure, retry and removal erase tokens and disable submit',()=>{
 let options,resets=0,removes=0;const api={render:(host,o)=>{options=o;return 0;},reset:id=>{assert.equal(id,0);resets++;},remove:id=>{assert.equal(id,0);removes++;}},send={};
 const challenge=memberChallenge(api,{},'public-site-key',send);assert.equal(send.disabled,true);
 for(const event of ['expired-callback','error-callback','timeout-callback']){options.callback('token');assert.equal(challenge.token(),'token');assert.equal(send.disabled,false);options[event]();assert.equal(challenge.token(),'');assert.equal(send.disabled,true);}
 options.callback('token');challenge.reset();assert.equal(challenge.token(),'');assert.equal(resets,1);options.callback('token');challenge.remove();assert.equal(challenge.token(),'');assert.equal(removes,1);
});
test('admin CSP permits Turnstile only for enabled action pages',async()=>{
 for(const enabled of ['false','true']){const {deps}=setup();const response=await adminEndpoint(new Request('https://veeays.com/admin'),{...env,ADMIN_MEMBER_ACTIONS_ENABLED:enabled,TURNSTILE_SITE_KEY:'public'},deps);assert.equal(response.status,200);assert.equal(response.headers.get('content-security-policy').includes('https://challenges.cloudflare.com'),enabled==='true');}
});
test('actions stay disabled until explicitly enabled',async()=>{const {deps,req,calls}=setup();assert.equal((await adminMembersEndpoint(req(),{},deps)).status,409);assert.equal(calls.filter(c=>c.service).length,0);});
test('CSRF, target binding, typed confirmation and reason are enforced before password verification',async()=>{
 for(const [changes,headers] of [[{},{origin:'https://evil.invalid'}],[{id:actor},{}],[{confirm:'DELETE'},{}],[{reason:'x'},{}],[{action:'purge'},{}]]){const {deps,req,calls}=setup();deps.verify=()=>assert.fail();assert.ok((await adminMembersEndpoint(req(changes,headers),env,deps)).status>=400);assert.equal(calls.filter(c=>c.service).length,0);}
});
test('password mismatch and MFA fail closed; temporary password sessions are cleaned',async()=>{
 for(const mfa of [true,false]){const {deps,req,calls}=setup();if(mfa){const state=await deps.session();deps.session=async()=>({...state,user:{...state.user,factors:[{status:'verified'}]}});}else deps.verify=async()=>({response:{ok:true},data:{user:{id:target},access_token:'fresh'}});assert.ok((await adminMembersEndpoint(req(),env,deps)).status>=400);assert.equal(calls.filter(c=>c.service).length,0);if(!mfa)assert.ok(calls.some(c=>c.n==='logout'));}
});
test('deletion closes checkouts before receipt-preserving finalization; provider failure stops finalization',async()=>{
 for(const fail of [false,true]){const {deps,req,calls}=setup();if(fail)deps.close=async()=>{throw Error('Provider unavailable');};const response=await adminMembersEndpoint(req(),env,deps);assert.equal(response.status,fail?503:200);const actions=calls.filter(c=>c.service);assert.equal(actions[0].b.p_action,'delete');assert.equal(actions.length,fail?1:2);if(!fail){assert.equal(actions[1].b.p_action,'finish_delete');assert.ok(calls.findIndex(c=>c.n==='close')<calls.findIndex(c=>c.b?.p_action==='finish_delete'));}assert.ok(calls.some(c=>c.n==='logout'));}
});
