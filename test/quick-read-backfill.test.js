import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceUnits,SECTIONS,validateSelection,validateStored,generateWithProvider,sourceFingerprint} from '../src/quick-read-generation.js';
import {renderJobRead} from '../src/job-detail-read.js';
// Public HTML-decoded Original description GETs, 2026-10-05 Asia/Manila.
// Not historical database bytes or failed provider responses. All provider calls are mocks.
const env={OPENAI_API_KEY:'test-only',QUICK_READ_MODEL:'mock'};
const response=q=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(q)}]}]});
const empty=()=>Object.fromEntries(SECTIONS.map(k=>[k,[]]));
function move(q,id,key) { for(const k of SECTIONS) q[k]=q[k].filter(n=>n!==id);q[key].push(id);return q; }
for(const job of [386,387,388]) {
 const source=readFileSync(new URL(`./fixtures/backfill-${job}.txt`,import.meta.url),'utf8');
 test(`${job}: real section boundaries, complete source and explicit provider guard guidance`,async()=>{
  const units=sourceUnits(source),hash=await sourceFingerprint(source);
  const qualification=units.find(u=>u.text.startsWith(job===386?'Demonstrated success':'Minimum 5 years'));
  assert.equal(qualification.section_hint,'requirements');
  const duties=units.find(u=>u.text.startsWith(job===386?'Execute outbound':'Experience running'));
  assert.equal(duties.section_hint,'responsibilities');
  const q=empty();q.other_details=units.map(u=>u.id);move(q,qualification.id,'requirements');move(q,duties.id,'responsibilities');
  if(job!==386) {
   const extra=units.find(u=>u.text.startsWith('Experience with Salesforce'));
   assert.equal(extra.section_hint,'nice_to_have');move(q,extra.id,'nice_to_have');
   assert.throws(()=>validateSelection(move(structuredClone(q),extra.id,'requirements'),source),/preference_upgraded/);
   const benefit=units.find(u=>u.text==='Annual compensation review');assert.equal(benefit.section_hint,'benefits');move(q,benefit.id,'benefits');
  }
  const result=await generateWithProvider(env,source,async(url,init)=>{
   const body=JSON.parse(init.body),input=JSON.parse(body.input);
   assert.ok(input.requirement_supported_ids.includes(qualification.id));
   assert.equal(input.requirement_supported_ids.includes(duties.id),false);
   if(job===386) {
    const prose=units.find(u=>u.text.includes('preferred development platform'));
    assert.ok(input.preference_ids.includes(prose.id));
    assert.equal(input.requirement_supported_ids.includes(prose.id),false);
    assert.throws(()=>validateSelection(move(structuredClone(q),prose.id,'company_overview'),source),/preference_upgraded/);
   } else {
    const extra=units.find(u=>u.text.startsWith('Experience with Salesforce'));
    assert.ok(input.preference_ids.includes(extra.id));assert.equal(input.requirement_supported_ids.includes(extra.id),false);
   }
   assert.match(body.instructions,/only IDs eligible for requirements/);
   return response(q);
  });
  assert.deepEqual(validateStored(result,source),result);
  assert.deepEqual(SECTIONS.flatMap(k=>result[k]).sort(),units.map(u=>u.text).sort());
  await assert.rejects(generateWithProvider(env,source,async()=>response(move(structuredClone(q),duties.id,'requirements'))),/unsupported_requirement/);
  if(job===388) assert.ok(JSON.stringify(result).includes('Native Japanese level required with excellent command of English, both mandatory'));
  const html=renderJobRead(source,result);
  const encoded=html.match(/<div class="qr-original">([\s\S]*?)<\/div>/)[1];
  assert.equal(encoded.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'),source);
  assert.equal(await sourceFingerprint(source),hash);
 });
}
test('optional boundary with no explicit preference words stays optional; later unknown text is not invented as a requirement',()=>{
 const source='What we are looking for in you\nExcellent presentation skills with customers.\nAdditional skills that you might also bring\nExperience with a CRM\nWhat we offer colleagues\nAnnual holiday leave\nAbout Canonical\nSoftware company background.';
 const units=sourceUnits(source),q=empty();q.other_details=units.map(u=>u.id);
 assert.equal(units[3].section_hint,'nice_to_have');
 assert.throws(()=>validateSelection(move(structuredClone(q),3,'requirements'),source),/preference_upgraded/);
 assert.throws(()=>validateSelection(move(structuredClone(q),7,'requirements'),source),/unsupported_requirement/);
});

test('accepted 37688/41638/43639/41645/43635/41641 retain baseline units and every permitted/rejected section placement',()=>{
 const snapshots=JSON.parse(readFileSync(new URL('./fixtures/accepted-routing-baseline.json',import.meta.url),'utf8'));
 for(const [job,snapshot] of Object.entries(snapshots)) {
  const source=readFileSync(new URL(`./fixtures/${snapshot.file}`,import.meta.url),'utf8');
  const units=sourceUnits(source);assert.deepEqual(units,snapshot.units,job);
  for(const section of SECTIONS) for(const u of units) {
   const q=empty();q.other_details=units.map(n=>n.id);move(q,u.id,section);
   let accepted=true;try {validateSelection(q,source);}catch{accepted=false;}
   assert.equal(accepted,snapshot.allowed[section].includes(u.id),`${job}: ${u.id} -> ${section}`);
  }
 }
});
