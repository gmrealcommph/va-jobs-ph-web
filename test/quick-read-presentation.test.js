import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceUnits,SECTIONS,validateSelection,validateStored} from '../src/quick-read-generation.js';
import {renderJobRead,renderAtAGlance} from '../src/job-detail-read.js';
import {presentQuickRead} from '../src/quick-read-presentation.js';
import {detail} from '../src/render.js';
const source=readFileSync(new URL('./fixtures/technologyadvice-37688.txt',import.meta.url),'utf8');
function payload() {
  const q=Object.fromEntries(SECTIONS.map(k=>[k,[]]));
  for(const u of sourceUnits(source)) {
    let key=u.is_heading?'other_details':u.section_hint==='unknown'?'company_overview':u.section_hint;
    if(/\b(application|apply|auto[- ]reject|screening|pre[- ]employment)\b/i.test(u.text)) key='application_notes';
    else if(/\b(authori[sz]|sponsorship|visa|permit|laptop|PC|computer|equipment|internet|backup|shift|schedule|PHT|timezone)\w*/i.test(u.text)) key='important_requirements';
    q[key].push(u.id);
  }
  return validateSelection(q,source);
}
const job={location:'Philippines',employment_type:'full_time',experience_level:'Entry Level',schedule_region:'philippines'};
const content=html=>html.split('<div class="qr-content">')[1]?.split('<details class="qr-source">')[0] || '';
test('37688 cleanup removes labels and SEO only after full validation, preserving material facts and original',()=>{
  const q=payload(), before=structuredClone(q);
  const view=presentQuickRead(q,source,job);
  assert.deepEqual(q,before);
  assert.deepEqual(validateStored(q,source),q);
  const html=renderJobRead(source,q,job), body=content(html);
  for(const label of ['The opportunity',"What you'll do",'Who you are','What we offer you','Salary Range','Monthly Pay Range','Work authorization']) assert.ok(!body.includes(`<li>${label}</li>`),label);
  for(const text of ['Originally posted on Himalayas','Categories:','Job functions:','Timezone restrictions: 8','Location: Philippines','Employment Type: Full-time','Employment Level: Entry Level','Seniority: Entry-level','Employment type: Full Time']) assert.ok(!body.includes(text),text);
  for(const key of ['responsibilities','requirements','nice_to_have','important_requirements','benefits','company_overview','application_notes']) {
    for(const line of q[key]) {
      if(/^(?:Work authorization|Timezone restrictions: 8)$/.test(line)) continue;
      assert.ok(view[key].includes(line),line);
    }
  }
  assert.ok(body.includes('9PM to 6AM PHT (Apr - Oct) or 10PM to 7AM PHT (Nov - Mar)'));
  assert.match(body,/<h3>Salary<\/h3>/);
  assert.ok(body.includes('Monthly Pay Range: ₱37,500—₱46,000 PHP'));
  assert.ok(view.application_notes.includes('Any AI-generated or incomplete application answers will be auto-rejected.'));
  const original=html.match(/<div class="qr-original">([\s\S]*?)<\/div>/)[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  assert.equal(original,source);
  assert.ok(!content(detail({...job,id:37688,description:source,quick_read:q})).includes('Location: Philippines'));
});
test('At a glance humanizes known codes without adding hours or transforming unknown labels',()=>{
  const html=renderAtAGlance(job);
  for(const value of ['Full-time','Philippines hours','Entry Level']) assert.ok(html.includes(value));
  assert.doesNotMatch(html,/9PM|6AM|full_time|>philippines</);
  assert.ok(renderAtAGlance({schedule_region:'Custom hours <check>'}).includes('Custom hours &lt;check&gt;'));
});
test('missing and conflicting structured metadata remains; corruption and omissions still fail closed',()=>{
  const q=payload();
  assert.ok(content(renderJobRead(source,q)).includes('Location: Philippines'));
  assert.ok(content(renderJobRead(source,q,{location:'Australia'})).includes('Location: Philippines'));
  for(const change of [v=>v.other_details.push('Invented salary'),v=>v.application_notes.pop(),v=>v.other_details.splice(v.other_details.indexOf('The opportunity'),1)]) {
    const bad=structuredClone(q);change(bad);
    assert.equal(validateStored(bad,source),null);
    assert.match(renderJobRead(source,bad,job),/Quick Read is unavailable/);
    assert.equal(content(renderJobRead(source,bad,job)),'');
  }
});
test('source taxonomy, substantive label-prefixed prose and salary without explicit currency/period remain conservative',()=>{
  const s=`About the role\nCategory: Insurance\nAccounts Officer handling finance operations.\nRequirements\n3+ years in end-to-end payroll, AP/AR and reconciliation required.\nMYOB and multi-entity experience preferred.\nWork authorization: Must maintain a work permit.\nSalary Range: Discussed at interview.\n37500–46000\n₱37,500–₱46,000`;
  const body=content(renderJobRead(s));
  for(const text of ['Category: Insurance','MYOB','work permit','Discussed at interview','37500–46000','₱37,500–₱46,000']) assert.ok(body.includes(text));
  assert.doesNotMatch(body,/month|PHP|Philippines/);
});
test('category/function metadata outside identified aggregator tail and meaningful timezone text survive',()=>{
  const q=payload();
  const s=source.replace('Originally posted on Himalayas','Source provenance unknown').replace('Timezone restrictions: 8','Timezone restrictions: Must overlap 8 hours with the team');
  // All IDs remain source-grounded through validation before projection.
  const changed=structuredClone(q);
  for(const key of SECTIONS) changed[key]=changed[key].map(t=>t.replace('Originally posted on Himalayas','Source provenance unknown').replace('Timezone restrictions: 8','Timezone restrictions: Must overlap 8 hours with the team'));
  const body=content(renderJobRead(s,changed));
  assert.ok(body.includes('Categories:'));assert.ok(body.includes('Job functions:'));
  assert.ok(body.includes('Must overlap 8 hours'));
});

test('monetary benefits retain their section and qualifiers',()=>{
  const validated={benefits:['PHP 1,000 monthly allowance, subject to policy.'],other_details:[]};
  const view=presentQuickRead(validated,'',{});
  assert.deepEqual(view.benefits,validated.benefits);
  assert.deepEqual(view.salary,[]);
});
