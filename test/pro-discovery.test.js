import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {proPage,layout,matchesPage,listing} from '../src/render.js';
import {emailPreferences} from '../src/email-preferences.js';
const original=globalThis.fetch;afterEach(()=>{globalThis.fetch=original;});
test('public Pro page makes free access and pre-payment state explicit with working auth links',()=>{
 const html=proPage();
 for(const text of ['YOUR JOB SEARCH,','ON AUTOPILOT.','₱499/month','Cancel anytime','membership is coming soon','Every public job stays free.','Your top 3 personalized matches','Strong Match Alerts','Daily Job Digest'])assert.ok(html.includes(text),text);
 assert.match(html,/href="\/signup\?return=%2Fonboarding"/);
 assert.doesNotMatch(html,/checkout|thousands|AI|as they roll out/);
 assert.doesNotMatch(html,/current feed limit|product limit|Full ranked feed|full personalized feed|100-result|charge you|—/);
 assert.match(html,/Try your free matches →/);
 assert.match(html,/Your personalized job feed/);
 assert.match(proPage({user:{id:'u'},profile:{onboarding_completed:false}}),/href="\/onboarding"/);
 assert.match(proPage({user:{id:'u'},profile:{onboarding_completed:true}}),/href="\/matches"/);
 assert.doesNotMatch(proPage({isPro:true}),/membership is coming soon/);
});
test('navigation distinguishes Free and active Pro without changing plan',()=>{
 const props={title:'Test',body:'',canonical:'https://test',user:{id:'u'}};
 assert.match(layout({...props,profile:{plan:'free'}}),/Explore VeeAys Pro/);
 const pro=layout({...props,profile:{plan:'pro',plan_status:'active'}});
 assert.match(pro,/member-pro/);assert.doesNotMatch(pro,/Explore VeeAys Pro/);
});
test('locked panel uses only summary count and stays absent for unknown, zero, Pro or error',()=>{
 assert.match(matchesPage({summary:{locked_matches:97,total_matches:100}}),/97 more matches found/);
 for(const props of [{},{summary:{locked_matches:0,total_matches:100}},{summary:{is_pro:true,locked_matches:97}},{summary:{locked_matches:97},error:'Unavailable'}])assert.doesNotMatch(matchesPage(props),/more matches found/);
});
test('homepage discovery follows job content and does not appear on categories or browse-only',()=>{
 const props={rows:[{id:1,title:'Example'}],total:1,page:1,search:'',category:'',names:[]};
 const html=listing(props);assert.ok(html.indexOf('pro-discovery')>html.indexOf('discovery-card'));
 assert.doesNotMatch(listing({...props,browseOnly:true}),/pro-discovery/);
 assert.doesNotMatch(listing({...props,category:'Sales'}),/pro-discovery/);
});
test('Free email discovery has no writable controls and keeps saved preferences unchanged',async()=>{
 let writes=0;
 globalThis.fetch=async(url,init)=>{
  if(init.method==='PATCH')writes++;
  if(String(url).includes('/auth/v1/user'))return Response.json({id:'u'});
  if(String(url).includes('/profiles'))return Response.json([{plan:'free',plan_status:'active'}]);
  return Response.json([{email_strong_matches:true,daily_digest:true}]);
 };
 const response=await emailPreferences(new Request('https://test/email-preferences',{headers:{cookie:'veeays_access=token'}}),{SUPABASE_URL:'https://db.test',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'});
 const html=await response.text();assert.equal(response.status,200);assert.match(html,/Strong Match Alerts/);assert.match(html,/Daily Job Digest/);assert.match(html,/href="\/pro"/);assert.doesNotMatch(html,/role="switch"|type="submit"/);assert.equal(writes,0);
});

test('Pro comparison uses ordered accessible paper cards and preserves free access',()=>{
 const html=proPage();
 assert.doesNotMatch(html,/<table|pro-comparison-scroll|Not included/);
 assert.match(html,/role="group" aria-label="Find your fit: Free and VeeAys Pro"/);
 assert.ok(html.indexOf('id="pro-free-title"')<html.indexOf('id="pro-plus-title"'));
 for(const copy of ['You search.','VeeAys searches<br>with you.','Free to use','Everything in Free, plus:','Every public job stays free.','Pro adds matching, alerts and convenience, not access to jobs.'])assert.ok(html.includes(copy),copy);
});
test('Match filter claim follows existing Pro-only controls',()=>{
 const free=matchesPage({matches:[{job_id:1,title:'Role',match_score:92}],summary:{is_pro:false}});
 const pro=matchesPage({matches:[{job_id:1,title:'Role',match_score:92}],summary:{is_pro:true}});
 for(const id of ['match-salary','match-schedule','match-work']){
  assert.ok(!free.includes('id="'+id+'"'));
  assert.ok(pro.includes('id="'+id+'"'));
 }
});
