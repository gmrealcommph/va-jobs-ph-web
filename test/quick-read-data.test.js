import test from 'node:test';
import assert from 'node:assert/strict';
import {getJob,listJobs} from '../src/data.js';
import {sourceUnits,sourceFingerprint,validateSelection,SECTIONS} from '../src/quick-read-generation.js';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const description='About the role\nCoordinate client success operations for a remote technology business.\nRequirements\nExcel experience required.\nImportant requirements\nMust have Philippines work authorization; no sponsorship.';
const sourceSelection=()=>{const q=Object.fromEntries(SECTIONS.map(k=>[k,[]]));q.other_details=sourceUnits(description).map(u=>u.id);return q;};
test('detail consumes only whitelist with source binding; homepage stays on unchanged public_jobs query',async()=>{
  const originalFetch=globalThis.fetch;
  const calls=[];const hash=await sourceFingerprint(description);
  globalThis.fetch=async(input,init)=>{
    const url=new URL(input);calls.push(url);
    if(url.pathname.endsWith('public_jobs')) return Response.json([{id:37688,description}],{headers:{'content-range':'0-0/1'}});
    assert.equal(init.headers.apikey,'sb_publishable_test');assert.equal(init.headers.Authorization,undefined);
    return Response.json({salary_min:37500,salary_currency:'PHP',quick_read:validateSelection(sourceSelection(),description),quick_read_source_hash:hash,internal_notes:'private',category:'invented'});
  };
  try {
    const job=await getJob(env,'37688');assert.equal(job.salary_min,37500);assert.equal(job.quick_read.version,2);assert.equal(job.internal_notes,undefined);assert.equal(job.category,undefined);
    assert.equal(calls.length,2);await listJobs(env);assert.equal(calls.length,3);assert.equal(calls[2].pathname,'/rest/v1/public_jobs');
  } finally {globalThis.fetch=originalFetch;}
});
test('undeployed migration, invalid output and changed public source safely retain original job',async()=>{
  const originalFetch=globalThis.fetch;
  try {
    for(const extra of [new Response('missing RPC',{status:404}),Response.json({quick_read:{version:2},quick_read_source_hash:await sourceFingerprint(description)}),Response.json({quick_read:validateSelection(sourceSelection(),description),quick_read_source_hash:await sourceFingerprint(description+'changed')})]) {
      globalThis.fetch=async input=>new URL(input).pathname.endsWith('public_jobs')?Response.json([{id:37688,description}]):extra;
      const job=await getJob(env,'37688');assert.equal(job.description,description);assert.equal(job.quick_read,null);
    }
  } finally {globalThis.fetch=originalFetch;}
});
