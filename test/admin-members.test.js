import test from 'node:test';
import assert from 'node:assert/strict';
import {adminMembersEndpoint} from '../src/admin-members.js';
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
