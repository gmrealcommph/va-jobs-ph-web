import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {categories} from '../src/data.js';
import {categoryPage,categoryIllustrationNames} from '../src/category-page.js';
import {handle} from '../src/worker.js';
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SITE_URL:'https://veeays.test'};
test('optional live counts reuse capped category scan and preserve default names and sorting',async()=>{
  const rows=[{category:'Sales'},{category:'Marketing'},{category:'Sales'},{category:null},{category:' '},{category:'Writing & Content'}];
  let calls=0;
  globalThis.fetch=async(input)=>{
    const url=new URL(input);calls++;
    assert.equal(url.pathname,'/rest/v1/public_jobs');assert.equal(url.searchParams.get('select'),'category');
    const offset=Number(url.searchParams.get('offset'));
    return new Response(JSON.stringify(rows.slice(offset,offset+2)),{headers:{'content-range':`${offset}-${offset+1}/6`}});
  };
  assert.deepEqual(await categories(env),['Marketing','Sales','Writing & Content']);assert.equal(calls,3);
  calls=0;
  assert.deepEqual(await categories(env,{withCounts:true}),[{name:'Marketing',count:1},{name:'Sales',count:2},{name:'Writing & Content',count:1}]);assert.equal(calls,3);
});
test('directory has sixteen distinct local illustrations, intact links and whole-card anchors',()=>{
  assert.equal(categoryIllustrationNames.length,16);
  const html=categoryPage(categoryIllustrationNames.map(name=>({name,count:1})));
  assert.match(html,/Work that fits<br><em>your strengths\.<\/em>/);
  assert.match(html,/16 ways to find your next opportunity/);
  assert.equal((html.match(/class="category-card category-accent-/g)||[]).length,16);
  assert.equal((html.match(/1 job available/g)||[]).length,16);
  for(const name of categoryIllustrationNames) assert.ok(html.includes(`href="/categories/${encodeURIComponent(name)}"`));
  const icons=[...html.matchAll(/<svg viewBox="0 0 64 64"[^>]*>(.*?)<\/svg>/g)].map(match=>match[1]);
  assert.equal(new Set(icons).size,16);assert.doesNotMatch(html,/<script|Explore jobs ↗/);
  assert.match(categoryPage([{name:'<img onerror=alert(1)>',count:2}]),/&lt;img onerror=alert\(1\)&gt;/);
});
test('categories route uses live counts with no additional queries and retains shared layout',async()=>{
  let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify([{category:'Marketing'},{category:'Marketing'},{category:'Sales'}]),{headers:{'content-range':'0-2/3'}});};
  const response=await handle(new Request(env.SITE_URL+'/categories'),env),html=await response.text();
  assert.equal(response.status,200);assert.equal(calls,1);assert.match(html,/2 jobs available/);assert.match(html,/1 job available/);
  assert.match(html,/2 ways to find your next opportunity/);assert.match(html,/aria-label="VeeAys home"/);assert.match(html,/<footer/);
});
