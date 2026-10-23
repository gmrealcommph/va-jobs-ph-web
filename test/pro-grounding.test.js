import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {groundedResult,groundedSchema,GROUNDING_VERSION} from '../src/pro-grounding.js';
const source={summary:'Applicant seeking remote work.',experience:'Company A · Assistant · 2023–2024\nI answered questions.\nCompany B · Volunteer · 2025\nI recorded enquiries, but did not handle payments.',education:'Not yet certified. Studying bookkeeping.',skills:'Basic spreadsheets; no CRM experience.',projects:'Created a shared checklist for a school event.'};
const job={title:'Support Assistant',company:'Example employer'};
const opt=(source_id,operation='direct_action',topic='clarity')=>({suggestions:[{source_id,operation,topic}]});
test('the observed unsupported maintained rewrite and cross-role cover-letter association are rejected',async()=>{
 const f=JSON.parse(await readFile(new URL('fixtures/pro-ai-live-quality.json',import.meta.url)));
 assert.throws(()=>groundedResult({suggestions:[{field:'projects',quote:f.optimizer.sourceProject,rewrite:f.optimizer.unsupportedRewrite,reason:'Relevant'}]},source,'optimize'));
 assert.throws(()=>groundedResult({letter:f.coverLetter.unsupportedAssociation},source,'cover-letter',job));
 const result=groundedResult(opt('projects'),source,'optimize');assert.equal(result.suggestions[0].rewrite,source.projects);assert.doesNotMatch(result.suggestions[0].rewrite,/maintained/);
 const letter=groundedResult({evidence:[{source_id:'experience'},{source_id:'projects'}]},source,'cover-letter',job);
 assert.ok(letter.letter.includes('Projects — from my résumé:\n'+source.projects));assert.ok(letter.letter.includes('Experience — from my résumé:\n'+source.experience));assert.doesNotMatch(letter.letter,/In that volunteer role|also created|assisted with maintaining/);
});
test('safe edits retain all role boundaries, dates, negation and qualifications without new words',()=>{
 const output=groundedResult(opt('experience'),source,'optimize').suggestions[0];assert.equal(output.quote,source.experience);
 assert.equal(output.rewrite,'Company A · Assistant · 2023–2024\nAnswered questions.\nCompany B · Volunteer · 2025\nRecorded enquiries, but did not handle payments.');
 assert.equal(groundedResult(opt('education'),source,'optimize').suggestions[0].rewrite,source.education);
 for(const field of ['education','skills']){const r=groundedResult(opt(field,'bullet_lines'),source,'optimize');assert.ok(r.suggestions[0].rewrite.includes(source[field]));}
});
test('model-supplied claims, reasons, employers, metrics, context links and partial quotes cannot enter either result',()=>{
 for(const extra of [{rewrite:'Managed a team of 10'},{reason:'Proven expert'},{employer:'Company C'},{quote:'Answered questions.'},{role:'Company A'},{letter:'I am qualified.'}]){
  assert.throws(()=>groundedResult({suggestions:[{...opt('experience').suggestions[0],...extra}]},source,'optimize'));
  assert.throws(()=>groundedResult({evidence:[{source_id:'projects',...extra}]},source,'cover-letter',job));
 }
 for(const operation of ['rewrite','add_metrics','merge_experiences','invent'])assert.throws(()=>groundedResult(opt('experience',operation),source,'optimize'));
});
test('missing, empty, duplicated or forged source IDs fail closed; employer requirements never become applicant claims',()=>{
 for(const source_id of ['unknown','job_description','company','__proto__']){assert.throws(()=>groundedResult(opt(source_id),source,'optimize'));assert.throws(()=>groundedResult({evidence:[{source_id}]},source,'cover-letter',job));}
 assert.throws(()=>groundedResult(opt('experience'),{...source,experience:''},'optimize'));
 assert.throws(()=>groundedResult({evidence:[{source_id:'projects'},{source_id:'projects'}]},source,'cover-letter',job));
 const r=groundedResult({evidence:[{source_id:'skills'}]},source,'cover-letter',{...job,description:'Must have 10 years managing payroll and be a certified accountant.'});assert.ok(r.letter.includes(source.skills));assert.doesNotMatch(r.letter,/10 years|certified accountant|managing payroll/);
 assert.equal(r.grounding_version,GROUNDING_VERSION);assert.equal(r.sources[0].quote,source.skills);
});
test('every selected cover-letter section is reproduced completely and independently, including separate positions and uncertainty',()=>{
 const r=groundedResult({evidence:[{source_id:'experience'},{source_id:'education'},{source_id:'skills'}]},source,'cover-letter',job);
 for(const id of ['experience','education','skills'])assert.ok(r.letter.includes(source[id]));
 assert.doesNotMatch(r.letter,/In this role|In that role|This experience proves|qualified|expert/);
 assert.throws(()=>groundedResult({evidence:[]},source,'cover-letter',job));
});
test('generation schemas expose only references and enums, never free-text applicant claims',()=>{
 const a=groundedSchema('optimize').properties.suggestions.items.properties,b=groundedSchema('cover-letter').properties.evidence.items.properties;
 assert.deepEqual(Object.keys(a).sort(),['operation','source_id','topic']);assert.deepEqual(Object.keys(b),['source_id']);assert.ok(a.operation.enum.length);assert.ok(a.topic.enum.length);
});
