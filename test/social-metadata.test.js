import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layout } from '../src/render.js';

test('social cards retain page-specific SEO and escape supplied values', () => {
  for (const canonical of ['https://veeays.com/', 'https://veeays.com/jobs/42', 'https://veeays.com/categories/Finance', 'https://veeays.com/email-preferences']) {
    const html = layout({title:'Accountant <Remote> & Co', description:'Work with "global" teams & grow.', canonical, body:'', noindex:canonical.endsWith('email-preferences')});
    for (const tag of ['property="og:title"', 'name="twitter:title"']) assert.ok(html.includes(tag + ' content="Accountant &lt;Remote&gt; &amp; Co"'));
    for (const tag of ['property="og:description"', 'name="twitter:description"']) assert.ok(html.includes(tag + ' content="Work with &quot;global&quot; teams &amp; grow."'));
    assert.ok(html.includes('href="' + canonical + '"'));
    assert.ok(html.includes('property="og:url" content="' + canonical + '"'));
    assert.ok(html.includes('content="' + (canonical.endsWith('email-preferences') ? 'noindex,follow' : 'index,follow') + '"'));
    assert.equal((html.match(/property="og:image"/g) || []).length, 1);
    assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
    for (const tag of ['property="og:image"', 'name="twitter:image"']) assert.ok(html.includes(tag + ' content="https://veeays.com/images/veeays-social-v1.png"'));
  }
});

test('declared social dimensions and type match the published PNG asset', () => {
  const png = readFileSync(new URL('../public/images/veeays-social-v1.png', import.meta.url));
  assert.equal(png.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
  const html = layout({title:'VeeAys', description:'Remote jobs', canonical:'https://veeays.com/', body:''});
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.ok(html.includes('property="og:image:width" content="1200"'));
  assert.ok(html.includes('property="og:image:height" content="630"'));
  assert.ok(html.includes('property="og:image:type" content="image/png"'));
  const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.assets.directory, './public');
});
