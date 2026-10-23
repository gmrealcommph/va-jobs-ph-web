import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
const env={SITE_URL:'https://veeays.test',SUPABASE_URL:'https://fixture.test',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const original=globalThis.fetch;afterEach(()=>globalThis.fetch=original);
test('deployed export preserves form-compatible referrer policy after analytics wrapping',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Unexpected auth request');};
 for(const path of ['/signup','/login','/forgot-password','/auth/resend']){const r=await worker.fetch(new Request(env.SITE_URL+path),env);assert.equal(r.status,200);assert.equal(r.headers.get('referrer-policy'),path.startsWith('/auth/')||path==='/forgot-password'?'same-origin':'strict-origin-when-cross-origin',path);assert.match(r.headers.get('content-security-policy'),/form-action 'self'/);assert.doesNotMatch(r.headers.get('content-security-policy'),/googletagmanager|google-analytics/);assert.doesNotMatch(await r.text(),/src="\/(?:analytics|traffic)\.js/);}
 assert.equal(calls,0);
});
test('same-origin signup and login reach validation; null and cross-origin remain forbidden before auth',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Unexpected auth request');};
 for(const path of ['/signup','/login'])for(const origin of [env.SITE_URL,'null','https://attacker.test']){const r=await worker.fetch(new Request(env.SITE_URL+path,{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:''}),env);assert.equal(r.status,origin===env.SITE_URL?303:403,path+' '+origin);if(origin===env.SITE_URL)assert.match(r.headers.get('location'),/Enter%20a%20valid%20email/);else assert.equal(await r.text(),'Forbidden');}
 assert.equal(calls,0);
});
