import test from 'node:test';
import assert from 'node:assert/strict';
import {attachQuickReadAvailability,quickReadMarker} from '../src/quick-read-availability.js';
import {sourceUnits,sourceFingerprint,validateSelection,SECTIONS} from '../src/quick-read-generation.js';
import {card,discoveryCard,detail,myJobsPage,matchesPage} from '../src/render.js';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_synthetic'};
const description='About the role\nCoordinate client success operations for a remote technology business.\nRequirements\nExcel experience required.\nImportant requirements\nMust have Philippines work authorization; no sponsorship.';
const selection=Object.fromEntries(SECTIONS.map(key=>[key,[]]));
selection.other_details=sourceUnits(description).map(unit=>unit.id);
const payload=validateSelection(selection,description);

test('one bounded server lookup marks only current valid ready payloads, never copies private fields',async()=>{
  const original=globalThis.fetch;
  const hash=await sourceFingerprint(description);
  let calls=0;
  globalThis.fetch=async(input,init)=>{
    calls++;
    const url=new URL(input);
    assert.equal(url.pathname,'/rest/v1/job_quick_reads');
    assert.equal(url.searchParams.get('status'),'eq.ready');
    assert.equal(url.searchParams.get('job_id'),'in.(1,2,3,4)');
    assert.equal(init.headers.apikey,env.SUPABASE_SERVICE_ROLE_KEY);
    assert.equal(init.redirect,'error');
    return Response.json([
      {job_id:'1',source_hash:hash,payload,internal_notes:'private'},
      {job_id:'2',source_hash:await sourceFingerprint(description+'changed'),payload},
      {job_id:'3',source_hash:hash,payload:{version:2}}
    ]);
  };
  try {
    const jobs=[1,2,3,4].map(id=>({id,description}));
    await attachQuickReadAvailability(env,jobs);
    assert.equal(calls,1);
    assert.deepEqual(jobs.map(job=>job.quick_read_ready),[true,false,false,false]);
    for(const job of jobs) assert.deepEqual(Object.keys(job).sort(),['description','id','quick_read_ready']);
  } finally {globalThis.fetch=original;}
});

test('missing credentials and status failures retain usable listings without a false marker',async()=>{
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async()=>{throw Error('synthetic failure');};
    for(const config of [env,{}]) {
      const jobs=[{id:1,description,quick_read_ready:true}];
      assert.equal(await attachQuickReadAvailability(config,jobs),jobs);
      assert.equal(jobs[0].quick_read_ready,false);
    }
  } finally {globalThis.fetch=original;}
});

test('all title surfaces show accessible sparkle only for ready reads and retain escaped original title',()=>{
  for(const ready of [false,true]) {
    const job={id:1,job_id:1,title:'Support <Lead>',company:'Example',description,quick_read_ready:ready};
    for(const html of [card(job),discoveryCard(job),detail(job),myJobsPage({saved:[job]}),matchesPage({matches:[job]})]) {
      assert.equal(html.includes('class="quick-read-marker"'),ready);
      assert.ok(html.includes('Support &lt;Lead&gt;'));
      if(ready) assert.ok(html.includes('aria-label="Quick Read available" title="Quick Read available">✨'));
    }
  }
  assert.equal(quickReadMarker({quick_read_ready:'true'}),'');
  assert.ok(quickReadMarker({quick_read:payload}).includes('✨'));
});
