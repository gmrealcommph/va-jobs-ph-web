import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/worker.js';
import { categories, listJobs } from '../src/data.js';
import { safeUrl } from '../src/render.js';

const env = { SUPABASE_URL: 'https://nwqmhqiymtqkdihjadrp.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SITE_URL: 'https://jobs.example.com' };
const job = { id: '101', title: 'Virtual Assistant', company: 'Example Company', description: 'Support a growing team.', category: 'Admin & Support', location: 'Philippines', remote: true, workplace_type: 'Remote', source: 'Example', job_url: 'https://example.com/apply', posted_at: '2026-09-30T00:00:00Z', collected_at: '2026-10-01T00:00:00Z' };
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
function mock(rows = [job], total = rows.length) {
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.pathname, '/rest/v1/public_jobs');
    assert.equal(options.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
    assert.equal(options.headers.Authorization, undefined);
    const offset = Number(url.searchParams.get('offset'));
    const limit = Number(url.searchParams.get('limit'));
    const result = rows.slice(offset, offset + limit);
    return new Response(JSON.stringify(result), { headers: { 'content-range': `0-0/${total}` } });
  };
}
const request = path => new Request(env.SITE_URL + path);
test('home renders real job content without client JavaScript', async () => {
  mock(); const res = await handle(request('/'), env); const html = await res.text();
  assert.equal(res.status, 200); assert.match(html, /Virtual Assistant/); assert.match(html, /\/jobs\/101/); assert.doesNotMatch(html, /<script/); assert.match(html, /index,follow/);
});
test('category URL round-trips spaces and punctuation', async () => {
  mock(); const res = await handle(request('/categories/Admin%20%26%20Support'), env);
  assert.equal(res.status, 200); assert.match(await res.text(), /Admin &amp; Support/);
});
test('search is quoted and pagination/filtering happen in Supabase', async () => {
  let captured;
  globalThis.fetch = async input => { captured = new URL(input); return new Response('[]', { headers: { 'content-range': '*/0' } }); };
  await listJobs(env, { page: 3, search: 'hello),id.eq.1', category: 'Admin & Support' });
  assert.equal(captured.searchParams.get('offset'), '30');
  assert.equal(captured.searchParams.get('category'), 'eq."Admin & Support"');
  assert.match(captured.searchParams.get('or'), /title\.ilike\."\*hello\),id.eq.1\*"/);
  assert.equal(captured.searchParams.has('status'), false);
  assert.equal(captured.searchParams.has('philippines_eligible'), false);
});
test('job detail escapes content and rejects script application URLs', async () => {
  mock([{ ...job, title: '<script>alert(1)</script>', description: '<img src=x onerror=alert(1)>', job_url: 'javascript:alert(1)' }]);
  const html = await (await handle(request('/jobs/101'), env)).text();
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script|<img|href="javascript:/); assert.match(html, /application link is currently unavailable/);
});
test('missing jobs, unknown categories and invalid pages return 404', async () => {
  mock([]);
  for (const path of ['/jobs/missing', '/categories/Unknown', '/?page=-1', '/?page=2', '/missing']) assert.equal((await handle(request(path), env)).status, 404);
});
test('search results are noindex; page two has its own canonical', async () => {
  mock(Array.from({ length: 16 }, (_, i) => ({ ...job, id: String(i) })));
  let html = await (await handle(request('/?q=assistant'), env)).text(); assert.match(html, /noindex,follow/);
  html = await (await handle(request('/?page=2'), env)).text(); assert.match(html, /rel="canonical" href="https:\/\/jobs.example.com\/\?page=2"/); assert.match(html, /Page 2 of 2/);
});
test('upstream failure is 503 with retry header, never a false empty state', async () => {
  globalThis.fetch = async () => new Response('unavailable', { status: 503 });
  const res = await handle(request('/'), env); assert.equal(res.status, 503); assert.equal(res.headers.get('Retry-After'), '60'); assert.match(await res.text(), /noindex,follow/);
});
test('secret keys are rejected before any network request', async () => {
  globalThis.fetch = () => { throw new Error('Must not fetch'); };
  assert.equal((await handle(request('/'), { ...env, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_test' })).status, 503);
});
test('category scan respects upstream caps', async () => {
  let calls = 0;
  globalThis.fetch = async input => {
    const offset = Number(new URL(input).searchParams.get('offset')); calls++;
    return new Response(JSON.stringify([{ category: ['Admin', 'Design', 'Admin'][offset] }]), { headers: { 'content-range': `${offset}-${offset}/3` } });
  };
  assert.deepEqual(await categories(env), ['Admin', 'Design']); assert.equal(calls, 3);
});
test('sitemaps contain canonical job URLs and index endpoints', async () => {
  mock(); let res = await handle(request('/sitemap.xml'), env); assert.match(await res.text(), /sitemaps\/jobs-1.xml/);
  res = await handle(request('/sitemaps/jobs-1.xml'), env); assert.match(await res.text(), /https:\/\/jobs.example.com\/jobs\/101/);
  res = await handle(request('/sitemaps/pages.xml'), env); assert.match(await res.text(), /Admin%20%26%20Support/);
});
test('preview indexing is disabled and HEAD has no body', async () => {
  mock(); const preview = { ...env, SITE_URL: undefined };
  assert.match(await (await handle(request('/robots.txt'), preview)).text(), /Disallow: \//);
  const res = await handle(new Request(env.SITE_URL, { method: 'HEAD' }), env); assert.equal(res.status, 200); assert.equal(await res.text(), '');
});
test('safe application links and allowed methods', async () => {
  assert.equal(safeUrl('data:text/html,hi'), null); assert.equal(safeUrl('https://example.com'), 'https://example.com/');
  assert.equal((await handle(new Request(env.SITE_URL, { method: 'POST' }), env)).status, 405);
});

test('homepage branding is scoped away from category and detail content', async () => {
  mock();
  const home = await (await handle(request('/'), env)).text();
  assert.match(home, /Same skills\./);
  assert.match(home, /class="home-page"/);
  for (const path of ['/categories', '/categories/Admin%20%26%20Support', '/jobs/101']) {
    const res = await handle(request(path), env);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /aria-label="VeeAys home"/);
    assert.doesNotMatch(html, /class="home-page"|Same skills\./);
  }
});

test('search remains a GET form and category pagination retains the keyword', async () => {
  mock(Array.from({ length: 16 }, (_, i) => ({ ...job, id: String(i + 101) })));
  const html = await (await handle(request('/categories/Admin%20%26%20Support?q=assistant'), env)).text();
  assert.match(html, /action="\/categories\/Admin%20%26%20Support" method="get"/);
  assert.match(html, /name="q"[^>]*value="assistant"/);
  assert.match(html, /rel="next" href="\/categories\/Admin%20%26%20Support\?q=assistant&amp;page=2"/);
});

test('numeric job detail keeps the original application link and canonical', async () => {
  mock();
  const res = await handle(request('/jobs/101'), env);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /href="https:\/\/example.com\/apply" target="_blank" rel="noopener noreferrer nofollow"/);
  assert.match(html, /rel="canonical" href="https:\/\/jobs.example.com\/jobs\/101"/);
});
