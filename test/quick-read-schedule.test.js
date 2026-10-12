import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {QUICK_READ_CRON,scheduledQuickReads} from '../src/quick-read-scheduled.js';
import {DIGEST_CRON} from '../src/daily-digest.js';
test('minute schedule allows one attempt per tick, stays separate from digest, and keeps pause checks',async()=>{
 const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(QUICK_READ_CRON,'0-59 * * * *');assert.notEqual(QUICK_READ_CRON,DIGEST_CRON);assert.ok(config.triggers.crons.includes(QUICK_READ_CRON));assert.ok(config.triggers.crons.includes(DIGEST_CRON));assert.ok(config.triggers.crons.includes('*/15 * * * *'));
 let calls=0,runs=0;
 const env={QUICK_READ_AUTO_ENABLED:'true',OPENAI_API_KEY:'test',QUICK_READ_MODEL:'gpt-5-mini'};
 const deps={call:async()=>{calls++;return [{id:'1'},{id:'2'}];},run:async()=>{runs++;return {status:'ready'};},log(){}};
 for(let minute=0;minute<60;minute++)await scheduledQuickReads({cron:QUICK_READ_CRON},env,deps);
 assert.equal(runs,60);assert.equal(calls,60);
 await scheduledQuickReads({cron:DIGEST_CRON},env,deps);await scheduledQuickReads({cron:QUICK_READ_CRON},{...env,QUICK_READ_AUTO_ENABLED:'false'},deps);
 assert.equal(runs,60);assert.equal(calls,60);
});
