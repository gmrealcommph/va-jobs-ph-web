import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceUnits,isRedundantTimezoneList,SECTIONS,validateSelection,validateStored,organizeWithProvider as generateWithProvider} from '../src/quick-read-generation.js';
const offsets='-11, -10, -9.5, -9, -8, -7, -6, -5, -4, -3.5, -3, -2, -1, 0, 1, 2, 3, 3.5, 4, 4.5, 5, 5.5, 5.75, 6, 6.5, 7, 8, 8.75, 9, 9.5, 10, 10.5, 11, 12, 12.75, 13, 14';
const broad='Timezone restrictions: '+offsets;
const base='About the role\nSupport customers and resolve their questions through clear written communication.\nWork schedule: must overlap with US Eastern business hours.\nPreferred Qualifications\nExperience with a CRM is preferred.';
const selection=source=>Object.fromEntries(SECTIONS.map(k=>[k,k==='other_details'?sourceUnits(source).map(u=>u.id):[]]));
test('only a complete standalone aggregator list is omitted',()=>{
 assert.equal(isRedundantTimezoneList(broad),true);
 assert.equal(isRedundantTimezoneList('Timezone restrictions: '+offsets.split(', ').reverse().join(', ')),true);
 for(const text of ['Timezone restrictions: 8','Timezone restrictions: 2, 8','Timezone restrictions: 0, 2, 3, 8',broad+', must work US hours',broad.replace(', 8.75','')]) assert.equal(isRedundantTimezoneList(text),false,text);
 assert.equal(sourceUnits(base+'\n'+broad).some(u=>u.text===broad),false);
 assert.ok(sourceUnits(base+'\n'+broad).some(u=>u.text.includes('US Eastern')));
});
test('narrow timezone metadata does not inherit preferred qualification context',()=>{
 const source=base+'\nTimezone restrictions: 8';
 const units=sourceUnits(source),u=units.at(-1);assert.equal(u.section_hint,'unknown');
 const q=selection(source);q.other_details=q.other_details.filter(id=>id!==u.id);q.important_requirements=[u.id];
 assert.ok(validateSelection(q,source).important_requirements.includes(u.text));
});
test('old caches drop redundant metadata while retaining explicit schedules',()=>{
 const source=base+'\n'+broad;const p=validateSelection(selection(source),source);p.other_details.push(broad);
 const read=validateStored(p,source);assert.ok(read);assert.ok(!JSON.stringify(read).includes(broad));assert.ok(JSON.stringify(read).includes('US Eastern'));
});
test('meaningful schedules cannot be omitted and invalid references remain blocked',()=>{
 const q=selection(base);q.other_details=q.other_details.filter(id=>!sourceUnits(base)[id].text.includes('US Eastern'));
 assert.throws(()=>validateSelection(q,base),/source_omitted/);
 const bad=selection(base);bad.other_details.push(999);assert.throws(()=>validateSelection(bad,base),/invalid_source_reference/);
});
test('provider receives filtered units and strict selection still succeeds',async()=>{
 const source=base+'\n'+broad;
 const result=await generateWithProvider({OPENAI_API_KEY:'test',QUICK_READ_MODEL:'gpt-5-mini'},source,async(url,options)=>{
  const body=JSON.parse(options.body),input=JSON.parse(body.input);
  assert.equal(input.source_units.some(u=>u.text===broad),false);
  assert.ok(input.source_units.some(u=>u.text.includes('US Eastern')));
  return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(selection(source))}]}]})};
 });assert.ok(result);
});
