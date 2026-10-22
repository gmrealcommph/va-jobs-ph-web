import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resumeEndpoint} from '../src/resume-studio.js';
import {layout} from '../src/render.js';
const env={RESUME_STUDIO_ENABLED:'true',RESUME_AI_ENABLED:'false'};
const forbidden={session(){throw Error('Anonymous editor must not access accounts');},profile(){throw Error('Anonymous editor must not read profiles');},send(){throw Error('AI disabled');}};
test('public editor allows anonymous session lookup for navigation without profile or AI access',async()=>{
 const r=await resumeEndpoint(new Request('https://veeays.com/resume-studio'),env,{...forbidden,session:async()=>({user:null})});assert.equal(r.status,200);const html=await r.text();
 for(const text of ['Free for everyone','id="resume-form"','id="export"','id="export-word"','id="ai-tools" hidden','Better Jobs. From Home.','All twelve designs support an optional photo.'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/₱499|Pro workspace|VEEAYS PRO ·/);assert.match(html,/rel="canonical"\s+href="https:\/\/veeays.com\/resume-studio"/);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.ok(r.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
});
test('disabled AI rejects even a direct request without account/provider access',async()=>{
 const r=await resumeEndpoint(new Request('https://veeays.com/api/resume/review',{method:'POST',headers:{origin:'https://veeays.com','content-type':'application/json'},body:JSON.stringify({consent:true,text:'A résumé with enough text to request a review.'})}),env,forbidden);assert.equal(r.status,503);
});
test('shared navigation exposes the public editor and marks it current',()=>{const html=layout({title:'Résumé',canonical:'https://veeays.com/resume-studio',body:''});assert.match(html,/href="\/resume-studio" aria-current="page"/);});
test('launch config keeps resume AI off; only the independent activity counter adds storage',()=>{const c=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));assert.equal(c.vars.RESUME_STUDIO_ENABLED,'true');assert.equal(c.vars.RESUME_AI_ENABLED,'false');assert.deepEqual(c.migrations,[{tag:'active-visitors-v1',new_sqlite_classes:['ActiveVisitors']}]);assert.deepEqual(c.durable_objects.bindings,[{name:'ACTIVE_VISITORS',class_name:'ActiveVisitors'}]);});
