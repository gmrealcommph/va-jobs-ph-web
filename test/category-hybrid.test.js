import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {descriptionPreview,discoveryCard,listing} from '../src/render.js';
import {handle} from '../src/worker.js';
const original=globalThis.fetch;afterEach(()=>globalThis.fetch=original);
test('previews are plain escaped source text, bounded, and omit missing descriptions',()=>{
 const raw='<script>alert(1)</script><p>Real &amp; useful description <img src=x onerror=alert(2)></p>';
 assert.equal(descriptionPreview(raw),'Real & useful description');
 const html=discoveryCard({id:1,title:'Role',description:raw},{categoryListing:true});
 assert.match(html,/Real &amp; useful description/);assert.doesNotMatch(html,/alert|onerror|<img/);
 assert.ok(Array.from(descriptionPreview('word '.repeat(100))).length<=280);
 assert.doesNotMatch(discoveryCard({id:1,title:'Role'},{categoryListing:true}),/category-job-preview/);
});
test('oldest sort reaches database, preserves search/page links and leaves default canonical',async()=>{
 const calls=[];globalThis.fetch=async input=>{const u=new URL(input);calls.push(u);return new Response(JSON.stringify(u.searchParams.get('select')==='category'?Array.from({length:31},()=>({category:'Sales'})):[{id:1,title:'Sales role',category:'Sales'}]),{headers:{'content-range':'0-0/31'}})};
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SITE_URL:'https://veeays.test'};
 const response=await handle(new Request(env.SITE_URL+'/categories/Sales?q=client&sort=oldest&page=2'),env);
 assert.equal(response.status,200);assert.equal(calls.at(-1).searchParams.get('order'),'posted_at.asc.nullslast,id.asc');assert.equal(calls.at(-1).searchParams.get('offset'),'15');
 const html=await response.text();assert.match(html,/value="oldest" selected/);assert.match(html,/q=client&amp;sort=oldest&amp;page=3/);assert.match(html,/name="sort" value="oldest"/);assert.match(html,/noindex/);
});
test('multiple categories retain real headings, notes, and omit unsupported filters',()=>{
 for(const category of ['Account Management','Customer Support','Writing & Content']){
 const html=listing({category,rows:[],total:0,page:1,search:'',names:[category]});assert.match(html,/0 .* jobs<\/h2>/);assert.match(html,/category-workspace.svg/);assert.doesNotMatch(html,/name="(remote|employment_type|location)"/);
 }
});
