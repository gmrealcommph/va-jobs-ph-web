import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceUnits,SECTIONS,validateSelection,validateStored,generateWithProvider} from '../src/quick-read-generation.js';
import {presentQuickRead} from '../src/quick-read-presentation.js';
import {renderJobRead} from '../src/job-detail-read.js';

// Genuine public Original description capture from https://veeays.com/jobs/41645,
// 2026-10-04 Asia/Manila. HTML entities decoded; not a production DB hash or
// recovered failed response. Every selection below is a local mock.
const source=readFileSync(new URL('./fixtures/video-editor-designer-41645.txt',import.meta.url),'utf8');
const start='HAVE WHAT IT TAKES TO BE OUR GRAPHIC DESIGNER / VIDEO EDITOR?';
const end='DAY IN THE LIFE OF A GRAPHIC DESIGNER / VIDEO EDITOR';
function selection(description=source) {
  const q=Object.fromEntries(SECTIONS.map(k=>[k,[]]));
  for(const u of sourceUnits(description)) {
    const key=u.id>=12 && u.id<=21?'requirements':u.id===11?'nice_to_have':
      u.id>=54 && u.id<=56?'application_notes':u.id===7 || u.id===9?'important_requirements':
      u.id>=3 && u.id<=6?'benefits':u.id>=23 && u.id<=49?'responsibilities':'other_details';
    q[key].push(u.id);
  }
  return q;
}
function move(q,id,key) {
  for(const k of SECTIONS) q[k]=q[k].filter(n=>n!==id);
  if(key) q[key].push(id);
  return q;
}
test('41645: exact headings support ten qualifications and end before duties',()=>{
  const units=sourceUnits(source);
  assert.equal(createHash('sha256').update(source).digest('hex'),'24b0bb39e8b87e87fe5365a07adc328b5d4a03f55968aed3a797cd6457b198b8');
  assert.equal(units.length,63);
  assert.equal(units[10].text,start);assert.equal(units[22].text,end);
  assert.ok(units[10].is_heading);assert.ok(units[22].is_heading);
  for(const u of units.slice(11,22)) assert.equal(u.section_hint,'requirements');
  for(const u of units.slice(23)) assert.notEqual(u.section_hint,'requirements');
  const payload=validateSelection(selection(),source);
  assert.deepEqual(payload.requirements,units.slice(12,22).map(u=>u.text));
  assert.deepEqual(payload.nice_to_have,[units[11].text]);
  assert.deepEqual(validateStored(payload,source),payload);
  // Reproduce the genuine qualification failure when the captured heading is
  // unknown (synthetic heading mutation, preserving genuine qualification text).
  const unknown=source.replace(start,`We discuss ${start} during onboarding.`);
  assert.equal(sourceUnits(unknown)[12].section_hint,'unknown');
  assert.throws(()=>validateSelection(selection(unknown),unknown),/unsupported_requirement/);
});
test('41645: genuine duties, benefits, preferences, application and metadata cannot upgrade',()=>{
  for(const id of [0,1,2,3,4,5,6,8,...Array.from({length:27},(_,n)=>23+n),50,51,52,53,57,58,59,60,61]) {
    assert.throws(()=>validateSelection(move(selection(),id,'requirements'),source),/unsupported_requirement/);
  }
  assert.throws(()=>validateSelection(move(selection(),11,'requirements'),source),/preference_upgraded/);
  for(const id of [7,9,54,55,56,62])
    assert.throws(()=>validateSelection(move(selection(),id,'requirements'),source),/unsupported_requirement|material_condition_misplaced|application_condition_misplaced/);
  for(const u of sourceUnits(source)) assert.throws(()=>validateSelection(move(selection(),u.id,null),source),/source_omitted/);
  const invalid=selection();invalid.requirements.unshift(999);
  assert.throws(()=>validateSelection(invalid,source),/invalid_source_reference/);
  const corrupt=validateSelection(selection(),source);corrupt.requirements.push('Invented qualification');
  assert.equal(validateStored(corrupt,source),null);
  assert.match(renderJobRead(source,corrupt,{}),/Quick Read is unavailable/);
});
test('41645: synthetic preference, mixed obligation and application probes stay fail closed',()=>{
  for(const [line,error] of [['Adobe certification preferred.','preference_upgraded'],['Adobe required; Canva preferred.','preference_upgraded'],['Incomplete application answers are auto-rejected.','application_condition_misplaced']]) {
    const changed=source.replace(start,`${start}\n${line}`);
    const units=sourceUnits(changed),id=units.find(u=>u.text===line).id;
    const q=Object.fromEntries(SECTIONS.map(k=>[k,[]]));q.other_details=units.map(u=>u.id);
    assert.throws(()=>validateSelection(move(q,id,'requirements'),changed),new RegExp(error));
    if(line.includes('required')) assert.throws(()=>validateSelection(move(q,id,'nice_to_have'),changed),/mixed_obligation/);
    assert.ok(validateSelection(move(q,id,line.includes('application')?'application_notes':line.includes('required')?'other_details':'nice_to_have'),changed));
  }
});
test('41645: mocked provider receives hints; presentation retains substantive source and original',async()=>{
  const payload=await generateWithProvider({OPENAI_API_KEY:'test-only',QUICK_READ_MODEL:'mock'},source,async(url,init)=>{
    const sent=JSON.parse(init.body);assert.equal(sent.store,false);
    assert.equal(JSON.parse(sent.input).source_units[12].section_hint,'requirements');
    return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(selection())}]}]});
  });
  const before=structuredClone(payload),view=presentQuickRead(payload,source,{});
  assert.deepEqual(payload,before);assert.deepEqual(view.requirements,payload.requirements);
  const visible=Object.values(view).filter(Array.isArray).flat();
  assert.ok(!visible.includes(start));assert.ok(!visible.includes(end));
  for(const id of [7,9,11,24,49,54,55,56]) assert.ok(visible.includes(sourceUnits(source)[id].text));
  const html=renderJobRead(source,payload,{});
  assert.ok(html.includes('8:00 PM to 5:00 AM (PH Time)'));
  assert.ok(html.includes('HAVE WHAT IT TAKES TO BE OUR GRAPHIC DESIGNER / VIDEO EDITOR?'));
});
