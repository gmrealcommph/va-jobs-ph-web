import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { handle } from '../src/worker.js';
import { discoveryCard } from '../src/render.js';
const originalFetch=globalThis.fetch;
afterEach(()=>globalThis.fetch=originalFetch);
test('save and unsave reuse existing persistence; JSON has no navigation, native form retains redirect',async()=>{
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SITE_URL:'https://veeays.test'};
 const mutations=[];
 globalThis.fetch=async(input,options)=>{const url=new URL(input);if(url.pathname==='/auth/v1/user') return Response.json({id:'u'});mutations.push(options.method);return new Response(null,{status:204});};
 for(const [path,saved] of [['/save-job',true],['/unsave-job',false]]){
 const res=await handle(new Request(env.SITE_URL+path,{method:'POST',headers:{cookie:'veeays_access=token',accept:'application/json',origin:env.SITE_URL},body:new URLSearchParams({job_id:'101',return_to:'/#opportunities'})}),env);
 assert.equal(res.status,200);assert.equal(res.headers.get('location'),null);assert.deepEqual(await res.json(),{saved});}
 assert.deepEqual(mutations,['POST','DELETE']);
 const res=await handle(new Request(env.SITE_URL+'/save-job',{method:'POST',headers:{cookie:'veeays_access=token',origin:env.SITE_URL},body:new URLSearchParams({job_id:'101',return_to:'/jobs/101'})}),env);
 assert.equal(res.status,303);assert.equal(res.headers.get('location'),'/jobs/101');
 const anon=await handle(new Request(env.SITE_URL+'/save-job',{method:'POST',headers:{accept:'application/json',origin:env.SITE_URL},body:new URLSearchParams({job_id:'101'})}),env);assert.equal(anon.status,401);
});
test('native button and links remain independent and keyboard accessible',()=>{
 const html=discoveryCard({id:101,title:'Assistant'},{user:{id:'u'}});
 assert.match(html,/type="submit" aria-pressed="false" aria-label="Save Assistant"/);
 assert.match(html,/role="status" aria-live="polite"/);
 assert.equal((html.match(/href="\/jobs\/101"/g)||[]).length,2);
 assert.doesNotMatch(html,/<a[^>]*>(?:(?!<\/a>)[\s\S])*<form/);
 assert.match(discoveryCard({id:101,title:'Assistant'}),/signup\?return=%2Fjobs%2F101%3Fsave%3D1/);
});
test('click and keyboard propagation stop; submit toggles twice without navigation and keeps state on error',async()=>{
 const handlers={},actionHandlers={},attrs={'aria-label':'Save Assistant'},messages=[];
 const status={set textContent(v){messages.push(v)}};
 const button={disabled:false,getAttribute:k=>attrs[k],setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],classList:{toggle:(k,v)=>attrs[k]=v},replaceChildren(){},append(...args){attrs.content=args;}};
 const form={action:'/save-job',elements:{job_id:{value:'101'}},querySelector:s=>s==='button'?button:status,addEventListener:(k,v)=>handlers[k]=v,setAttribute:(k,v)=>form[k]=v};
 let saved=true,fail=false;
 const context={document:{querySelector:()=>null,querySelectorAll:s=>s.includes('form')?[form]:[{addEventListener:(k,v)=>actionHandlers[k]=v}],createElement:()=>({setAttribute(){}})},FormData:class{},fetch:async()=>({status:200,ok:!fail,json:async()=>fail?{error:'Try again'}:{saved}}),window:{location:{assign(){throw Error('unexpected navigation')}}}};
 vm.runInNewContext(fs.readFileSync(new URL('../public/home-discovery.js',import.meta.url),'utf8'),context);
 for(const key of ['click','keydown']){let stopped=false;actionHandlers[key]({stopPropagation(){stopped=true}});assert.ok(stopped);}
 const event=()=>({preventDefault(){},stopPropagation(){}});
 await handlers.submit(event());assert.equal(form.action,'/unsave-job');assert.equal(attrs['aria-pressed'],'true');assert.equal(messages.at(-1),'Saved to My Jobs.');
 saved=false;await handlers.submit(event());assert.equal(form.action,'/save-job');assert.equal(attrs['aria-pressed'],'false');assert.equal(messages.at(-1),'Removed from My Jobs.');
 fail=true;await handlers.submit(event());assert.equal(form.action,'/save-job');assert.equal(messages.at(-1),'Try again');assert.equal(button.disabled,false);
});

