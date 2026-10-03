import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {matchesPage} from '../src/render.js';
const preferences={target_roles:['Executive Assistant'],minimum_salary_usd:1000,schedule_preferences:['flexible'],employment_types:['full_time'],experience_level:'senior',skills:['Excel']};
const job={job_id:7,company:'D2B',title:'NZ/AU Senior Executive Assistant - Dayshift Remote',location:'Philippines',match_score:100,available_dimensions:4,category:'Executive Assistant',employment_type:'full_time',engagement_type:'Contractor',salary_period:'monthly',salary_min_usd:1500,schedule_region:'Australia',experience_level:'senior',skills:['Excel'],role_match:true,salary_match:true,employment_match:true,experience_match:true,skills_match:true};
test('compact feed keeps score, confidence, all explanations, metadata and exact Save/Unsave payloads',()=>{
  const html=matchesPage({matches:[job,{...job,job_id:8,match_score:90}],preferences,summary:{is_pro:true},savedJobIds:['7']});
  assert.match(html,/100%<\/strong> MATCH/);assert.match(html,/Good confidence/);
  for(const text of ['Role fit','Skills','Salary','Schedule flexible','Work type','Experience','Philippines','full time','Contractor'])assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/Based on .* matching factor/);
  assert.match(html,/action="\/unsave-job"/);assert.match(html,/action="\/save-job"/);
  assert.match(html,/name="return_to" value="\/matches"/);assert.match(html,/name="job_id" value="7"/);assert.match(html,/href="\/jobs\/7"/);
  assert.match(html,/♥<\/span> Saved/);assert.match(html,/♡<\/span> Save/);
  assert.ok(html.indexOf('data-original-order="0"')<html.indexOf('data-original-order="1"'));
  for(const id of ['visible-match-count','match-sort','match-salary','match-schedule','match-work','match-90','match-clear'])assert.ok(html.includes(`id="${id}"`),id);
  assert.doesNotMatch(html,/PERSONALIZED JOB FEED|Refine the feed without changing/);
  assert.match(html,/matches for you/);assert.match(html,/<span>PRO<\/span>/);
  assert.match(html,/<svg class="matches-discovery"[^>]*aria-hidden="true"/);
  assert.equal((html.match(/class="matches-discovery"/g)||[]).length,1);
  assert.match(html,/title="NZ\/AU Senior Executive Assistant - Dayshift Remote"/);
  assert.match(html,/<script src="\/match-filters.js" defer><\/script>/);assert.doesNotMatch(html,/<script>/);
});
test('free, empty, error and unknown-factor states retain existing entitlement and fallback behavior',()=>{
  const free=matchesPage({matches:[job],preferences,summary:{is_pro:false,total_matches:100,locked_matches:97}});
  assert.match(free,/Unlock 97 more matches/);assert.doesNotMatch(free,/id="match-sort"|match-filters\.js/);
  assert.match(matchesPage(),/No matches yet/);
  const error=matchesPage({error:'<error>',summary:{is_pro:true}});assert.match(error,/&lt;error&gt;/);assert.doesNotMatch(error,/No matches yet|match-filters\.js/);
  const sparse=matchesPage({matches:[{job_id:9,match_score:50,available_dimensions:0}],summary:{is_pro:true}});
  assert.match(sparse,/Limited data/);assert.match(sparse,/Company not specified/);assert.doesNotMatch(sparse,/class="match-reasons"/);
  const escaped=matchesPage({matches:[{...job,title:'<script>bad</script>',company:'<img>'}]});assert.match(escaped,/&lt;script&gt;bad/);assert.match(escaped,/&lt;img&gt;/);
});
test('external filter asset is local and retains filtering, stable ties and clear behavior',async()=>{
  const script=await readFile(new URL('../public/match-filters.js',import.meta.url),'utf8');
  assert.match(script,/score >= 90/);assert.match(script,/salaryPeriod === 'monthly'/);assert.match(script,/Number\(a.dataset.originalOrder\) - Number\(b.dataset.originalOrder\)/);
  assert.match(script,/clear\?\.addEventListener/);assert.doesNotMatch(script,/fetch\(|localStorage|supabase/);
});
