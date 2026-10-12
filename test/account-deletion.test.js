import assert from 'node:assert/strict';
import {accountDeletionEndpoint,closeDeletionCheckout} from '../src/account-deletion.js';
const original=globalThis.fetch;
const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const env={SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic',SUPABASE_SERVICE_ROLE_KEY:'test-server-key',SITE_URL:'https://veeays.com',PAYMONGO_TEST_SECRET_KEY:'sk_test_synthetic'};
let calls=[],mode='success',expired=false;
globalThis.fetch=async(url,opts={})=>{
 const path=new URL(url).pathname;calls.push({path,opts});
 if(path==='/auth/v1/user')return Response.json({id,email:'synthetic@example.invalid',...(mode==='mfa'?{factors:[{status:'verified'}]}:{})});
 if(path==='/rest/v1/profiles')return mode==='profile-failure'?Response.json({},{status:503}):Response.json([{id,plan:mode==='pro'?'pro':'free',plan_status:'active',pro_expires_at:null}]);
 if(path==='/auth/v1/token')return Response.json(mode==='wrong-password'?{}:{user:{id:mode==='wrong-id'?other:id},access_token:'fresh',refresh_token:'fresh-refresh'},{status:mode==='wrong-password'?400:200});
 if(path==='/auth/v1/logout')return new Response(null,{status:204});
 if(path==='/rest/v1/rpc/prepare_account_deletion')return Response.json({checkouts:mode==='provider-failure'?[{checkout_id:'cs_synthetic',livemode:false}]:[]});
 if(path==='/rest/v1/rpc/finish_account_deletion')return Response.json(mode==='sql-failure'?{}:{deleted:true},{status:mode==='sql-failure'?503:200});
 if(path.includes('/checkout_sessions/')){
   if(mode==='provider-failure')return Response.json({},{status:503});
   if(path.endsWith('/expire'))expired=true;
   return Response.json({data:{id:'cs_synthetic',attributes:{livemode:false,status:expired?'expired':'active'}}});
 }
 throw Error('Unexpected network request '+path);
};
const reset=()=>{calls=[];mode='success';expired=false;};
const get=()=>accountDeletionEndpoint(new Request('https://veeays.com/account/delete',{headers:{cookie:'veeays_access=existing'}}),env);
const first=await get();assert.equal(first.status,200);assert.match(first.headers.get('set-cookie'),/__Host-veeays_delete=.*HttpOnly/);
const html=await first.text();assert.match(html,/<dialog/);assert.match(html,/Current password/);assert.match(html,/financial receipts/);
assert.match(html,/<details class="deletion-details"><summary>What happens to my data\?<\/summary>/);
assert.ok(!html.includes('Your Pro access will end immediately.'));
mode='pro';const proHtml=await (await get()).text();assert.match(proHtml,/Your Pro access will end immediately/);
mode='profile-failure';assert.equal((await get()).status,503);mode='success';
const configured=await accountDeletionEndpoint(new Request('https://veeays.com/account/delete',{headers:{cookie:'veeays_access=existing'}}),{...env,FINANCIAL_RETENTION_YEARS:'7',DISPUTE_RETENTION_MONTHS:'18'});
const configuredHtml=await configured.text();assert.match(configuredHtml,/7 years/);assert.match(configuredHtml,/18 months/);assert.match(configuredHtml,/Automatic purging remains disabled/);
const token=html.match(/name="token" value="([^"]+)"/)[1];
const post=(options={})=>accountDeletionEndpoint(new Request('https://veeays.com/account/delete',{method:'POST',headers:{origin:'https://veeays.com','content-type':'application/x-www-form-urlencoded',cookie:`veeays_access=existing; __Host-veeays_delete=${id}.${token}`,...options.headers},body:new URLSearchParams({token,password:'synthetic-password',confirm:'DELETE',user_id:other,...options.form})}),env);
for(const options of [{headers:{origin:'https://evil.invalid'}},{headers:{origin:''}},{form:{token:'00000000-0000-4000-8000-000000000099'}},{form:{confirm:'delete'}}]){
 reset();assert.ok((await post(options)).status>=400);assert.ok(!calls.some(x=>x.path.includes('/rpc/')));
}
for(const failure of ['wrong-password','wrong-id','mfa']){reset();mode=failure;assert.ok((await post()).status>=400);assert.ok(!calls.some(x=>x.path.includes('/rpc/')));}
reset();const result=await post();assert.equal(result.status,303);assert.equal(result.headers.get('location'),'/account/deleted');assert.match(result.headers.get('set-cookie'),/veeays_access=;.*Max-Age=0/);
assert.deepEqual(JSON.parse(calls.find(x=>x.path.endsWith('finish_account_deletion')).opts.body),{p_user_id:id});
reset();mode='provider-failure';assert.equal((await post()).status,503);assert.ok(!calls.some(x=>x.path.endsWith('finish_account_deletion')));
reset();mode='sql-failure';assert.equal((await post()).status,503);assert.ok(calls.some(x=>x.path==='/auth/v1/logout'));
reset();await closeDeletionCheckout(env,{checkout_id:'cs_synthetic',livemode:false});assert.equal(expired,true);assert.ok(calls.some(x=>x.path.endsWith('/expire')&&x.opts.method==='POST'));
reset();await closeDeletionCheckout(env,{checkout_id:'cs_synthetic',livemode:false});await closeDeletionCheckout(env,{checkout_id:'cs_synthetic',livemode:false});assert.equal(calls.filter(x=>x.path.endsWith('/expire')).length,1);
await assert.rejects(()=>closeDeletionCheckout(env,{checkout_id:'cs_synthetic',livemode:true}));
globalThis.fetch=original;
console.log('PASS HTTP: password, identity, MFA safeguard, CSRF, typed confirmation, forged target ignored, checkout failure stops deletion, SQL failure retry, cookie clearing, temporary-session cleanup, provider closure and repeat closure, test/live key isolation');
