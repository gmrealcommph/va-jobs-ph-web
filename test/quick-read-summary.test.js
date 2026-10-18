import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateWithProvider,sourceUnits,sourceFingerprint,validateStored,validateSelection,SECTIONS} from '../src/quick-read-generation.js';
import {validateSummary,SUMMARY_SECTIONS} from '../src/quick-read-summary.js';
import {generateJob} from '../src/quick-read-service.js';
import {renderJobRead} from '../src/job-detail-read.js';
import {presentQuickRead} from '../src/quick-read-presentation.js';
const fixture=name=>readFileSync(new URL('./fixtures/'+name,import.meta.url),'utf8');
const source=fixture('executive-assistant-25943.txt');
const sample=JSON.parse(fixture('executive-assistant-25943-summary.json'));
const env={OPENAI_API_KEY:'offline-test',QUICK_READ_MODEL:'gpt-5-mini'};
const response=summary=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(summary)}]}]});

test('25943: new generator, source-bound persistence and four prose sections with no dump',async()=>{
  let calls=0;
  const payload=await generateWithProvider(env,source,async(url,init)=>{
    calls++;const body=JSON.parse(init.body);
    assert.equal(body.max_output_tokens,4096);assert.equal(body.store,false);
    assert.equal(body.model,'gpt-5-mini');assert.equal(body.truncation,'disabled');
    assert.match(body.instructions,/untrusted DATA/);assert.match(body.instructions,/150–220/);
    assert.deepEqual(JSON.parse(body.input).source_units,sourceUnits(source));
    return response(sample);
  });
  assert.equal(calls,1);assert.deepEqual(validateStored(payload,source),payload);
  let finished;
  const result=await generateJob(env,'25943',{call:async(e,name,args)=>name==='claim_job_quick_read_auto'?{status:'claimed',description:source,source_hash:await sourceFingerprint(source)}:(finished=args,{status:'ready'}),generate:async()=>payload});
  assert.equal(result.status,'ready');assert.deepEqual(finished.p_payload.summary,sample);
  const html=renderJobRead(source,payload,{}), visible=html.split('<details')[0];
  for(const label of Object.values(SUMMARY_SECTIONS)) assert.ok(visible.includes(label.replaceAll('&','&amp;').replaceAll("'",'&#39;')));
  assert.equal((visible.match(/<h3>/g)||[]).length,4);
  assert.doesNotMatch(visible,/<li>|years years|Originally posted|Conflicting source|Employment type:/);
  assert.match(visible,/8\+ years/);assert.match(visible,/independent contractor/);
  assert.ok(html.includes('Original description · View source'));
  const wrong=structuredClone(payload);wrong.summary.arrangements.text+=' Pay is 9,999.';
  assert.equal(validateStored(wrong,source),null);
});

test('25943: reject padding, repetition, source dumps, malformed grammar, fabricated pay/benefits and omitted conditions',()=>{
  const invalid=mutate=>{const q=structuredClone(sample);mutate(q);assert.throws(()=>validateSummary(q,sourceUnits(source)),/summary_quality_rejected/);};
  invalid(q=>q.about_role.text+=' '+q.about_role.text);
  invalid(q=>q.about_role.text='extra '.repeat(251));
  invalid(q=>q.candidate.text=q.candidate.text.replace('8+ years','8+ years years'));
  invalid(q=>q.arrangements.text+=' Health insurance is included.');
  invalid(q=>q.arrangements.text+=' Remote work is guaranteed.');
  invalid(q=>q.arrangements.text=q.arrangements.text.replace('1,500','9,999'));
  invalid(q=>q.candidate.text=q.candidate.text.replace('8+ years','Extensive experience'));
  invalid(q=>q.candidate.text=q.candidate.text.replace('8+ years','8+ months'));
  invalid(q=>q.arrangements.source_ids=[]);
  invalid(q=>q.candidate.source_ids=q.candidate.source_ids.filter(id=>id!==87));
  invalid(q=>q.actual_duties.source_ids.push(999));
  invalid(q=>q.actual_duties.text+=' Employment Type: Contractor');
  invalid(q=>q.about_role.text=sourceUnits(source)[7].text);
});

const sparse='A small design team needs help keeping shared files organised.\nDuties include naming files and checking folders.\nSend a portfolio when applying.';
const sparseSummary={version:1,about_role:{text:'You’ll help a small design team keep its shared files organised.',source_ids:[0]},actual_duties:{text:'The work involves naming files and checking that folders stay in order.',source_ids:[1]},candidate:{text:'The listing asks applicants to send a portfolio. Other qualifications are not specified.',source_ids:[2]},arrangements:{text:'Pay, schedule, employment type and hiring eligibility are not specified.',source_ids:[]}};
test('sparse sources stay short with explicit unknowns, no inferred working arrangements',async()=>{
  assert.deepEqual(validateSummary(sparseSummary,sourceUnits(sparse)),sparseSummary);
  const q=await generateWithProvider(env,sparse,async()=>response(sparseSummary));
  assert.deepEqual(validateStored(q,sparse)?.summary,sparseSummary);
});

test('night-shift coordinator: preserve eligibility, equipment, pay and application rejection conditions',async()=>{
  const source='Support client campaigns and maintain Salesforce records.\nPrepare reports in Google Sheets or Excel and flag delivery problems.\nMust have a laptop, internet and a backup connection.\nWorking hours: 9PM to 6AM PHT.\nPhilippines work authorization required; no visa sponsorship.\nSalary: PHP 37,500–46,000 per month.\nFull-time employment.\nSalesforce certification preferred.\nAI-generated or incomplete application answers will be auto-rejected.';
  const summary={version:1,about_role:{text:'You’ll help keep client campaigns running by maintaining their Salesforce records.',source_ids:[0]},actual_duties:{text:'The work includes preparing reports with Google Sheets or Excel and flagging problems that could affect delivery.',source_ids:[1]},candidate:{text:'You need a laptop, internet and a backup connection, plus Philippines work authorization; there is no visa sponsorship. Salesforce certification is preferred. AI-generated or incomplete application answers are auto-rejected.',source_ids:[2,4,7,8]},arrangements:{text:'This is full-time employment with hours of 9PM to 6AM PHT. Pay is PHP 37,500–46,000 per month.',source_ids:[3,5,6]}};
  const payload=await generateWithProvider(env,source,async()=>response(summary));
  assert.deepEqual(validateStored(payload,source)?.summary,summary);
  const bad=structuredClone(summary);bad.candidate.source_ids=bad.candidate.source_ids.filter(id=>id!==8);
  assert.throws(()=>validateSummary(bad,sourceUnits(source)),/summary_quality_rejected/);
  const reversed=structuredClone(summary);reversed.candidate.text=reversed.candidate.text.replace('no visa sponsorship','visa sponsorship available');
  assert.throws(()=>validateSummary(reversed,sourceUnits(source)),/summary_quality_rejected/);
  const omitted=structuredClone(summary);omitted.candidate.text=omitted.candidate.text.replace('a backup connection','a connection');
  assert.throws(()=>validateSummary(omitted,sourceUnits(source)),/summary_quality_rejected/);
});

const conflictSource='About the role\nSupport customer requests and explain product options.\nResponsibilities\nTrack orders and respond to customer questions.\nSalary: USD 1,000 per month\nSalary: USD 2,000 per month\nExperience preferred, not required.\nMust have reliable internet.\nNo visa sponsorship.';
const conflict={version:1,about_role:{text:'This customer support role involves helping people understand their product options.',source_ids:[1]},actual_duties:{text:'You’ll answer customer questions and track orders through the process.',source_ids:[3]},candidate:{text:'Experience is preferred, not required. Reliable internet is required and there is no visa sponsorship.',source_ids:[6,7,8]},arrangements:{text:'The pay is inconsistent: the listing gives both USD 1,000 per month and USD 2,000 per month. The schedule is not specified.',source_ids:[4,5]}};
test('genuine incompatible pay stays explicit; preferences and restrictions remain visible',()=>{
  assert.deepEqual(validateSummary(conflict,sourceUnits(conflictSource)),conflict);
  const bad=structuredClone(conflict);bad.arrangements.text='The listing offers USD 1,000 per month and USD 2,000 per month.';
  assert.throws(()=>validateSummary(bad,sourceUnits(conflictSource)),/summary_quality_rejected/);
  bad.arrangements.text='The salary is inconsistent: USD 1,000 per month.';
  assert.throws(()=>validateSummary(bad,sourceUnits(conflictSource)),/summary_quality_rejected/);
});

test('equivalent contractor metadata does not conflict; actual employee disagreement remains visible',()=>{
  const description='About the role\nSupport a busy executive and keep their projects moving.\nEmployment Type: Independent Contractor\nRequirements\nExperience coordinating projects.';
  const selection=Object.fromEntries(SECTIONS.map(k=>[k,[]]));selection.other_details=sourceUnits(description).map(u=>u.id);
  const payload=validateSelection(selection,description);
  for(const value of ['contract','contractor','independent_contractor']) assert.deepEqual(presentQuickRead(payload,description,{employment_type:value}).conflicting_source_details,[]);
  assert.deepEqual(presentQuickRead(payload,description,{employment_type:'employee'}).conflicting_source_details,['Employment Type: Independent Contractor']);
  assert.ok(validateStored(payload,description)); // legacy caches remain usable
});

test('genuine employee/contractor inconsistency cannot silently choose one engagement',()=>{
  const description=sparse+'\nEmployment: Employee\nEmployment Type: Independent Contractor';
  const q=structuredClone(sparseSummary);q.arrangements={text:'The employment terms are inconsistent: the listing says both employee and independent contractor. Pay and hours are not specified.',source_ids:[3,4]};
  assert.deepEqual(validateSummary(q,sourceUnits(description)),q);
  q.arrangements.text='This is an independent contractor role. Pay and hours are not specified.';
  assert.throws(()=>validateSummary(q,sourceUnits(description)),/summary_quality_rejected/);
});

test('quality failures are sanitized, persisted without prose diagnostics and never retried in-call',async()=>{
  let calls=0,finished;
  const result=await generateJob(env,'25943',{call:async(e,name,args)=>name==='claim_job_quick_read_auto'?{status:'claimed',description:source,source_hash:await sourceFingerprint(source)}:(finished=args,{status:'failed'}),generate:(e,s)=>generateWithProvider(e,s,async()=>{calls++;return response({...sample,version:99});})});
  assert.equal(calls,1);assert.equal(result.error,'summary_quality_rejected');assert.equal(finished.p_payload,null);assert.equal(finished.p_diagnostics,null);
});

test('provider failures, refusals and model allowlist remain enforced on prose generation',async()=>{
  for(const status of [401,403,429,500]) await assert.rejects(generateWithProvider(env,sparse,async()=>Response.json({error:{message:'private'}},{status})),new RegExp('provider_http_'+status));
  await assert.rejects(generateWithProvider(env,sparse,async()=>Response.json({error:{code:'insufficient_quota'}},{status:429})),/provider_insufficient_credit/);
  await assert.rejects(generateWithProvider({...env,QUICK_READ_MODEL:'other'},sparse,async()=>assert.fail('must not call provider')),/provider_model_not_allowed/);
  await assert.rejects(generateWithProvider(env,sparse,async()=>Response.json({status:'completed',output:[{content:[{type:'refusal'}]}]})),/provider_refusal/);
  await assert.rejects(generateWithProvider(env,sparse,async()=>Response.json({status:'incomplete',output:[]})),/provider_incomplete/);
});
