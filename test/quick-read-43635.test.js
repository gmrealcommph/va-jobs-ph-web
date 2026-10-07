import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceUnits,SECTIONS,validateSelection,validateStored,generateWithProvider,sourceFingerprint} from '../src/quick-read-generation.js';
import {generateJob} from '../src/quick-read-service.js';
import {presentQuickRead} from '../src/quick-read-presentation.js';
import {renderJobRead} from '../src/job-detail-read.js';

// Genuine HTML-decoded public Original description GET, 2026-10-05 Asia/Manila,
// https://veeays.com/jobs/43635. Not historical DB bytes or failed provider output.
// All selections/provider responses below are local mocks. Synthetic additions
// are explicitly labeled and never become fixture data.
const source=readFileSync(new URL('./fixtures/business-development-43635.txt',import.meta.url),'utf8');
const response=q=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(q)}]}]});
function selection() {
  const q=Object.fromEntries(SECTIONS.map(k=>[k,[]]));
  for(const u of sourceUnits(source)) {
    const key=u.id>=21 && u.id<=28?'requirements':[3,29].includes(u.id)?'important_requirements':
      [6,7,8,10,12].includes(u.id)?'responsibilities':'other_details';
    q[key].push(u.id);
  }
  return q;
}
function move(q,id,key) {
  for(const k of SECTIONS) q[k]=q[k].filter(n=>n!==id);
  if(key) q[key].push(id);return q;
}
test('43635: genuine source boundaries and safe complete selection',()=>{
  const u=sourceUnits(source);assert.equal(u.length,36);
  assert.equal(createHash('sha256').update(source).digest('hex'),'2430d7fe36be3d353521a3ddfc13d48fcdb924da8cecb11930815066b5bd73fc');
  assert.equal(u[9].text,'Schedule appointments and demos of eZee Products/Services.');
  assert.equal(u[29].text,'Personal vehicle, laptop, and good internet connection');
  assert.equal(u[29].section_hint,'requirements');
  assert.equal(u[9].section_hint,'responsibilities');
  // Existing unrecognized competencies heading is distinct from material routing.
  assert.equal(u[13].is_heading,false);
  assert.equal(u[14].section_hint,'responsibilities');
  const q=validateSelection(selection(),source);
  assert.equal(q.requirements.length,8);assert.deepEqual(validateStored(q,source),q);
});
test('43635: genuine material matches reproduce failure; allowed sections retain safeguards',()=>{
  for(const [id,target] of [[0,'about_role'],[3,'about_role'],[9,'responsibilities'],[29,'requirements'],[35,'about_role']]) {
    assert.throws(()=>validateSelection(move(selection(),id,target),source),/material_condition_misplaced/);
    for(const allowed of ['important_requirements','application_notes','other_details'])
      assert.ok(validateSelection(move(selection(),id,allowed),source));
    for(const forbidden of ['about_role','responsibilities','nice_to_have','benefits','company_overview'])
      assert.throws(()=>validateSelection(move(selection(),id,forbidden),source),/material_condition_misplaced/);
  }
  // Other validators may reject before the material check; do not weaken them.
  assert.throws(()=>validateSelection(move(selection(),9,'requirements'),source),/unsupported_requirement/);
  assert.throws(()=>validateSelection(move(selection(),11,'responsibilities'),source),/application_condition_misplaced/);
  for(const u of sourceUnits(source)) assert.throws(()=>validateSelection(move(selection(),u.id,null),source),/source_omitted/);
  const q=selection();q.requirements.unshift(999);
  assert.throws(()=>validateSelection(q,source),/invalid_source_reference/);
  const corrupt=validateSelection(selection(),source);corrupt.requirements.push(sourceUnits(source)[29].text);
  assert.equal(validateStored(corrupt,source),null);
  assert.match(renderJobRead(source,corrupt,{}),/This listing is shown from the employer/);
});
test('43635: guidance exposes exact guard matches and preference/application precedence (local mocks)',async()=>{
  const env={OPENAI_API_KEY:'test-only',QUICK_READ_MODEL:'mock'};
  const payload=await generateWithProvider(env,source,async(url,init)=>{
    const sent=JSON.parse(init.body),input=JSON.parse(sent.input);
    assert.equal(sent.store,false);assert.equal(sent.text.format.strict,true);
    assert.deepEqual(input.material_condition_ids,[0,3,9,29,35]);
    assert.deepEqual(input.application_note_ids,[11]);
    assert.deepEqual(input.source_units,sourceUnits(source));
    assert.match(sent.instructions,/section_hint does not override this restriction/);
    assert.match(sent.instructions,/Use other_details for keyword matches that describe ordinary duties/);
    assert.match(sent.instructions,/Existing preference and application routing rules take precedence/);
    return response(selection());
  });
  for(const [id,target] of [[0,'about_role'],[3,'about_role'],[9,'responsibilities'],[29,'requirements'],[35,'about_role']]) {
    const corrected=await generateWithProvider(env,source,async()=>response(move(selection(),id,target)));
    assert.ok(corrected.other_details.includes(sourceUnits(source)[id].text));
    assert.deepEqual(validateStored(corrected,source),corrected);
  }
  let finish;
  const result=await generateJob(env,'43635',{call:async(e,name,args)=>name==='claim_job_quick_read_recovery'
    ?{status:'claimed',description:source,source_hash:await sourceFingerprint(source)}
    :(finish=args,{status:'ready'}),generate:async()=>payload});
  assert.equal(result.status,'ready');assert.equal(finish.p_error,null);
  const bad=await generateJob(env,'43635',{call:async(e,name,args)=>name==='claim_job_quick_read_recovery'
    ?{status:'claimed',description:source,source_hash:await sourceFingerprint(source)}
    :(finish=args,{status:'failed'}),generate:async()=>validateSelection(move(selection(),29,'requirements'),source)});
  assert.equal(bad.error,'material_condition_misplaced');assert.equal(finish.p_payload,null);
});
test('43635: provider correction preserves all units and rejects unrelated corruption',async()=>{
  const env={OPENAI_API_KEY:'test-only',QUICK_READ_MODEL:'mock'};
  const q=selection();
  for(const [id,key] of [[0,'about_role'],[3,'about_role'],[9,'responsibilities'],[29,'requirements'],[35,'about_role']]) move(q,id,key);
  const result=await generateWithProvider(env,source,async()=>response(q));
  assert.deepEqual(SECTIONS.flatMap(k=>result[k]).sort(),sourceUnits(source).map(u=>u.text).sort());
  for(const [id,key,error] of [[11,'responsibilities','application_condition_misplaced'],[9,'requirements','unsupported_requirement'],[6,null,'source_omitted']])
    await assert.rejects(generateWithProvider(env,source,async()=>response(move(selection(),id,key))),new RegExp(error));
  const duplicate=move(selection(),29,'requirements');duplicate.other_details.push(29);
  await assert.rejects(generateWithProvider(env,source,async()=>response(duplicate)),/invalid_source_reference/);
  const repeated=move(selection(),29,'requirements');repeated.requirements.push(29);
  await assert.rejects(generateWithProvider(env,source,async()=>response(repeated)),/invalid_source_reference/);
  const invalid=move(selection(),29,'requirements');invalid.other_details.push(999);
  await assert.rejects(generateWithProvider(env,source,async()=>response(invalid)),/invalid_source_reference/);
  const unknown=selection();unknown.extra=[];
  await assert.rejects(generateWithProvider(env,source,async()=>response(unknown)),/invalid_schema/);
});
test('43635: synthetic material/preference/mixed/application probes remain fail closed',()=>{
  for(const [line,allowed,error] of [['Laptop preferred.','nice_to_have','preference_upgraded'],['Laptop required; backup preferred.','other_details','preference_upgraded'],['Must supply equipment for pre-employment screening.','application_notes','application_condition_misplaced']]) {
    const changed=source.replace('Requirements:',`Requirements:\n${line}`),u=sourceUnits(changed);
    const id=u.find(x=>x.text===line).id,q=Object.fromEntries(SECTIONS.map(k=>[k,[]]));q.other_details=u.map(x=>x.id);
    assert.throws(()=>validateSelection(move(q,id,'requirements'),changed),new RegExp(error));
    assert.ok(validateSelection(move(q,id,allowed),changed));
    if(line.includes('backup')) assert.throws(()=>validateSelection(move(q,id,'nice_to_have'),changed),/mixed_obligation/);
  }
});
test('43635: presentation keeps material prose and entire Original, without mutation',()=>{
  const payload=validateSelection(selection(),source),before=structuredClone(payload);
  const view=presentQuickRead(payload,source,{}),visible=Object.values(view).filter(Array.isArray).flat();
  assert.deepEqual(payload,before);
  for(const id of [0,3,9,11,29]) assert.ok(visible.includes(sourceUnits(source)[id].text));
  assert.ok(!visible.includes('Timezone restrictions: 8'));
  const html=renderJobRead(source,payload,{});
  const original=html.match(/<div class="qr-original">([\s\S]*?)<\/div>/)[1]
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  assert.equal(original,source);
});
