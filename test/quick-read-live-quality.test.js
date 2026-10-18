import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceUnits,generateWithProvider,validateStored} from '../src/quick-read-generation.js';
import {validateSummary,summarySourceUnits,summaryInstructions} from '../src/quick-read-summary.js';
const fixture=name=>readFileSync(new URL('./fixtures/'+name,import.meta.url),'utf8');
const captures=JSON.parse(fixture('live-quality-ceff0fd.json'));
const acceptance=JSON.parse(fixture('executive-assistant-25943-summary.json'));
const source=fixture('executive-assistant-25943.txt');
const rejected=(summary,description=source)=>assert.throws(()=>validateSummary(summary,sourceUnits(description)),/summary_quality_rejected/);

test('all four original live outputs are preserved and rejected, including formerly accepted metadata leak',()=>{
  assert.equal(captures.length,4);
  assert.ok(captures.some(c=>c.fixture==='executive-assistant-25943.txt'));
  for(const c of captures) rejected(c.summary,fixture(c.fixture));
});

test('250-word ceiling stays hard; section budgets target concise output without truncation or repair',()=>{
  assert.match(summaryInstructions,/150–220/);assert.match(summaryInstructions,/never exceed 250/);
  assert.match(summaryInstructions,/about_role 25–35/);
  const q=structuredClone(acceptance);
  const count=()=>Object.values(q).filter(p=>p?.text).flatMap(p=>p.text.replace(/[–—]/g,'-').toLowerCase().match(/[\p{L}\p{N}]+(?:[+'’-][\p{L}\p{N}]+)*/gu)||[]).length;
  let i=0;
  while(count()<250){q.about_role.text+=' item'+String.fromCharCode(97+Math.floor(i/26),97+i%26);i++;}
  assert.equal(count(),250);assert.equal(validateSummary(q,sourceUnits(source)),q);
  q.about_role.text+=' extra';assert.equal(count(),251);rejected(q);
});

test('captured 41638 can pass after removing metadata prose and references, without weakening facts',()=>{
  const c=captures.find(c=>c.fixture==='senior-bookkeeper-41638.txt');
  const q=structuredClone(c.summary),description=fixture(c.fixture),units=sourceUnits(description);
  q.arrangements.text=q.arrangements.text.replace('The posting includes a timezone restriction value of “8.” Categories identify this as a remote/senior bookkeeping role. ','');
  const allowed=new Set(summarySourceUnits(units).map(u=>u.id));
  for(const part of Object.values(q).filter(p=>p?.text))part.source_ids=part.source_ids.filter(id=>allowed.has(id));
  assert.equal(validateSummary(q,units),q);
  q.arrangements.text=q.arrangements.text.replace('100,000','200,000');rejected(q,description);
});

test('metadata paraphrases and internal fields fail even with valid citations and short prose',()=>{
  for(const leak of ['The posting includes a timezone restriction value of 8.', 'Categories identify this as a senior role.', 'The listing was originally posted on Himalayas.', 'The employment type is Contractor.', 'Seniority is listed as Senior.', 'Salary: USD 1,500.', 'The source_ids are private.', 'The section_hint is unknown.']){
    const q=structuredClone(acceptance);q.about_role.text+=' '+leak;rejected(q);
  }
  const q=structuredClone(acceptance);q.arrangements.source_ids.push(117);rejected(q);
});

test('provider input omits headings and metadata, keeps IDs/pay/employment; stored archive stays complete',async()=>{
  let calls=0;
  const payload=await generateWithProvider({QUICK_READ_GENERATION_ENABLED:'true',OPENAI_API_KEY:'offline',QUICK_READ_MODEL:'gpt-5-mini'},source,async(url,init)=>{
    calls++;const body=JSON.parse(init.body),units=JSON.parse(body.input).source_units;
    assert.equal(body.store,false);assert.equal(body.max_output_tokens,4096);
    assert.ok(!units.some(u=>u.is_heading||/^(Originally posted|Timezone restrictions|Categories:|Job functions:|Seniority:)/i.test(u.text)));
    assert.ok(units.some(u=>u.id===113&&/Contractor/.test(u.text)));
    assert.ok(units.some(u=>u.id===118&&/1,500/.test(u.text)));
    return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(acceptance)}]}]});
  });
  assert.equal(calls,1);assert.ok(validateStored(payload,source));
  assert.ok(JSON.stringify(payload).includes('Timezone restrictions: 8'));
});

test('captured 25943 acceptance tolerates Unicode hyphens, but rejects altered experience, pay and engagement',()=>{
  const q=structuredClone(acceptance);q.arrangements.text=q.arrangements.text.replace('full-time','full‑time').replace('1,500–3,000','1500—3000');
  assert.equal(validateSummary(q,sourceUnits(source)),q);
  for(const mutate of [x=>x.candidate.text=x.candidate.text.replace('8+ years','8 years'),x=>x.arrangements.text=x.arrangements.text.replace('1500—3000','1500—4000'),x=>x.arrangements.text=x.arrangements.text.replace('independent contractor','employee'),x=>x.arrangements.text=x.arrangements.text.replace('full‑time','part-time')]){
    const bad=structuredClone(q);mutate(bad);rejected(bad);
  }
});

const timedSource='Support client campaigns and maintain CRM records.\nPrepare reports and flag delivery problems.\nWorking hours: 9PM to 6AM PHT.\nEmployer work visa sponsorship and support are not provided for this role.\nMust have a laptop, internet and a backup connection.\nSalary: PHP 37,500–46,000 per month.\nFull-time employment.\nPermanent work from home setup.';
const timedSummary={version:1,about_role:{text:'You help the client team keep campaigns organised.',source_ids:[0]},actual_duties:{text:'Prepare reports and flag problems affecting delivery.',source_ids:[1]},candidate:{text:'You must have a laptop, internet and a backup connection. The employer does not provide visa sponsorship.',source_ids:[3,4]},arrangements:{text:'This full‑time role is remote, paying PHP 37500—46000 per month, with hours of 9:00 PM to 6:00 AM PHT.',source_ids:[2,5,6,7]}};
test('equivalent clock formatting, remote work wording and sponsorship negation preserve factual checks',()=>{
  assert.equal(validateSummary(timedSummary,sourceUnits(timedSource)),timedSummary);
  for(const mutate of [q=>q.arrangements.text=q.arrangements.text.replace('9:00','9:30'),q=>q.arrangements.text=q.arrangements.text.replace('PM','AM'),q=>q.arrangements.text=q.arrangements.text.replace('37500','38500'),q=>q.candidate.text=q.candidate.text.replace('does not provide','provides'),q=>q.candidate.text=q.candidate.text.replace('a backup connection','a connection'),q=>q.candidate.text+=' Visa sponsorship is available.']){
    const q=structuredClone(timedSummary);mutate(q);rejected(q,timedSource);
  }
});

test('remote application process is not evidence of remote working; unknown-pay clauses cannot hide invented benefits',()=>{
  const description=timedSource.replace('Permanent work from home setup.','Our 100% remote application process is available online.');
  rejected(timedSummary,description);
  const q=structuredClone(timedSummary);q.arrangements.text+=' Insurance is included; other pay is not specified.';rejected(q,timedSource);
});
