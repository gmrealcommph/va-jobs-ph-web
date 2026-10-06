import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAtAGlance } from '../src/job-detail-read.js';

test('reference field order and leaked enums are normalized without changing data', () => {
  const job = {schedule_region:'uk_europe',location:'Worldwide',workplace_type:'remote',employment_type:'full_time',experience_level:'senior',engagement_type:'freelance'};
  const before = structuredClone(job);
  const html = renderAtAGlance(job);
  for (const value of ['UK / Europe','Remote','Full-time','Senior','Freelance']) assert.ok(html.includes(`>${value}</dd>`));
  const labels = [...html.matchAll(/<dt>(.*?)<\/dt>/g)].map(match => match[1]);
  assert.deepEqual(labels, ['Schedule','Location','Work setup','Employment type','Experience','Engagement']);
  assert.doesNotMatch(html, /uk_europe|full_time|>freelance<|Opportunity snapshot/);
  assert.deepEqual(job, before);
  assert.match(renderAtAGlance({engagement_type:'Custom <contract>'}), />Custom &lt;contract&gt;<\/dd>/);
});

test('snapshot normalizes display only and keeps four authoritative tile values', () => {
  const job = {schedule_region:'us',location:'Philippines',workplace_type:'remote',employment_type:'full_time'};
  const before = structuredClone(job);
  const html = renderAtAGlance(job);
  for (const value of ['US hours','Philippines','Remote','Full-time']) assert.ok(html.includes(`>${value}</dd>`));
  assert.equal((html.match(/class="qr-glance-tile"/g) || []).length, 4);
  assert.equal((html.match(/class="qr-glance-icon"/g) || []).length, 4);
  assert.match(html, /aria-labelledby="at-a-glance"/);
  assert.deepEqual(job, before);
});

test('checked schedule conventions and unknown employer wording survive safely', () => {
  for (const [raw,label] of [['uk','UK/Europe hours'],['australia','Australia hours'],['philippines','Philippines hours'],['Flexible/Any','Flexible/Any']]) {
    assert.ok(renderAtAGlance({schedule_region:raw}).includes(`>${label}</dd>`));
  }
  assert.ok(renderAtAGlance({location:'<img onerror="bad">',schedule_region:'Custom <hours>'}).includes('Custom &lt;hours&gt;'));
  assert.doesNotMatch(renderAtAGlance({location:'<img onerror="bad">'}), /<img/);
});

test('absent data is omitted and only an explicit true remote flag supplies fallback', () => {
  for (const job of [{},{remote:false},{remote:'true'},{schedule_region:' ',workplace_type:null}]) assert.equal(renderAtAGlance(job), '');
  assert.match(renderAtAGlance({remote:true}), />Remote<\/dd>/);
  const html = renderAtAGlance({remote:true,workplace_type:'Hybrid'});
  assert.match(html, />Hybrid<\/dd>/);
  assert.doesNotMatch(html, />Remote<\/dd>/);
});

test('experience and optional facts share the grid without mutation or omitted values', () => {
  const job = {location:'Philippines',workplace_type:'remote',employment_type:'full_time',experience_level:'senior'};
  const before = structuredClone(job);
  for (const [data,count] of [[job,4],[{...job,experience_level:null},3],[{...job,schedule_region:'us'},5],[{...job,schedule_region:'us',salary_min:1000,salary_currency:'USD',engagement_type:'Employee'},7]]) {
    const html = renderAtAGlance(data);
    assert.equal((html.match(/class="qr-glance-tile"/g) || []).length,count);
    assert.equal((html.match(/class="qr-glance-icon"/g) || []).length,count);
    assert.ok(html.includes(`--glance-count:${count}`));
    assert.doesNotMatch(html,/qr-glance-extra/);
  }
  assert.match(renderAtAGlance(job),/>Senior<\/dd>/);
  assert.match(renderAtAGlance({experience_level:'Custom <level>'}),/>Custom &lt;level&gt;<\/dd>/);
  assert.deepEqual(job,before);
});
