import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAtAGlance } from '../src/job-detail-read.js';

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
