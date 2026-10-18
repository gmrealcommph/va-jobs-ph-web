import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parse} from 'acorn';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),evidence=new URL('evidence/production-20261018/',root);
const hash=b=>createHash('sha256').update(b).digest('hex');
function clean(n){
 if(!n||typeof n!=='object')return n;
 if(Array.isArray(n))return n.filter(x=>!(x?.type==='ExpressionStatement'&&x.expression?.callee?.name==='__name')).map(clean);
 if(n.type==='CallExpression'&&n.callee?.name==='__name')return clean(n.arguments[0]);
 const out={};for(const[k,v]of Object.entries(n))if(!['start','end','raw'].includes(k))out[k]=clean(v);
 // Reviewed esbuild collision aliases introduced by Quick Reads summary locals.
 if(out.type==='Identifier'&&['raw2','metadata2'].includes(out.name))out.name=out.name.slice(0,-1);
 if(out.type==='Property')out.shorthand=false;return out;
}
function inventory(code){
 const declarations=new Map(),startup=[],exports=[];
 for(const n of parse(code,{ecmaVersion:'latest',sourceType:'module'}).body){
  if(n.type==='FunctionDeclaration')declarations.set(n.id.name,clean(n));
  else if(n.type==='VariableDeclaration')for(const d of n.declarations)declarations.set(d.id.name,clean(d));
  else if(n.type.startsWith('Export'))exports.push(clean(n));
  else if(!(n.type==='ExpressionStatement'&&n.expression?.callee?.name==='__name'))startup.push(clean(n));
 }return {declarations,startup,exports};
}
const reference=readFileSync(new URL('worker.reference.mjs',evidence));
const live=inventory(reference.toString()),bundle=readFileSync(process.argv[2]),built=inventory(bundle.toString());
const changed=[...live.declarations].filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(built.declarations.get(k))).map(([k])=>k);
const added=[...built.declarations.keys()].filter(k=>!live.declarations.has(k));
assert.deepEqual(built.exports,live.exports,'Exports changed');
const assets=JSON.parse(readFileSync(new URL('assets.json',evidence)));
for(const a of assets)assert.equal(hash(readFileSync(new URL('public'+a.path,root))),a.live,a.path);
const result={reference_sha256:hash(reference),bundle_sha256:hash(bundle),live_declarations:live.declarations.size,built_declarations:built.declarations.size,changed,added,startup_match:JSON.stringify(built.startup)===JSON.stringify(live.startup),exports_match:true,known_assets_matching:assets.length,asset_inventory_complete:false};
if(process.argv.includes('--baseline')){assert.deepEqual(changed,[]);assert.deepEqual(added,[]);assert.deepEqual(built.startup,live.startup,'Startup statements changed');}
if(process.argv.includes('--candidate')){
 assert.deepEqual(changed,['validateSelectionUnchecked','validateStored','generateWithProvider','init_quick_read_generation','normalize2','renderJobRead','generateJob','quickReadEndpoint','scheduledQuickReads']);
 assert.deepEqual(added,['requireGenerationEnabled','generationEnabled','init_quick_read_gate','validateSummary','generateSummary','SUMMARY_SECTIONS','equivalent','words','metadata','raw','isMetadata','summarySourceUnits','numbers','noSponsorship','summaryInstructions','partSchema','summarySchema','init_quick_read_summary','organizeWithProvider','material2']);
 // Only Quick Reads module initialization/export wiring may differ at startup.
 const unrelated=s=>s.filter(n=>{const c=n.expression?.callee?.name;return !(/^init_quick_read_/.test(c||'')||(c==='__export'&&n.expression.arguments[0]?.name==='quick_read_generation_exports'));});
 assert.deepEqual(unrelated(built.startup),unrelated(live.startup),'Unrelated startup changed');
}
console.log(JSON.stringify(result,null,2));
