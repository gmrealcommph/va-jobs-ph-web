import {test, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {detail} from '../src/render.js';
import {handle} from '../src/worker.js';
const job={id:101,title:'Freelancer Support Specialist <Senior>',company:'Your Personal AI',job_url:'https://employer.example/role',source:'himalayas'};
const user={id:'u'};
const panel=options=>detail(job,options).split('<aside class="job-detail-sidebar">')[1].split('</aside>')[0];
test('application panel uses exact escaped identity and safe apply route, retaining attribution',()=>{
 const html=panel({user});
 assert.match(html,/YOUR APPLICATION/);assert.match(html,/Ready to make/);
 assert.match(html,/Freelancer Support Specialist &lt;Senior&gt;/);
 assert.match(html,/Your Personal AI/);assert.match(html,/>YP<\/div>/);
 assert.doesNotMatch(html,/OPPORTUNITY SNAPSHOT|<dl>|<dt>|Location|Workplace|Category|Posted/);
 assert.match(html,/href="\/apply\/101"\s+target="_blank"\s+rel="nofollow noopener"/);
 assert.match(html,/Opens the employer's listing in a new tab/);assert.match(html,/https:\/\/himalayas.app\//);
 assert.doesNotMatch(panel({user}),/Match score|Pro/);
 assert.doesNotMatch(detail({...job,job_url:'javascript:alert(1)'}),/href="\/apply\//);
});
test('save and unsave forms keep return intent and independent saved state',()=>{
 for(const saved of [false,true]) {
  const html=panel({user,saved});
  assert.match(html,new RegExp(`action="/${saved?'unsave':'save'}-job"`));
  assert.match(html,/name="return_to" value="\/jobs\/101"/);
  assert.match(html,saved?/♥ Unsave job/:/♡ Save for later/);
  assert.match(html,/action="\/mark-applied"/);
  assert.equal(/aria-current="step"/.test(html),saved);
 }
});
test('all application statuses render current state and leave later stages incomplete',()=>{
 for(const status of ['applied','interview','offer','hired','rejected','withdrawn']) {
  const html=panel({user,saved:false,application:{status}});
  assert.doesNotMatch(html,/action="\/mark-applied"/);
  assert.match(html,new RegExp(`Tracked · ${status[0].toUpperCase()+status.slice(1)}`));
  assert.match(html,/href="\/my-jobs"/);
  const steps=[...html.matchAll(/<li class="([^"]*)"([^>]*)>.*?<span>(Saved|Applied|Interview|Offer|Hired)<\/span>/g)];
  assert.equal(steps[0][1],'');
  if(['rejected','withdrawn'].includes(status)) {
   assert.equal(steps[2][1],'');assert.equal(steps[3][1],'');
   assert.match(html,new RegExp(`Current status: <strong>${status[0].toUpperCase()+status.slice(1)}</strong>`));
  } else assert.equal(steps.filter(step=>step[2].includes('aria-current')).length,1);
 }
});
test('anonymous panel never claims saved or tracked state and preserves signup intent',()=>{
 const html=panel({saved:true,application:{status:'offer'}});
 assert.match(html,/signup\?return=%2Fjobs%2F101%3Fsave%3D1/);
 assert.match(html,/Create a free VeeAys account/);
 assert.doesNotMatch(html,/is-complete|aria-current|Tracked ·|action="\/mark-applied"/);
});
const originalFetch=globalThis.fetch;
afterEach(()=>globalThis.fetch=originalFetch);
const env={SUPABASE_URL:'https://mock.example',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SITE_URL:'https://veeays.test'};
test('mark applied and status changes preserve persistence and detail redirects',async()=>{
 let mutation;
 globalThis.fetch=async(input,options)=>{
  if(new URL(input).pathname==='/auth/v1/user') return Response.json(user);
  mutation={url:new URL(input),options};return new Response(null,{status:204});
 };
 for(const [path,status] of [['/mark-applied','applied'],['/update-application','interview']]) {
  const res=await handle(new Request(env.SITE_URL+path,{method:'POST',headers:{cookie:'veeays_access=token',origin:env.SITE_URL},body:new URLSearchParams({job_id:'101',return_to:'/jobs/101',status})}),env);
  assert.equal(res.status,303);assert.equal(res.headers.get('location'),'/jobs/101'+(path==='/mark-applied'?'?tracked=1':''));
  assert.equal(mutation.url.pathname,'/rest/v1/job_applications');
  const payload=JSON.parse(mutation.options.body);assert.equal((Array.isArray(payload)?payload[0]:payload).status,status);
 }
});
test('apply requires auth, accepts only stored HTTP URLs and ignores supplied redirect',async()=>{
 let destination=job.job_url;
 globalThis.fetch=async input=>new URL(input).pathname==='/auth/v1/user'?Response.json(user):Response.json([{...job,job_url:destination}]);
 const req=auth=>new Request(env.SITE_URL+'/apply/101?redirect=https://evil.example',{headers:auth?{cookie:'veeays_access=token'}:{}});
 let res=await handle(req(false),env);assert.equal(res.status,303);assert.match(res.headers.get('location'),/signup\?return=%2Fapply%2F101$/);
 res=await handle(req(true),env);assert.equal(res.status,302);assert.equal(res.headers.get('location'),job.job_url);
 destination='javascript:alert(1)';res=await handle(req(true),env);assert.equal(res.status,404);
});
