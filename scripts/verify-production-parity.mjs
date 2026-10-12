import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parse} from 'acorn';
const parseCode=s=>parse(s,{ecmaVersion:'latest',sourceType:'module'});
const strip=n=>{
 if(n===null||typeof n!=='object')return n;
 if(Array.isArray(n))return n.filter(x=>!(x?.type==='ExpressionStatement'&&x.expression?.callee?.name==='__name')).map(strip);
 if(n.type==='CallExpression'&&n.callee?.name==='__name')return strip(n.arguments[0]);
 const o={};for(const [k,v] of Object.entries(n))if(!['start','end','raw'].includes(k))o[k]=strip(v);
 // Documented esbuild collision aliases, consistently renamed in declarations/references.
 if(o.type==='Identifier'&&['setSessionCookies2','period2','token2','origin2','row2','headers2'].includes(o.name))o.name=o.name.slice(0,-1);
 if(o.type==='Property')o.shorthand=false;
 return o;
};
function inventory(code){const ast=parseCode(code),items=new Map(),other=[];for(const node of ast.body){
 if(node.type==='FunctionDeclaration')items.set('function:'+strip(node.id).name,strip(node));
 else if(node.type==='VariableDeclaration')for(const d of node.declarations)items.set('variable:'+d.id.name,{declaration:strip(d)});
 else if(node.type==='ExportNamedDeclaration')continue;
 else if(node.type==='ExpressionStatement'&&node.expression?.callee?.name==='__name')continue;
 else other.push(strip(node));
}return {items,other};}
const live=inventory(await readFile(new URL('../evidence/production-20261012/worker.reference.mjs',import.meta.url),'utf8'));
const built=inventory(await readFile(new URL('../dist/worker.js',import.meta.url),'utf8'));
const differences=[];let equal=0;
for(const [key,value] of live.items){const candidate=built.items.get(key);if(JSON.stringify(value)===JSON.stringify(candidate))equal++;else differences.push({key,production:value,recovered:candidate||null});}
const extra=[...built.items.keys()].filter(x=>!live.items.has(x));
assert.equal(differences.length,0,'Recovered declarations differ from production: '+differences.map(x=>x.key));
assert.deepEqual(extra,[]);
assert.deepEqual(live.other,built.other,'Startup statements differ from production');
const reference=await readFile(new URL('../evidence/production-20261012/worker.reference.mjs',import.meta.url));
assert.equal(createHash('sha256').update(reference).digest('hex'),'97dedca2d7be6dfc88105867fe6ca58fc6cb90159b6e5f24a7318df97b34399e');
console.log(JSON.stringify({equal,production_declarations:live.items.size,differences:differences.map(x=>x.key),extra,production_initializers:live.other.length,recovered_initializers:built.other.length,initializers_match:JSON.stringify(live.other)===JSON.stringify(built.other)},null,2));
