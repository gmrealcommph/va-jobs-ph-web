import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../src/worker.js';
const originalFetch=globalThis.fetch;afterEach(()=>globalThis.fetch=originalFetch);
test('sidebar counts reuse the public scan including uncategorized jobs; navigation retains search',async()=>{
 const jobs=[{category:'Customer Support'},{category:'Customer Support'},{category:'Sales'},{category:null}];let scans=0,listings=0;
 globalThis.fetch=async(input)=>{
 const url=new URL(input);
 if(url.searchParams.get('select')==='category'){scans++;const offset=Number(url.searchParams.get('offset'));return new Response(JSON.stringify(jobs.slice(offset,offset+2)),{headers:{'content-range':`${offset}-${offset+1}/4`}});}
 listings++;assert.equal(url.searchParams.get('category'),'eq.Customer Support');assert.ok(url.searchParams.get('or').includes('Excel'));return new Response('[]',{headers:{'content-range':'*/0'}});
 };
 const response=await handle(new Request('https://veeays.test/categories/Customer%20Support?q=Excel'),{SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SITE_URL:'https://veeays.test'});
 const html=await response.text();assert.equal(response.status,200);assert.equal(scans,2);assert.equal(listings,1);
 assert.match(html,/class="all-count" aria-label="4 public jobs">4/);assert.match(html,/aria-label="2 public jobs">2/);assert.match(html,/aria-label="1 public jobs">1/);
 assert.match(html,/aria-current="page"\s+href="\/categories\/Customer%20Support\?q=Excel"/);assert.match(html,/href="\/categories\/Sales\?q=Excel"/);assert.match(html,/href="\/\?q=Excel">Browse everything/);assert.doesNotMatch(html,/category-doodle|Find a role<br>/);
});
