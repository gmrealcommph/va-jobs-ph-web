import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceUnits,SECTIONS,validateSelection,validateStored,generateWithProvider,sourceFingerprint} from '../src/quick-read-generation.js';
import {generateJob} from '../src/quick-read-service.js';
import {presentQuickRead} from '../src/quick-read-presentation.js';
import {renderJobRead} from '../src/job-detail-read.js';

// Real public Original description DOM capture, 2026-10-04, reused from the
// representative review. Whitespace is capture formatting, not DB hash evidence.
// All selections/provider responses below are local mocks, not the failed output.
const source=readFileSync(new URL('./fixtures/senior-bookkeeper-41638.txt',import.meta.url),'utf8');
const job={location:'Philippines',employment_type:'full_time',experience_level:'senior'};
function selection(description=source) {
  const q=Object.fromEntries(SECTIONS.map(k=>[k,[]]));
  for(const u of sourceUnits(description)) {
    const key=u.is_heading?'other_details':u.section_hint==='requirements'?'requirements':
      [5,6].includes(u.id)?'important_requirements':u.id===0?'company_overview':
      u.id===10?'about_role':u.id>=12 && u.id<=19?'responsibilities':
      [3,4,7,8].includes(u.id)?'benefits':'other_details';
    q[key].push(u.id);
  }
  return q;
}
function move(q,id,key) {
  for(const k of SECTIONS) q[k]=q[k].filter(n=>n!==id);
  q[key].push(id);return q;
}
const response=q=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(q)}]}]});

test('41638: captured source checksum and exact qualification block, without metadata leakage',()=>{
  const normalized=source.replace(/\s+/g,' ').trim();
  let hash=2166136261;for(let i=0;i<normalized.length;i++) hash=Math.imul(hash^normalized.charCodeAt(i),16777619);
  assert.equal(normalized.length,2898);assert.equal((hash>>>0).toString(16),'ae7a51f0');
  const units=sourceUnits(source),heading=units.find(u=>u.text==='Skills & Experience:');
  assert.ok(heading.is_heading);assert.equal(heading.section_hint,'requirements');
  const marker=units.findIndex(u=>u.text==='Originally posted on Himalayas');
  const qualifications=units.slice(heading.id+1,marker);
  assert.equal(qualifications.length,7);
  for(const u of qualifications) assert.equal(u.section_hint,'requirements');
  for(const u of units.slice(marker)) assert.equal(u.section_hint,'unknown');
  const q=validateSelection(selection(),source);
  assert.deepEqual(q.requirements,qualifications.map(u=>u.text));
  assert.ok(q.requirements.includes('Minimum of 4 years of Australian bookkeeping experience, within a public practice environment.'));
  assert.ok(q.requirements.includes('Proficiency in accounting software Xero.'));
  assert.deepEqual(validateStored(q,source),q);
});

test('41638: corrected hints reach mocked provider and validated persistence',async()=>{
  const q=selection(),payload=await generateWithProvider({OPENAI_API_KEY:'test-only',QUICK_READ_MODEL:'mock'},source,async(url,init)=>{
    const sent=JSON.parse(init.body);
    assert.equal(sent.store,false);assert.equal(sent.text.format.strict,true);
    assert.deepEqual(JSON.parse(sent.input).source_units,sourceUnits(source));
    assert.match(sent.instructions,/requirements must be from a source requirements section_hint/);
    return response(q);
  });
  let finish;
  const result=await generateJob({QUICK_READ_MODEL:'mock'},'41638',{
    call:async(e,name,args)=>name==='claim_job_quick_read'
      ?{status:'claimed',description:source,source_hash:await sourceFingerprint(source)}
      :(finish=args,{status:'ready'}),generate:async()=>payload
  });
  assert.equal(result.status,'ready');assert.equal(finish.p_error,null);
  assert.deepEqual(finish.p_payload.requirements,payload.requirements);
});

test('41638: unsupported duties/tail, omitted IDs and invented references still fail closed',async()=>{
  const units=sourceUnits(source);
  for(const text of ['Manage accounts payable and receivable, including processing invoices, payments, and collections.','Employment type: Full Time']) {
    const q=move(selection(),units.find(u=>u.text===text).id,'requirements');
    assert.throws(()=>validateSelection(q,source),/unsupported_requirement/);
    await assert.rejects(generateWithProvider({OPENAI_API_KEY:'test-only',QUICK_READ_MODEL:'mock'},source,async()=>response(q)),/unsupported_requirement/);
  }
  for(const u of units) {
    const q=selection();for(const k of SECTIONS) q[k]=q[k].filter(id=>id!==u.id);
    assert.throws(()=>validateSelection(q,source),/source_omitted/);
  }
  const q=selection();q.requirements.push(999);
  assert.throws(()=>validateSelection(q,source),/invalid_source_reference/);
  const corrupt=validateSelection(selection(),source);corrupt.requirements.push('Invented qualification');
  assert.equal(validateStored(corrupt,source),null);
  assert.match(renderJobRead(source,corrupt,job),/Quick Read is unavailable/);
});

test('41638: preference safeguards remain under recognized heading (synthetic mutation)',()=>{
  // Explicitly synthetic adversarial additions, never part of the real fixture.
  for(const [line,error] of [['Xero certification preferred.','preference_upgraded'],['Excel required; Xero preferred.','preference_upgraded']]) {
    const changed=source.replace('Skills & Experience:',`Skills & Experience:\n${line}`);
    const q=selection(changed),id=sourceUnits(changed).find(u=>u.text===line).id;
    assert.throws(()=>validateSelection(q,changed),new RegExp(error));
    if(line.includes('required')) {
      move(q,id,'nice_to_have');assert.throws(()=>validateSelection(q,changed),/mixed_obligation/);
      move(q,id,'other_details');
    } else move(q,id,'nice_to_have');
    assert.ok(validateSelection(q,changed));
  }
  const prose=source.replace('Skills & Experience:','We discuss Skills & Experience: during onboarding.');
  assert.notEqual(sourceUnits(prose).find(u=>u.text.startsWith('Minimum of 4 years')).section_hint,'requirements');
});

test('41638: presentation hides only the heading, retains conditions, payload and complete original',()=>{
  const q=validateSelection(selection(),source),before=structuredClone(q);
  const view=presentQuickRead(q,source,job);
  assert.deepEqual(q,before);
  assert.ok(!Object.values(view).filter(Array.isArray).flat().includes('Skills & Experience:'));
  assert.deepEqual(view.requirements,q.requirements);
  for(const fact of ['Permanent work from home set-up.','Working Monday to Friday, 7:00 am to 3:00 pm PH time.','New equipment supplied.','Bonus structure.','Salary package of 100,000 pesos per month.'])
    assert.ok(Object.values(view).filter(Array.isArray).flat().includes(fact),fact);
  assert.deepEqual(view.salary,[]);
  const html=renderJobRead(source,q,job);
  const original=html.match(/<div class="qr-original">([\s\S]*?)<\/div>/)[1]
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  assert.equal(original,source);
});
