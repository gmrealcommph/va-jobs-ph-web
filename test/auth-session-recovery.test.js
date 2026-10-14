import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionForRequest,setSessionCookies} from '../src/auth.js';
import {handle} from '../src/worker.js';
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',SITE_URL:'https://veeays.com'};
const request=path=>new Request('https://veeays.com'+path,{headers:{cookie:'veeays_refresh=saved-session'}});
test('saved refresh cookie restores login after access cookie expires; redirects persist rotated cookies',async()=>{
 const before=globalThis.fetch;
 globalThis.fetch=async input=>{
  const url=new URL(input);
  if(url.pathname==='/auth/v1/token')return Response.json({access_token:'renewed-access',refresh_token:'renewed-refresh',expires_in:3600,user:{id:'fixture-user',email_confirmed_at:'2026-10-01T00:00:00Z'}});
  if(url.pathname==='/rest/v1/profiles')return Response.json([]);
  throw new Error('Unexpected request '+url.pathname);
 };
 try{for(const path of ['/login?return=/admin','/check-email?return=/admin','/signup?return=/admin']){
  const response=await handle(request(path),env);assert.equal(response.status,303,path);assert.equal(response.headers.get('location'),'https://veeays.com/admin');
  const cookies=response.headers.getSetCookie();assert.ok(cookies.some(c=>c.startsWith('veeays_refresh=renewed-refresh;')&&c.includes('Max-Age=2592000')));assert.ok(cookies.every(c=>c.includes('HttpOnly; Secure; SameSite=Lax')));
 }}finally{globalThis.fetch=before;}
});
test('temporary refresh failure preserves saved session instead of declaring it invalid',async()=>{
 const before=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:'temporary'}, {status:503});
 try{await assert.rejects(sessionForRequest(request('/admin'),env),/temporarily unavailable/);}finally{globalThis.fetch=before;}
});
test('invalid refresh credentials still fail closed',async()=>{
 const before=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:'invalid'}, {status:400});
 try{const state=await sessionForRequest(request('/admin'),env);assert.equal(state.user,null);assert.equal(state.refreshed,false);}finally{globalThis.fetch=before;}
});
