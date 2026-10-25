import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import live from '../src/production-baseline/20261024/production-entry.js';
import candidate,* as exposed from '../dist/resume-release/resume-release-entry.js';
import candidateProduction,* as originalExports from '../dist/resume-release/production-entry.js';
import {studioBody} from '../src/resume-release/studio-view.js';
import {proToolsPanel} from '../src/production-baseline/20261024/pro-tools-ui.js';
const manifest=JSON.parse(await fs.readFile('docs/resume-release/baseline.json','utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');

test('all seven vendored production modules match the deployed source hashes',async()=>{
 for(const m of manifest.modules)assert.equal(hash(await fs.readFile('src/production-baseline/20261024/'+m.name)),m.sha256,m.name);
});
test('the candidate preserves six live modules exactly and changes only the studio import in the seventh',async()=>{
 for(const m of manifest.modules){const source=await fs.readFile('src/production-baseline/20261024/'+m.name,'utf8');const output=await fs.readFile('dist/resume-release/'+m.name,'utf8');assert.equal(output,m.name==='reviewed-live.js'?source.replace("import {studioBody} from './polished-studio.js';","import {studioBody} from './resume-release-view.js';"):source,m.name);}
});
test('all approved template browser assets are byte-identical to the staging candidate',async()=>{
 for(const[name,sha]of Object.entries(manifest.reviewedBrowserFiles))assert.equal(hash(await fs.readFile('src/resume-release/browser/'+name)),sha,name);
});
test('scheduled behavior and Durable Object exports are retained',()=>{
 assert.equal(candidate.scheduled,candidateProduction.scheduled);
 for(const name of Object.keys(originalExports).filter(k=>k!=='default'))assert.equal(exposed[name],originalExports[name],name);
});
test('release metadata retains existing bindings/assets and makes no migrations or schedule changes',async()=>{
 const m=JSON.parse(await fs.readFile('dist/resume-release/metadata.json','utf8'));assert.equal(m.keep_assets,true);assert.deepEqual(m.keep_bindings,[...new Set(manifest.bindings.map(b=>b.type))]);assert.equal(m.compatibility_date,manifest.compatibilityDate);assert.deepEqual(m.compatibility_flags,manifest.compatibilityFlags);for(const key of ['bindings','assets','migrations','triggers','routes'])assert.equal(m[key],undefined,key);
});
test('the studio view retains the exact live Pro panel and consent controls for every option combination',()=>{
 for(const aiEnabled of [false,true])for(const proEnabled of [false,true])for(const proDemo of [false,true]){const body=studioBody({aiEnabled,proEnabled,proDemo});if(proEnabled)assert.ok(body.includes(proToolsPanel({enabled:true,demo:proDemo})));else assert.ok(!body.includes('id="pro-tools"'));assert.ok(body.includes('id="ai-consent"'));assert.ok(body.includes('/resume-studio-v3.js'));assert.ok(body.includes('/resume-studio-v3.css'));}
});
test('unrelated routes return identical live/candidate responses without any external call',async()=>{
 const oldFetch=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Network disabled in regression test');};
 const env={RESUME_STUDIO_ENABLED:'true',RESUME_AI_ENABLED:'false',PRO_TOOLS_ENABLED:'true',PRO_AI_ENABLED:'false',ASSETS:{fetch:async()=>new Response('test asset',{status:200})}};
 try{for(const path of ['/','/about','/contact','/pro','/login','/signup','/privacy','/terms','/refund-policy','/resources/create-a-stronger-application','/api/pro-tools/cover-letter','/api/resume/review','/logout']){const request=new Request('https://veeays.com'+path);const a=await live.fetch(request.clone(),env,{}),b=await candidate.fetch(request.clone(),env,{});assert.equal(b.status,a.status,path);assert.deepEqual([...b.headers],[...a.headers],path);assert.equal(await b.text(),await a.text(),path);}assert.equal(calls,0);}finally{globalThis.fetch=oldFetch;}
});
test('reviewed assets support GET/HEAD and reject mutation; unrelated assets fall through',async()=>{
 for(const name of Object.keys(manifest.reviewedBrowserFiles)){const u='https://veeays.com/'+name;const get=await candidate.fetch(new Request(u),{},{});assert.equal(get.status,200);assert.equal(hash(Buffer.from(await get.text())),manifest.reviewedBrowserFiles[name]);assert.equal((await candidate.fetch(new Request(u,{method:'HEAD'}),{},{})).status,200);assert.equal((await candidate.fetch(new Request(u,{method:'POST'}),{},{})).status,405);}
});
test('automatic deployment remains blocked independently of shell environment',()=>{
 const r=spawnSync(process.execPath,['scripts/resume-release-review-gate.mjs'],{encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/not approved/);
});
test('the existing Cloudflare main build and npm deploy commands are wired to the review gate',async()=>{const p=JSON.parse(await fs.readFile('package.json','utf8'));assert.equal(p.scripts.build,'node scripts/resume-release-review-gate.mjs');assert.equal(p.scripts.predeploy,p.scripts.build);});
