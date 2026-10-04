import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceUnits,SECTIONS,validateSelection,validateStored} from '../src/quick-read-generation.js';
import {presentQuickRead} from '../src/quick-read-presentation.js';
import {renderJobRead} from '../src/job-detail-read.js';

// Evidence-only excerpts supplied in the request; not a captured 43639 payload.
const evidence=`Our Ideal Candidate
Prior experience as a receptionist, scheduler, or virtual assistant is a plus
Originally posted on Himalayas
Employment type: Full Time
Seniority: Entry-level`;
test('evidence excerpts preserve preference and isolate contradictory metadata',()=>{
  const selection=Object.fromEntries(SECTIONS.map(k=>[k,[]]));
  for(const u of sourceUnits(evidence)) selection[u.id===1?'nice_to_have':'other_details'].push(u.id);
  const payload=validateSelection(selection,evidence), before=structuredClone(payload);
  const view=presentQuickRead(payload,evidence,{employment_type:'part_time'});
  assert.deepEqual(view.conflicting_source_details,['Employment type: Full Time']);
  assert.deepEqual(view.source_metadata,['Seniority: Entry-level']);
  assert.deepEqual(view.nice_to_have,payload.nice_to_have);
  assert.deepEqual(payload,before);
  assert.deepEqual(validateStored(payload,evidence),payload);
  assert.match(renderJobRead(evidence,payload,{employment_type:'part_time'}),/<h3>Conflicting source details<\/h3>/);
  selection.nice_to_have=[];selection.requirements=[1];
  assert.throws(()=>validateSelection(selection,evidence),/preference_upgraded/);
});
test('exact headings establish context; prose does not (synthetic context probes)',()=>{
  for(const [heading,hint] of [['Our Ideal Candidate','requirements'],['Why Join WizeMentoring','benefits']]) {
    const source=`${heading}\nA factual source unit long enough for extraction.\nAnother factual source unit long enough for extraction.`;
    assert.equal(sourceUnits(source)[1].section_hint,hint);
    assert.equal(sourceUnits(source.replace(heading,`We discuss ${heading} during onboarding.`))[1].section_hint,'unknown');
  }
});
test('qualification context still rejects upgrades, mixed clauses, omitted units and misplaced applications (synthetic probes)',()=>{
  const source=`Our Ideal Candidate\nExcellent written and spoken English.\nReceptionist experience is a plus.\nExcel required; Outlook preferred.\nIncomplete application answers will be auto-rejected.\nOriginally posted on Himalayas\nEmployment type: Full Time`;
  const q=Object.fromEntries(SECTIONS.map(k=>[k,[]]));
  q.requirements=[1];q.nice_to_have=[2];q.application_notes=[4];q.other_details=[0,3,5,6];
  assert.ok(validateSelection(q,source));
  const move=(id,target)=>{
    const changed=structuredClone(q);
    for(const key of SECTIONS) changed[key]=changed[key].filter(n=>n!==id);
    if(target) changed[target].push(id);
    return changed;
  };
  assert.throws(()=>validateSelection(move(6,'requirements'),source),/unsupported_requirement/);
  assert.throws(()=>validateSelection(move(2,'requirements'),source),/preference_upgraded/);
  assert.throws(()=>validateSelection(move(3,'nice_to_have'),source),/mixed_obligation/);
  assert.throws(()=>validateSelection(move(4,'requirements'),source),/application_condition_misplaced/);
  assert.throws(()=>validateSelection(move(1,null),source),/source_omitted/);
});
test('heading noise suppressed, substantive duties preserved, unknown concatenations retained',()=>{
  const lines=['Scheduling & Calendar Management','Client Communication','Meeting Preparation & Follow-Up','Client Records & Onboarding','Task Tracking & Support','About WizeMentoring'];
  const view=presentQuickRead({responsibilities:[...lines,'Client Communication: Handle client messages.'],other_details:['About WizeMentoringWizeMentoring supports...']},'',{});
  assert.deepEqual(view.responsibilities,['Client Communication: Handle client messages.']);
  assert.deepEqual(view.other_details,['About WizeMentoringWizeMentoring supports...']);
});
test('salary differences and qualifiers survive (synthetic adversarial probes)',()=>{
  for(const metadata of ['Compensation: PHP 100,000–120,000 per monthly','Compensation: USD 100,000–100,000 per monthly','Compensation: PHP 100,000–100,000 per yearly']) {
    const fact='Salary package of 100,000 pesos per month.';
    const source=[fact,metadata,'Additional substantive source detail.'].join('\n');
    const view=presentQuickRead({benefits:[fact],other_details:[metadata]},source,{});
    assert.ok([...view.salary,...view.other_details].includes(metadata));
  }
});
test('separate exact source heading permits concatenation cleanup; original stays intact (synthetic probe)',()=>{
  const prose='WizeMentoring supports clients through a dedicated remote team.';
  const source=`About WizeMentoring\nAbout WizeMentoring${prose}\n${prose}`;
  const payload={company_overview:['About WizeMentoring',`About WizeMentoring${prose}`,prose]};
  const before=structuredClone(payload);
  assert.deepEqual(presentQuickRead(payload,source,{}).company_overview,[prose]);
  assert.deepEqual(payload,before);
  assert.deepEqual(presentQuickRead({company_overview:[`About WizeMentoring${prose}`]},source,{}).company_overview,[prose]);
});
