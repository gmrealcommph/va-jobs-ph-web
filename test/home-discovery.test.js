import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {discoveryCard,listing} from '../src/render.js';
import {handle} from '../src/worker.js';
import {COLUMNS} from '../src/data.js';
const job={id:101,title:'Executive Assistant',company:'D2B',location:'Philippines',remote:true,workplace_type:'Remote',category:'Executive Assistant',description:'Excel and calendar support',posted_at:'2026-10-01T00:00:00Z'};
const options={rows:[job],total:42,page:1,search:'',category:'',names:['Executive Assistant','Marketing']};
const originalFetch=globalThis.fetch;afterEach(()=>{globalThis.fetch=originalFetch;});
test('homepage discovery remains server-rendered, search/category links compose and other listings stay unchanged',()=>{
  const home=listing(options);assert.match(home,/Fresh opportunities<br><em>for Filipino talent/);assert.match(home,/data-live-opportunity-count="42"/);assert.match(home,/Search by job title, skill or company/);
  assert.match(home,/id="discovery-q" name="q"/);assert.match(home,/action="\/#opportunities" method="get"/);assert.match(home,/class="discovery-card"|opportunity-card discovery-card/);
  assert.match(home,/>42<\/strong>/);assert.match(home,/home-discovery\.js/);assert.doesNotMatch(home,/class="discovery-salary"|opportunity-remote/);
  const searched=listing({...options,search:'Excel & VA'});assert.match(searched,/value="Excel &amp; VA"/);assert.match(searched,/\/categories\/Marketing\?q=Excel\+%26\+VA/);
  assert.doesNotMatch(listing({...options,browseOnly:true}),/discovery-card|home-discovery\.js|id="discovery-q"/);
  const category=listing({...options,category:'Executive Assistant'});
  assert.match(category,/category-jobs-page/);assert.match(category,/opportunity-card discovery-card/);
  assert.doesNotMatch(category,/home-discovery\.js|id="discovery-q"/);
});
test('cards preserve native job/category destinations, saved form fields and anonymous save intent; escape all content',()=>{
  const saved=discoveryCard(job,{user:{id:'user'},saved:true});assert.match(saved,/action="\/unsave-job"/);assert.match(saved,/name="job_id" value="101"/);assert.match(saved,/name="return_to" value="\/#opportunities"/);assert.match(saved,/href="\/jobs\/101"/);assert.match(saved,/href="\/categories\/Executive%20Assistant"/);assert.match(saved,/discovery-heart/);
  assert.match(discoveryCard(job,{user:{id:'user'}}),/action="\/save-job"/);assert.match(discoveryCard(job),/href="\/signup\?return=%2Fjobs%2F101%3Fsave%3D1"/);
  const escaped=discoveryCard({...job,title:'<script>bad</script>',company:'<img>',location:'<svg>',category:'<bad>'});assert.doesNotMatch(escaped,/<script|<img|<svg/);assert.match(escaped,/&lt;script&gt;bad/);assert.match(escaped,/&lt;img&gt;/);assert.match(escaped,/&lt;svg&gt;/);
});
test('salary uses only supplied positive integer USD enrichment and known period; missing or inconsistent data is omitted',()=>{
  const enriched={...job,employment_type:'full_time',engagement_type:'Contractor',salary_min_usd:1500,salary_max_usd:2000,salary_period:'monthly'};
  assert.match(discoveryCard(enriched),/full time/);assert.match(discoveryCard(enriched),/Contractor/);assert.match(discoveryCard(enriched),/\$1,500–\$2,000\/mo/);
  assert.match(discoveryCard({...enriched,salary_max_usd:null}),/From \$1,500\/mo/);
  assert.match(discoveryCard({...enriched,salary_min_usd:null}),/Up to \$2,000\/mo/);
  for(const changes of [{salary_period:null},{salary_period:'unknown'},{salary_min_usd:3000},{salary_min_usd:'1500'},{salary_min_usd:-1},{salary_max_usd:0},{salary_min_usd:null,salary_max_usd:null}])assert.doesNotMatch(discoveryCard({...enriched,...changes}),/class="discovery-salary"/);
  assert.doesNotMatch(discoveryCard({...job,description:'Compensation $2000 monthly'}),/class="discovery-salary"/);
  assert.doesNotMatch(COLUMNS,/salary_|employment_type|engagement_type/);
});
test('homepage query still searches existing public job fields and combines category constraints without additional data calls',async()=>{
  const requests=[];globalThis.fetch=async(input)=>{
    const url=new URL(input);requests.push(url);
    return new Response(JSON.stringify(url.searchParams.get('select')==='category'?[{category:'Executive Assistant'}]:[job]),{headers:{'content-range':'0-0/1'}});
  };
  const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SITE_URL:'https://veeays.test'};
  const response=await handle(new Request(env.SITE_URL+'/categories/Executive%20Assistant?q=Excel'),env);
  assert.equal(response.status,200);assert.equal(requests.length,2);
  const query=requests.find(url=>url.searchParams.get('select')===COLUMNS);assert.equal(query.searchParams.get('category'),'eq.Executive Assistant');assert.match(query.searchParams.get('or'),/title.ilike.*Excel.*company.ilike.*description.ilike/);
  assert.match(await response.text(),/name="q".*value="Excel"/);
});

