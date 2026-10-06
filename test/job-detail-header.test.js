import test from 'node:test';
import assert from 'node:assert/strict';
import { detail } from '../src/render.js';
import { categoryVisual } from '../src/job-detail-header.js';

test('header preserves employer text, escapes unsafe fields and does not mutate job data', () => {
  const job = {id:42,title:'Senior Fund Accountant <Global> & Reporting '.repeat(6),company:'Employer <script>alert(1)</script>'.repeat(5),category:'Finance & Accounting',location:'philippines',workplace_type:'remote',posted_at:'2026-10-01',description:'Original employer description.',job_url:'https://example.com/apply'};
  const before = structuredClone(job);
  const html = detail(job);
  assert.deepEqual(job, before);
  assert.ok(html.includes(job.title.replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('& Reporting','&amp; Reporting')));
  assert.ok(!html.includes('<script>alert'));
  assert.match(html, /href="\/categories\/Finance%20%26%20Accounting"/);
  assert.match(html, /data-visual="finance"/);
  assert.match(html, /href="\/#opportunities"/);
  assert.match(html, /href="\/apply\/42"/);
  assert.match(html, /Original employer description\./);
  const header = html.slice(html.indexOf('class="job-detail-hero-card'), html.indexOf('<section class="wrap job-detail-layout'));
  assert.ok(!/plane|PH<|WORLD<|https?:/.test(header));
  assert.match(header, /FILIPINO TALENT · GLOBAL OPPORTUNITIES/);
  assert.equal((header.match(/<h1>/g)||[]).length, 1);
});

test('category visuals are static with an unknown-category fallback', () => {
  for (const [category,family] of [['Finance','finance'],['Social Media','marketing'],['Customer Support','support'],['Design / Video','design'],['Operations / VA / PM','operations'],['Sales','sales'],['E-commerce','commerce'],['Tech','tech'],['Unknown','generic'],[null,'generic']]) assert.equal(categoryVisual(category),family);
  const html = detail({id:1,title:'Role',workplace_type:'On-site'});
  assert.ok(!html.includes('>Remote</text>'));
  assert.ok(!html.includes('Posted </span>'));
  assert.match(html,/data-visual="generic"/);
});
