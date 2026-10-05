import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SECTIONS,sourceUnits,validateSelection,validateStored,generateWithProvider,sourceFingerprint} from '../src/quick-read-generation.js';
import {renderJobRead} from '../src/job-detail-read.js';
// Public HTML-decoded Original description, GET /jobs/432 on 2026-10-05
// Asia/Manila. Not historical database bytes or the failed provider response.
const source=readFileSync(new URL('./fixtures/backfill-432.txt',import.meta.url),'utf8');
const env={OPENAI_API_KEY:'test-only',QUICK_READ_MODEL:'mock'};
const response=q=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(q)}]}]});
function selection(text=source) {
 const q=Object.fromEntries(SECTIONS.map(k=>[k,[]]));q.other_details=sourceUnits(text).map(u=>u.id);return q;
}
function move(q,id,key) {for(const k of SECTIONS) q[k]=q[k].filter(n=>n!==id);q[key].push(id);return q;}
test('432: negated required reproduces mixed_obligation; whole source and thresholds stay intact',async()=>{
 const units=sourceUnits(source),q=selection(),hash=await sourceFingerprint(source);
 const optional=units.find(u=>u.text==='E-commerce background is preferred but not required');
 const threshold=units.find(u=>u.text==='At least 2 years of management experience; 4 years preferred');
 assert.equal(optional.section_hint,'requirements');
 assert.throws(()=>validateSelection(move(structuredClone(q),optional.id,'nice_to_have'),source),/mixed_obligation/);
 for(const u of [optional,threshold]) assert.throws(()=>validateSelection(move(structuredClone(q),u.id,'requirements'),source),/preference_upgraded/);
 const result=await generateWithProvider(env,source,async(url,init)=>{
  const body=JSON.parse(init.body),input=JSON.parse(body.input);
  assert.deepEqual(input.mixed_obligation_ids,[optional.id]);
  for(const u of [optional,threshold]) {assert.ok(input.preference_ids.includes(u.id));assert.equal(input.requirement_supported_ids.includes(u.id),false);}
  assert.match(body.instructions,/including negated wording such as preferred but not required/);
  assert.match(body.instructions,/combined minimum\/preferred thresholds/);
  return response(q);
 });
 assert.deepEqual(validateStored(result,source),result);
 assert.deepEqual(SECTIONS.flatMap(k=>result[k]).sort(),units.map(u=>u.text).sort());
 assert.ok(result.other_details.includes(threshold.text));assert.ok(result.other_details.includes(optional.text));
 const html=renderJobRead(source,result),encoded=html.match(/<div class="qr-original">([\s\S]*?)<\/div>/)[1];
 assert.equal(encoded.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'),source);
 assert.equal(await sourceFingerprint(source),hash);
 let calls=0;
 await assert.rejects(generateWithProvider(env,source,async()=>{calls++;return response(move(structuredClone(q),optional.id,'nice_to_have'));}),/mixed_obligation/);
 assert.equal(calls,1);
});
test('general mixed guard guidance includes mandatory/preferred and optional-section mandatory wording; stays fail closed',async()=>{
 const text='Qualifications\nExcel required; Zoho preferred.\nPython mandatory; Java optional.\nMust have SQL; Rust is a nice-to-have.\nAdditional skills that you might also bring\nYou need to know CRM integrations.\nExperience with Salesforce.\nWhat we offer colleagues\nAnnual compensation review.';
 const units=sourceUnits(text),q=selection(text),expected=[1,2,3,5];
 const result=await generateWithProvider(env,text,async(url,init)=>{
  const input=JSON.parse(JSON.parse(init.body).input);assert.deepEqual(input.mixed_obligation_ids,expected);return response(q);
 });
 assert.deepEqual(validateStored(result,text),result);
 for(const id of expected) {
  const bad=move(structuredClone(q),id,'nice_to_have');
  assert.throws(()=>validateSelection(bad,text),/mixed_obligation/);
  await assert.rejects(generateWithProvider(env,text,async()=>response(bad)),/mixed_obligation/);
 }
 const good=move(structuredClone(q),6,'nice_to_have');assert.ok(validateSelection(good,text).nice_to_have.includes('Experience with Salesforce.'));
 const omitted=structuredClone(q);omitted.other_details.pop();
 await assert.rejects(generateWithProvider(env,text,async()=>response(omitted)),/source_omitted/);
});
