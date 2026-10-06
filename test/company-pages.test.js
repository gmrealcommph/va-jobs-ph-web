import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { layout } from '../src/render.js';
import { companyPage } from '../src/company-pages.js';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const env = { SITE_URL: 'https://veeays.com' };
for (const route of ['/employers', '/about']) {
  test(`${route} responds to GET and HEAD without upstream services`, async () => {
    globalThis.fetch = () => { throw new Error('Unexpected network call'); };
    const response = await handle(new Request(env.SITE_URL + route), env);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /name="robots"\s+content="index,follow"/);
    assert.ok(html.includes(`href="${env.SITE_URL + route}"`));
    assert.match(html, /class="site-header"/);
    assert.match(html, /class="site-footer"/);
    for (const match of companyPage(route).body.matchAll(/href="(\/[^"#?]*)"/g)) {
      const target = await handle(new Request(env.SITE_URL + match[1]), env);
      // Job browsing requires job data; verified with the existing browse tests.
      if (match[1] !== '/jobs') assert.equal(target.status, 200, match[1]);
    }
    const head = await handle(new Request(env.SITE_URL + route, { method: 'HEAD' }), env);
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  });
}
test('guest/member shared header/footer route every company link to a live destination', async () => {
  for (const user of [null, { id: 'user' }]) {
    const html = layout({ title: 'Test', description: '', canonical: env.SITE_URL, body: '', user });
    const links = [...html.matchAll(/href="(\/(?:employers|about))"/g)];
    assert.deepEqual(links.map(m => m[1]), ['/employers', '/employers', '/employers', '/about']);
    for (const [, route] of links) assert.equal((await handle(new Request(env.SITE_URL + route), env)).status, 200);
    assert.doesNotMatch(html, /Post a job/);
    assert.match(html, /Employer enquiries/);
  }
});
test('employer CTA reflects availability and uses established support address', () => {
  const html = companyPage('/employers').body;
  assert.match(html, /Self-service job posting and paid employer listings are not live yet/);
  assert.match(html, /href="mailto:support@veeays.com\?subject=VeeAys%20employer%20enquiry"/);
  assert.equal(companyPage('/missing'), null);
});
