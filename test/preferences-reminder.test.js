import {test, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {layout} from '../src/render.js';
import {handle} from '../src/worker.js';
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
const env={SITE_URL:'https://jobs.example.com',SUPABASE_URL:'https://fixture.example',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
function fixture(completed){globalThis.fetch=async input=>{const path=new URL(input).pathname;if(path==='/auth/v1/user')return Response.json({id:'member'});if(path==='/rest/v1/profiles')return Response.json([{id:'member',onboarding_completed:completed}]);throw Error(path);};}

test('shared reminder appears only for incomplete signed-in members outside onboarding',()=>{
 const options={title:'Jobs',canonical:env.SITE_URL+'/categories/VA',body:'FREE BROWSING',user:{id:'member'},profile:{onboarding_completed:false},showPreferencesPrompt:true};
 const html=layout(options);assert.match(html,/data-preferences-reminder/);assert.match(html,/href="\/onboarding">Finish my preferences/);assert.match(html,/3 short steps/);assert.match(html,/FREE BROWSING/);assert.equal((html.match(/data-preferences-reminder/g)||[]).length,1);
 for(const changes of [{user:null},{profile:{onboarding_completed:true}},{profile:null},{showPreferencesPrompt:false},{canonical:env.SITE_URL+'/onboarding'}])assert.doesNotMatch(layout({...options,...changes}),/data-preferences-reminder/);
});
test('authenticated route gates reminder using actual profile and dismissal cookie, without writes',async()=>{
 for(const [completed,cookie,visible] of [[false,'',true],[true,'',false],[false,'; veeays_preferences_prompt_dismissed=1',false]]){
  fixture(completed);const res=await handle(new Request(env.SITE_URL+'/privacy',{headers:{cookie:'veeays_access=fixture'+cookie}}),env);
  assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');assert.equal((await res.text()).includes('data-preferences-reminder'),visible);
 }
});
test('Not now hides immediately, survives same-session navigation and records existing dismissal',()=>{
 const source=readFileSync(new URL('../public/preferences-reminder.js',import.meta.url),'utf8');const saved=new Map();let listener,requests=0;
 const storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 function run(){const card={hidden:false,querySelector:()=>({addEventListener:(name,fn)=>{listener=fn;}})};const document={querySelector:()=>card,cookie:''};runInNewContext(source,{document,sessionStorage:storage,fetch:()=>{requests++;return Promise.resolve();}});return {card,document};}
 const first=run();let prevented=false;listener({preventDefault(){prevented=true;}});assert.ok(prevented);assert.ok(first.card.hidden);assert.match(first.document.cookie,/Max-Age=604800/);assert.equal(requests,1);assert.ok(run().card.hidden);
});
test('existing dismissal endpoint retains seven-day suppression',async()=>{
 fixture(false);const res=await handle(new Request(env.SITE_URL+'/dismiss-preferences-prompt',{headers:{cookie:'veeays_access=fixture'}}),env);
 assert.equal(res.status,303);assert.match(res.headers.get('set-cookie'),/veeays_preferences_prompt_dismissed=1;.*Max-Age=604800/);
});
