import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{build}=require('esbuild');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseline=JSON.parse(await fs.readFile(path.join(root,'docs/resume-release/baseline.json'),'utf8'));
const source=path.join(root,'src/production-baseline/20261024'),out=path.join(root,'dist/resume-release');
await fs.mkdir(out,{recursive:true});
const hash=v=>createHash('sha256').update(v).digest('hex'),modules={};
for(const item of baseline.modules){
 const bytes=await fs.readFile(path.join(source,item.name));assert.equal(hash(bytes),item.sha256,'Live baseline changed: '+item.name);
 modules[item.name]=bytes.toString('utf8');
}
const oldImport="import {studioBody} from './polished-studio.js';";
assert.equal(modules['reviewed-live.js'].split(oldImport).length,2,'Unexpected live résumé integration point');
modules['reviewed-live.js']=modules['reviewed-live.js'].replace(oldImport,"import {studioBody} from './resume-release-view.js';");
await build({entryPoints:[path.join(root,'src/resume-release/studio-view.js')],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:path.join(out,'resume-release-view.js'),plugins:[{name:'preserve-live-pro-panel',setup(b){b.onResolve({filter:/production-baseline.*pro-tools-ui\.js$/},()=>({path:'./pro-tools-ui.js',external:true}));}}]});
const assets={};
for(const [name,expected] of Object.entries(baseline.reviewedBrowserFiles)){
 const bytes=await fs.readFile(path.join(root,'src/resume-release/browser',name));assert.equal(hash(bytes),expected,'Reviewed design changed: '+name);
 assets['/'+name]=bytes.toString('utf8');
}
const entry=`import production from './production-entry.js';\nexport * from './production-entry.js';\nconst assets=${JSON.stringify(assets)};\nexport default {...production,fetch(request,env,ctx){const p=new URL(request.url).pathname;if(Object.hasOwn(assets,p)){if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});return new Response(request.method==='HEAD'?null:assets[p],{headers:{'content-type':p.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8','cache-control':'public, max-age=3600','x-content-type-options':'nosniff'}});}return production.fetch(request,env,ctx);}};\n`;
modules['resume-release-entry.js']=entry;
for(const [name,code]of Object.entries(modules))await fs.writeFile(path.join(out,name),code);
const metadata={main_module:'resume-release-entry.js',compatibility_date:baseline.compatibilityDate,compatibility_flags:baseline.compatibilityFlags,keep_assets:true,keep_bindings:[...new Set(baseline.bindings.map(b=>b.type))],usage_model:baseline.configuration.usage_model,logpush:baseline.configuration.logpush,placement:baseline.configuration.placement,tags:baseline.configuration.tags,tail_consumers:baseline.configuration.tail_consumers};
await fs.writeFile(path.join(out,'metadata.json'),JSON.stringify(metadata,null,2));
const inventory=[];for(const name of [...Object.keys(modules),'resume-release-view.js'])inventory.push({name,sha256:hash(await fs.readFile(path.join(out,name)))});
await fs.writeFile(path.join(out,'build-manifest.json'),JSON.stringify({baselineVersion:baseline.productionVersion,baselineDeployment:baseline.productionDeployment,modules:inventory,changedBaselineModules:['reviewed-live.js: studioBody import only'],reviewedAssets:baseline.reviewedBrowserFiles,paidCalls:0,deployed:false},null,2));
console.log('Built code-only release from seven verified live modules. No upload or deployment performed.');
// Offline browser-module mirror for deterministic tests; it is never an asset upload.
const mirror=path.join(root,'dist/resume-release-browser');await fs.mkdir(path.join(mirror,'vendor'),{recursive:true});
for(const name of Object.keys(baseline.reviewedBrowserFiles))await fs.copyFile(path.join(root,'src/resume-release/browser',name),path.join(mirror,name));
const deps=JSON.parse(await fs.readFile(path.join(root,'docs/resume-release/browser-dependencies.json'),'utf8'));
for(const d of deps){const name=d.path.slice(1),bytes=await fs.readFile(path.join(root,'src/production-baseline/browser',name));assert.equal(hash(bytes),d.sha256,name);await fs.writeFile(path.join(mirror,name),bytes);}
