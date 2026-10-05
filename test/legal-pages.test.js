import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { layout } from '../src/render.js';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const env = { SITE_URL: 'https://veeays.com' };
const routes = ['/terms', '/privacy', '/refund-policy', '/contact'];
for (const path of routes) {
  test(`${path} is public, indexed and independent of job data`, async () => {
    globalThis.fetch = () => { throw new Error('Public legal pages must not need an upstream request'); };
    const response = await handle(new Request(env.SITE_URL + path), env);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /index,follow/);
    assert.ok(html.includes(`href="${env.SITE_URL + path}"`));
    assert.match(html, /Jocelle Parungao/);
    assert.match(html, /sole proprietor/);
    assert.match(html, /href="mailto:support@veeays.com"/);
    assert.match(html, /href="tel:\+639758104597"/);
    assert.match(html, /not live(?: yet)?/);
    for (const route of routes) assert.ok(html.includes(`href="${route}"`));
    const head = await handle(new Request(env.SITE_URL + path, { method: 'HEAD' }), env);
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  });
}
test('every shared layout has the four visible footer links', () => {
  for (const user of [null, { id: 'user' }]) {
    const html = layout({ title: 'Page', description: 'Description', canonical: env.SITE_URL, body: '', user });
    const footer = html.slice(html.indexOf('<footer'));
    for (const route of routes) assert.ok(footer.includes(`href="${route}"`));
    assert.match(footer, />Refund Policy<\/a>/);
    assert.match(footer, />Contact<\/a>/);
  }
});
test('copy distinguishes job tracking from applying and protects statutory rights', async () => {
  const terms = await (await handle(new Request(env.SITE_URL + '/terms'), env)).text();
  assert.match(terms, /does not submit an application/);
  assert.match(terms, /do not guarantee employment/);
  const refunds = await (await handle(new Request(env.SITE_URL + '/refund-policy'), env)).text();
  assert.match(refunds, /₱499\/month, cancel anytime/);
  assert.match(refunds, /does not currently process VeeAys transactions/);
  assert.match(refunds, /Nothing in this policy limits mandatory consumer rights/);
});
