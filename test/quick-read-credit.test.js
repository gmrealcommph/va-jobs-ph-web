import test from 'node:test';
import assert from 'node:assert/strict';
import {organizeWithProvider as generateWithProvider} from '../src/quick-read-generation.js';
const source='About the role\nCoordinate customer relationships across a distributed team.\nClear communication and accurate reporting are part of the role.';
const env={QUICK_READ_GENERATION_ENABLED:'true',QUICK_READ_MODEL:'gpt-5-mini',OPENAI_API_KEY:'synthetic'};
test('credit exhaustion is distinct from rate limits and excludes provider messages',async()=>{
 for(const [status,code,expected] of [[429,'insufficient_quota','provider_insufficient_credit'],[429,'billing_hard_limit_reached','provider_insufficient_credit'],[402,'unknown','provider_insufficient_credit'],[429,'rate_limit_exceeded','provider_http_429'],[500,'unknown','provider_http_500']]) {
  await assert.rejects(generateWithProvider(env,source,async()=>Response.json({error:{code,message:'PRIVATE_SENTINEL'}},{status})),error=>error.message===expected&&!String(error).includes('PRIVATE_SENTINEL'));
 }
});
