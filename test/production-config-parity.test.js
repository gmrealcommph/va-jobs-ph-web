import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(readFileSync(new URL(p,root)));
test('effective nonsecret bindings retained, only Quick Reads generation configuration intentionally differs',()=>{
 const config=read('wrangler.jsonc'),settings=read('evidence/production-20261018/settings.json');
 for(const b of settings.bindings){
  if(b.type==='plain_text')assert.equal(config.vars[b.name],b.name==='QUICK_READ_MODE'?'disabled':['QUICK_READ_AUTO_ENABLED','QUICK_READ_BATCH_ENABLED'].includes(b.name)?'false':b.text,b.name);
  else if(b.type==='ratelimit')assert.deepEqual(config.ratelimits.find(r=>r.name===b.name),{name:b.name,namespace_id:b.namespace_id,simple:b.simple});
  else assert.ok(['assets','secret_text'].includes(b.type),'unrepresented binding '+b.name);
 }
 assert.equal(config.vars.QUICK_READ_GENERATION_ENABLED,'false');assert.equal(config.keep_vars,true);
 assert.equal(config.compatibility_date,settings.compatibility_date);assert.deepEqual(config.compatibility_flags,settings.compatibility_flags);
 const schedules=read('evidence/production-20261018/schedules.json').result.schedules;
 assert.deepEqual(config.triggers.crons,schedules.map(s=>s.cron).filter(c=>c!=='0-59 * * * *'));
});
test('all known deployed assets retain exact bytes; no additional local public paths',()=>{
 const assets=read('evidence/production-20261018/assets.json');
 const walk=(dir,prefix='')=>readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(new URL(x.name+'/',dir),prefix+x.name+'/'):[prefix+x.name]);
 assert.deepEqual(walk(new URL('public/',root)).sort(),assets.map(a=>a.path.slice(1)).sort());
 for(const a of assets)assert.equal(createHash('sha256').update(readFileSync(new URL('public'+a.path,root))).digest('hex'),a.live,a.path);
});
