import test from 'node:test';
import assert from 'node:assert/strict';
import {getUser,sessionForRequest} from '../src/auth.js';
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',ADMIN_MEMBER_ACTIONS_ENABLED:'true'};
test('production ban checks reject infinity/future bans and accept expired bans',async()=>{
 const original=globalThis.fetch;
 try{for(const [banned_until,allowed] of [['infinity',false],['2999-01-01T00:00:00Z',false],['2000-01-01T00:00:00Z',true],[null,true]]){
  globalThis.fetch=async url=>Response.json(new URL(url).pathname.includes('/rpc/')?true:{id:'member',banned_until});
  assert.equal(Boolean(await getUser(env,'token')),allowed);
 }}finally{globalThis.fetch=original;}
});
test('refresh response user cannot bypass active-member RPC or ban check',async()=>{
 const original=globalThis.fetch;let checks=0;
 try{
  globalThis.fetch=async url=>{
   const path=new URL(url).pathname;
   if(path.includes('/token'))return Response.json({access_token:'fresh',refresh_token:'refresh',user:{id:'member'}});
   if(path.includes('/rpc/')){checks++;return Response.json(true);}
   return Response.json({id:'member',banned_until:'infinity'});
  };
  const state=await sessionForRequest(new Request('https://veeays.com/admin',{headers:{cookie:'veeays_refresh=refresh'}}),env);
  assert.equal(state.user,null);assert.equal(state.refreshed,false);assert.equal(state.accessToken,null);assert.equal(checks,1);
 }finally{globalThis.fetch=original;}
});
