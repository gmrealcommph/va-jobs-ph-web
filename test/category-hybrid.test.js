import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {discoveryCard,listing} from '../src/render.js';
import {handle} from '../src/worker.js';
const original=globalThis.fetch;afterEach(()=>globalThis.fetch=original);
test('category cards omit descriptions while retaining metadata and native actions',()=>{
 const html=discoveryCard({id:1,title:'Role',company:'Company',category:'Sales',location:'Manila',remote:true,posted_at:'2026-10-01',description:'SECRET DESCRIPTION'},{categoryListing:true});
 assert.doesNotMatch(html,/SECRET DESCRIPTION|category-job-preview/);
 for(const value of ['Company','Role','Manila','Remote','Sales','Posted','Save','opportunity-arrow']) assert.ok(html.includes(value));
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
 const html=listing({category,rows:[],total:0,page:1,search:'',names:[category]});assert.match(html,/0 .* jobs<\/h2>/);assert.match(html,/category-workspace.webp/);assert.doesNotMatch(html,/name="(remote|employment_type|location)"/);
 }
});

test('sort uses immediate native submission and no Apply button',()=>{
 const html=listing({category:'Sales',rows:[],total:0,page:1,search:'client',names:['Sales']});
 assert.doesNotMatch(html,/>Apply<|name="page"/);
 assert.match(html,/name="q" value="client"/);
});
