// READ ONLY: verifies the release baseline; never uploads code or changes settings.
import fs from 'node:fs/promises';import {createHash}from 'node:crypto';import assert from 'node:assert/strict';
const m=JSON.parse(await fs.readFile(new URL('../docs/resume-release/baseline.json',import.meta.url),'utf8'));
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Set Cloudflare account/token locally; values are never logged. This check is read-only.');
const base=`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${m.worker}`;
const get=async suffix=>{const r=await fetch(base+suffix,{headers:{authorization:'Bearer '+token}});if(!r.ok)throw Error('Read-only preflight failed: HTTP '+r.status);return r;};
const json=async suffix=>{const j=await(await get(suffix)).json();assert.equal(j.success,true);return j.result;};
const canonical=v=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
const hash=v=>createHash('sha256').update(v).digest('hex');
const d=await json('/deployments');assert.equal(d.deployments[0].id,m.productionDeployment,'Live deployment changed: reconcile again');assert.deepEqual(d.deployments[0].versions,[{version_id:m.productionVersion,percentage:100}]);
const version=await json('/versions/'+m.productionVersion);assert.deepEqual(version.resources.script_runtime,m.runtime,'Assets or Durable Object migration state changed');
const s=await json('/settings');const clean={...s,bindings:s.bindings.map(b=>b.type==='secret_text'?{type:b.type,name:b.name}:b)};delete clean.annotations;assert.equal(hash(canonical(clean)),m.configurationSha256,'Live configuration changed: reconcile again');
const crons=(await json('/schedules')).schedules.map(x=>x.cron).sort();assert.deepEqual(crons,[...m.crons].sort());
const raw=await(await get('')).text();assert.ok(raw.length<5000000,'Unexpected script size');const boundary=raw.split('\r\n')[0],files={};
for(const part of raw.split(boundary).slice(1)){const n=part.match(/name="([^"]+)"/);if(n)files[n[1]]=part.slice(part.indexOf('\r\n\r\n')+4).replace(/\r\n$/,'');}
assert.deepEqual(Object.keys(files).sort(),m.modules.map(x=>x.name).sort());for(const item of m.modules)assert.equal(hash(files[item.name]),item.sha256,item.name+' changed');
const deps=JSON.parse(await fs.readFile(new URL('../docs/resume-release/browser-dependencies.json',import.meta.url),'utf8'));for(const dep of deps){const r=await fetch('https://veeays.com'+dep.path);assert.equal(r.status,200);assert.equal(hash(new Uint8Array(await r.arrayBuffer())),dep.sha256,dep.path+' changed');}
console.log('PASS: live code, configuration, bindings, schedules and browser dependencies match the reconciled baseline. No changes made.');
