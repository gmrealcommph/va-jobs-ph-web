import test from 'node:test';
import assert from 'node:assert/strict';
import { formatQuickRead } from '../src/quick-read.js';
import { renderJobRead, renderAtAGlance } from '../src/job-detail-read.js';
import { readFileSync } from 'node:fs';
import { detail } from '../src/render.js';
const source = `About the role\nManage client operations and coordinate delivery.\nResponsibilities\n• Coordinate stakeholders and budgets.\n• Coordinate stakeholders and budgets.\nRequirements\n• 3–5 years of experience required.\n• Mortgage/banking experience and PMP preferred.\n• Must have PH work authorization; no sponsorship.\n• Night schedule; laptop, internet and backup connection required.\n• Pre-employment screening required.\nApplication notes\n• AI-generated or incomplete application answers will be auto-rejected.`;
test('exact duplicate removal, preferences and mandatory requirements retain their meaning',()=>{
  const q=formatQuickRead(source);
  assert.deepEqual(q.responsibilities,['Coordinate stakeholders and budgets.']);
  assert.deepEqual(q.nice_to_have,['Mortgage/banking experience and PMP preferred.']);
  assert.deepEqual(q.requirements,['3–5 years of experience required.']);
  assert.equal(q.important_requirements.length,3);
  assert.match(q.application_notes[0],/auto-rejected/);
});
test('missing salary/location never invented; source taxonomy conflicts stay visible',()=>{
  assert.equal(renderAtAGlance({description:source}), '');
  assert.equal(renderAtAGlance({remote:false}), '');
  const s=`About the role\nCategory: Insurance\nAccounts Officer handling finance operations.\nRequirements\n3+ years in end-to-end payroll, AP/AR and reconciliation required.\nMYOB and multi-entity experience preferred.`;
  const q=formatQuickRead(s);
  assert.ok(JSON.stringify(q).includes('Category: Insurance'));
  assert.match(q.nice_to_have[0],/MYOB/);
  assert.doesNotMatch(JSON.stringify(q),/salary|Philippines/);
  assert.match(renderAtAGlance({location:'Philippines',workplace_type:'Hybrid'}),/Hybrid/);
});
test('mixed required and preferred clauses are never reclassified or split',()=>{
  const q=formatQuickRead(source+'\nRequirements\nExcel required; Zoho preferred.');
  assert.ok(q.requirements.includes('Excel required; Zoho preferred.'));
});
test('unknown sections and all source conditions retained; duplicate company intro removed',()=>{
  const s=source+'\nAbout us\nWe serve technology clients worldwide.\nWe serve technology clients worldwide.\nSecurity policy:\nNever share customer passwords.';
  const q=formatQuickRead(s);
  assert.equal(q.company_overview.filter(x=>x==='We serve technology clients worldwide.').length,1);
  assert.ok(JSON.stringify(q).includes('Never share customer passwords.'));
});
test('original is untouched text, safely escaped, with a native keyboard-accessible toggle',()=>{
  const s=source+'\n\nA & B < 10; "quoted".\r\n';
  const html=renderJobRead(s);
  assert.match(html,/<details class="qr-source"><summary>/);
  const original=html.match(/<div class="qr-original">([\s\S]*?)<\/div>/)[1];
  const decoded=original.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  assert.equal(decoded,s);
});
test('short, unstructured, malformed and HTML descriptions use original fallback',()=>{
  for(const s of ['', 'Short listing', 'This is a long unstructured listing. '.repeat(15), '<p>Responsibilities</p><ul><li>Required equipment</li></ul>']) {
    assert.equal(formatQuickRead(s),null);
    assert.match(renderJobRead(s),/This listing is shown from the employer/);
    assert.doesNotMatch(renderJobRead(s),/<details/);
  }
});
test('responsive styles scoped to job details and source toggle has focus affordance',()=>{
  const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/qr-glance-tiles \{display:flex;flex-wrap:wrap/);
  assert.match(css,/container:glance \/ inline-size/);
  assert.match(css,/@container glance \(min-width:280px\) and \(max-width:539px\)/);
  assert.match(css,/@container glance \(max-width:279px\)/);
  assert.match(css,/qr-source summary:focus-visible/);
  assert.match(css,/qr-original \{white-space:pre-wrap;overflow-wrap:anywhere/);
});
test('job detail keeps authenticated actions, tracked state, anonymous intent and Apply route',()=>{
  const job={id:101,title:'Coordinator',company:'Example',description:source,job_url:'https://example.com/apply'};
  const html=detail(job,{user:{id:'u'}});
  for(const action of ['/save-job','/mark-applied','/apply/101']) assert.ok(html.includes(action));
  assert.match(html,/name="return_to" value="\/jobs\/101"/);
  assert.match(detail(job,{user:{id:'u'},saved:true,application:{status:'applied'}}),/\/unsave-job/);
  assert.match(detail(job,{user:{id:'u'},saved:true,application:{status:'applied'}}),/Tracked · Applied/);
  assert.match(detail(job),/\/signup\?return=%2Fjobs%2F101%3Fsave%3D1/);
});
