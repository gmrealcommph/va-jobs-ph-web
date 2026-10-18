import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generateJob,quickReadEndpoint} from '../src/quick-read-service.js';
import {scheduledQuickReads,QUICK_READ_CRON} from '../src/quick-read-scheduled.js';
import {generateWithProvider,organizeWithProvider} from '../src/quick-read-generation.js';
import {generateSummary} from '../src/quick-read-summary.js';
const legacy={QUICK_READ_AUTO_ENABLED:'true',QUICK_READ_BATCH_ENABLED:'true',QUICK_READ_MODE:'manual',QUICK_READ_ADMIN_TOKEN:'x'.repeat(32),OPENAI_API_KEY:'synthetic',QUICK_READ_MODEL:'gpt-5-mini'};
const forbidden=()=>assert.fail('disabled generation must cause no RPC, queue write or provider call');
for(const value of [undefined,'false','TRUE','1',true,' true ',null]) test(`master gate fails closed for ${String(value)}`,async()=>{
 const env={...legacy,QUICK_READ_GENERATION_ENABLED:value};
 await scheduledQuickReads({cron:QUICK_READ_CRON},env,{call:forbidden,run:forbidden});
 await scheduledQuickReads({cron:QUICK_READ_CRON},{...env,QUICK_READ_MODE:'auto'},{call:forbidden,run:forbidden});
 assert.equal((await generateJob(env,'1',{call:forbidden,generate:forbidden})).status,'generation_disabled');
 for(const id of ['1',null]){
  const r=await quickReadEndpoint(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer '+legacy.QUICK_READ_ADMIN_TOKEN},body:'{"limit":1}'}),env,id,{call:forbidden,generate:forbidden});
  assert.equal(r.status,503);assert.equal((await r.json()).error,'generation_disabled');
 }
 for(const run of [generateWithProvider,organizeWithProvider,generateSummary])await assert.rejects(run(env,'unused',forbidden),/generation_disabled/);
});
test('manual, missing and malformed modes block cron even with explicit master and auto flags',async()=>{
 for(const mode of ['manual',undefined,'AUTO','disabled'])await scheduledQuickReads({cron:QUICK_READ_CRON},{...legacy,QUICK_READ_GENERATION_ENABLED:'true',QUICK_READ_MODE:mode},{call:forbidden,run:forbidden});
});
test('checked-in release disables generation, batch and auto and removes only Quick Reads schedule',async()=>{
 const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url)));
 for(const key of ['QUICK_READ_GENERATION_ENABLED','QUICK_READ_AUTO_ENABLED','QUICK_READ_BATCH_ENABLED'])assert.equal(config.vars[key],'false');
 assert.equal(config.vars.QUICK_READ_MODE,'disabled');
 assert.deepEqual(config.triggers.crons,['* * * * *','*/15 * * * *','17 */6 * * *']);
});
