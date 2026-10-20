import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {signUp,signIn} from '../src/auth.js';
const m={default:worker,signUp,signIn};
let calls=[];const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',TURNSTILE_SITE_KEY:'site-key',SITE_URL:'https://veeays.com'};
globalThis.fetch=async(url,init={})=>{calls.push({url:String(url),init});return new Response(JSON.stringify({}),{status:200,headers:{'content-type':'application/json'}})};
await m.signUp(env,{email:'unused@example.invalid',password:'long-password',fullName:'Unused',redirectTo:'https://veeays.com/auth/callback',captchaToken:'test-token'});assert.equal(JSON.parse(calls.at(-1).init.body).gotrue_meta_security.captcha_token,'test-token');
await m.signIn(env,{email:'unused@example.invalid',password:'long-password',captchaToken:'login-token'});assert.equal(JSON.parse(calls.at(-1).init.body).gotrue_meta_security.captcha_token,'login-token');
for(const path of ['/signup','/login']){const r=await m.default.fetch(new Request('https://veeays.com'+path),env);assert.equal(r.status,200);const html=await r.text();assert.match(html,/cf-turnstile/);assert.match(r.headers.get('content-security-policy'),/frame-src https:\/\/challenges.cloudflare.com/);assert.equal(r.headers.get('cache-control'),'no-store');}
for(const token of [null,'valid-token']){calls=[];const form=new URLSearchParams({email:'unused@example.invalid',password:'long-password',full_name:'Unused'});if(token)form.set('cf-turnstile-response',token);const r=await m.default.fetch(new Request('https://veeays.com/signup',{method:'POST',headers:{origin:'https://veeays.com','content-type':'application/x-www-form-urlencoded'},body:form}),env);assert.equal(r.status,303);if(token){assert.match(r.headers.get('location'),/check-email/);assert.equal(JSON.parse(calls.find(c=>c.url.includes('/auth/v1/signup')).init.body).gotrue_meta_security.captcha_token,token);}else{assert.match(r.headers.get('location'),/security%20check/);assert.equal(calls.filter(c=>c.url.includes('/auth/v1/signup')).length,0);}}
console.log('CAPTCHA signup/login integration checks passed; no live network calls');
