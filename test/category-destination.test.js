import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {listing,discoveryCard} from '../src/render.js';
import {handle} from '../src/worker.js';
const originalFetch=globalThis.fetch;
afterEach(()=>globalThis.fetch=originalFetch);
const job={id:101,title:'Account Manager',company:'Example',category:'Account Management',location:'Worldwide',remote:true,workplace_type:'Remote',posted_at:'2026-10-03T00:00:00Z'};
const options={rows:[job],total:17,page:2,search:'Excel & client',category:job.category,names:[job.category,'Sales'],categoryEntries:[{name:job.category,count:33},{name:'Sales',count:7}],publicJobTotal:40};
test('category destination separates full category count from searched totals and preserves pagination/search links',()=>{
 const html=listing(options);
 assert.match(html,/<h1>Account Management<br><em>jobs for Filipino talent\.<\/em><\/h1>/);
 assert.equal((html.match(/<h1>/g)||[]).length,1);
 assert.doesNotMatch(html,/Account Management opportunities|salary|Sort by|<select/);
 assert.match(html,/33 opportunities/);assert.match(html,/17 jobs matching your search · Showing 16–16/);
 assert.match(html,/Client relationships, partnerships, customer success and account growth/);
 assert.match(html,/placeholder="Search Account Management jobs…"/);
 assert.match(html,/action="\/categories\/Account%20Management" method="get"/);
 assert.match(html,/href="\/categories\/Sales\?q=Excel\+%26\+client"/);
 assert.match(html,/href="\/categories\/Account%20Management\?q=Excel\+%26\+client&amp;page=1"/);
 assert.match(html,/Newest first/);assert.match(html,/Remote &amp; worldwide/);
});
test('category cards retain native authenticated save/unsave destinations and anonymous intent',()=>{
 for(const saved of [true,false]){
  const html=discoveryCard(job,{categoryListing:true,user:{id:'user'},saved});
  assert.match(html,new RegExp(`action="/${saved?'unsave-job':'save-job'}"`));
  assert.match(html,/name="job_id" value="101"/);assert.match(html,/name="return_to" value="\/jobs\/101"/);
  assert.match(html,/Worldwide/);assert.match(html,/Remote/);assert.match(html,/Posted Oct 3, 2026/);
 }
 assert.match(discoveryCard(job,{categoryListing:true}),/signup\?return=%2Fjobs%2F101%3Fsave%3D1/);
 const absent=discoveryCard({id:2,title:'Role'},{categoryListing:true});assert.doesNotMatch(absent,/Worldwide|Remote|Posted/);
});
test('category editorial fallback is safe for new categories and escaped search/category text',()=>{
 const html=listing({...options,category:'<New & category>',search:'<script>',total:0,rows:[]});
 assert.match(html,/&lt;New &amp; category&gt;/);assert.match(html,/Explore opportunities that put your skills to work/);
 assert.match(html,/0 jobs matching your search/);assert.doesNotMatch(html,/<script>/);
});
test('category route retains data query, canonical, index/noindex and page identity with no added queries',async()=>{
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SITE_URL:'https://veeays.test'};
 for(const search of ['', 'Excel']){
  const calls=[];
  globalThis.fetch=async input=>{
   const url=new URL(input);calls.push(url);
   if(url.searchParams.get('select')==='category')return new Response(JSON.stringify(Array.from({length:33},()=>({category:job.category}))),{headers:{'content-range':'0-32/33'}});
   assert.equal(url.searchParams.get('category'),'eq.Account Management');assert.equal(url.searchParams.get('offset'),'15');
   assert.equal(url.searchParams.get('order'),'posted_at.desc.nullslast,id.asc');
   if(search)assert.match(url.searchParams.get('or'),/Excel/);
   return new Response(JSON.stringify([job]),{headers:{'content-range':'15-15/17'}});
  };
  const response=await handle(new Request(env.SITE_URL+'/categories/Account%20Management?page=2'+(search?'&q='+search:'')),env);
  const html=await response.text();assert.equal(response.status,200);assert.equal(calls.length,2);
  assert.match(html,/href="https:\/\/veeays.test\/categories\/Account%20Management\?page=2"/);
  assert.match(html,new RegExp(`content="${search?'noindex':'index'},follow"`));
  assert.match(html,/<title>Account Management — Page 2 \| VeeAys<\/title>/);
 }
});
