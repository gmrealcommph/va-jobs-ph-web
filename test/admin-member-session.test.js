import test from 'node:test';
import assert from 'node:assert/strict';
import {getUser,sessionForRequest} from '../src/auth.js';
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',ADMIN_MEMBER_ACTIONS_ENABLED:'true'};
test('enabled member guard rejects banned JWTs and fails closed on guard outage, including refresh',async()=>{
 const original=globalThis.fetch;
 try{for(const active of [true,false,'outage']){
  globalThis.fetch=async(url,init)=>new URL(url).pathname.includes('/rpc/')?Response.json(active==='outage'?{}:active,{status:active==='outage'?503:200}):Response.json({id:'member'});
  if(active==='outage')await assert.rejects(()=>getUser(env,'valid-jwt'));
  else assert.equal((await getUser(env,'valid-jwt'))?.id,active?'member':undefined);
 }
 let guard=0;
 globalThis.fetch=async(url,init)=>{
  const path=new URL(url).pathname;
  if(path.includes('/rpc/')){guard++;return Response.json(false);}
  if(path.includes('/token'))return Response.json({user:{id:'member'},access_token:'fresh',refresh_token:'fresh-refresh'});
  return Response.json({id:'member'});
 };
 const state=await sessionForRequest(new Request('https://veeays.com/admin',{headers:{cookie:'veeays_access=old; veeays_refresh=refresh'}}),env);
 assert.equal(state.user,null);assert.equal(guard,2);
 }finally{globalThis.fetch=original;}
});
