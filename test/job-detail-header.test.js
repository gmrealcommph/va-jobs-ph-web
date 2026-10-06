import test from 'node:test';
import assert from 'node:assert/strict';
import { detail } from '../src/render.js';
import { categoryVisual, categoryArtwork } from '../src/job-detail-header.js';
import { readFileSync } from 'node:fs';

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

test('dedicated artwork accepts category variants without matching unrelated support', () => {
  for (const category of ['Customer Support', ' CUSTOMER_support ', 'Customer-Service',
    'Customer Support / Service', 'Customer Service & Support', 'Customer Care', 'Customer Success']) {
    assert.equal(categoryArtwork(category)?.src, '/images/job-header-customer-support.png');
  }
  for (const category of [null, '', 'IT Support', 'Technical Support', 'Customer Research', 'Unknown', '<script>Customer Support</script>']) {
    assert.equal(categoryArtwork(category), null);
  }
});

test('support artwork is decorative and leaves all employer information in HTML', () => {
  const job = {id:7, category:'Customer Support', company:'Employer & Co',
    title:'Exact employer title <Senior> '.repeat(12), location:'Philippines',
    workplace_type:'On-site', posted_at:'2026-10-01', description:'Original description'};
  const before = structuredClone(job);
  const html = detail(job);
  const header = html.slice(html.indexOf('class="job-detail-hero-card'), html.indexOf('<section class="wrap job-detail-layout'));
  assert.deepEqual(job, before);
  assert.match(header, /src="\/images\/job-header-customer-support\.png" width="1678" height="937" alt=""/);
  assert.match(header, /class="jh-artwork" aria-hidden="true"/);
  assert.ok(!header.includes('jh-workspace'));
  assert.ok(!header.includes('jh-globe'));
  assert.ok(header.includes(job.title.replaceAll('<', '&lt;').replaceAll('>', '&gt;')));
  for (const text of ['Employer &amp; Co', 'Customer Support', 'Philippines', 'On-site', 'Posted ', 'FILIPINO TALENT · GLOBAL OPPORTUNITIES']) assert.ok(header.includes(text), text);
  assert.ok(!/plane|https?:/.test(header));
  const png = readFileSync(new URL('../public/images/job-header-customer-support.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), 1678);
  assert.equal(png.readUInt32BE(20), 937);
  assert.equal(png[25], 6, 'approved PNG retains RGBA transparency');
});
