import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../src/worker.js';
import {layout} from '../src/render.js';
import {learningPage,resourcePaths} from '../src/learning-hub.js';
import {learningGuides,learningCategories} from '../src/learning-guides.js';
const original=globalThis.fetch;
afterEach(()=>globalThis.fetch=original);
const env={SITE_URL:'https://veeays.com'};
test('hub and six guides are public GET/HEAD pages, independent of upstream services',async()=>{
  globalThis.fetch=()=>{throw Error('Resources must not depend on upstream data');};
  assert.equal(resourcePaths.length,7);
  for(const path of resourcePaths){
    const r=await handle(new Request(env.SITE_URL+path),env),html=await r.text();
    assert.equal(r.status,200,path);
    assert.match(html,/name="robots"\s+content="index,follow"/);
    assert.ok(html.includes(`href="${env.SITE_URL+path}"`));
    assert.match(html,/name="description"\s+content="[^"]{50,}/);
    assert.equal((html.match(/<h1[ >]/g)||[]).length,1);
    assert.ok(html.includes('/learning-hub.css'));
    const head=await handle(new Request(env.SITE_URL+path,{method:'HEAD'}),env);
    assert.equal(head.status,200);assert.equal(await head.text(),'');
  }
});
test('all guide and category links resolve; no placeholder categories or fragment links',()=>{
  const allowed=new Set([...resourcePaths,'/jobs','/resume-studio','/contact']);
  for(const path of resourcePaths){
    const html=learningPage(path).body;
    for(const [,href] of html.matchAll(/href="([^"]+)"/g)){
      const [route,fragment]=href.split('#');
      if(route.endsWith('.css?v=20261021')) continue;
      assert.ok(!route||allowed.has(route),href);
      if(fragment){const target=learningPage(route||path).body;assert.ok(target.includes(`id="${fragment}"`),href);}
    }
  }
  for(const c of learningCategories)assert.ok(learningGuides.some(g=>g.category===c.id));
  for(const g of learningGuides){assert.ok(g.sections.length>=4);assert.ok(g.sections.map(s=>s[1]).join(' ').split(/\s+/).length>250);assert.ok(g.exercise.length>80);}
});
test('unknown resource slugs are real 404s; methods and staging indexing stay safe',async()=>{
  globalThis.fetch=()=>{throw Error('No upstream');};
  const missing=await handle(new Request(env.SITE_URL+'/resources/not-a-guide'),env);
  assert.equal(missing.status,404);assert.match(await missing.text(),/noindex,follow/);
  assert.equal((await handle(new Request(env.SITE_URL+'/resources',{method:'POST'}),env)).status,405);
  const stage=await handle(new Request('https://preview.example/resources'),env);
  assert.match(await stage.text(),/noindex,follow/);
});
test('shared anonymous, Free and Pro navigation retains every existing destination',()=>{
  for(const profile of [null,{full_name:'Preview Member',plan:'free'},{full_name:'Preview Pro',plan:'pro',plan_status:'active'}]){
    const html=layout({title:'Guide',description:'Guide',canonical:env.SITE_URL+'/resources/remote-job-applications',body:'',user:profile?{id:'synthetic'}:null,profile});
    for(const link of ['/','/categories','/resume-studio','/employers','/pro','/resources'])assert.ok(html.includes(`href="${link}"`));
    assert.equal((html.match(/href="\/resources" aria-current="page"/g)||[]).length,2);
    if(profile)for(const link of ['/matches','/my-jobs','/onboarding','/logout'])assert.ok(html.includes(`href="${link}"`));
    if(profile?.plan==='pro')assert.match(html,/Your Pro/);
    assert.match(html,/src="\/veeays-logo.png"/);
  }
});
test('page sitemap includes every published guide',async()=>{
  globalThis.fetch=async()=>Response.json([],{headers:{"content-range":"*/0"}});
  const r=await handle(new Request(env.SITE_URL+'/sitemaps/pages.xml'),{...env,SUPABASE_URL:'https://db.example',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'});
  assert.equal(r.status,200);const xml=await r.text();
  for(const path of resourcePaths)assert.ok(xml.includes(`<loc>${env.SITE_URL+path}</loc>`));
});


