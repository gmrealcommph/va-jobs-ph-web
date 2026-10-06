import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layout} from '../src/render.js';
import {handle} from '../src/worker.js';
const props={title:'Test',body:'',description:'',canonical:'https://veeays.com/matches',user:{id:'preview'},profile:{full_name:'Alfred <Test>',plan:'pro',plan_status:'active'}};
test('member destinations, current state, escaped identity and integrated active Pro status',()=>{
const html=layout(props);assert.match(html,/href="\/matches" aria-current="page"/);assert.match(html,/Alfred/);assert.match(html,/class="member-pro"/);
for(const route of ['/matches','/my-jobs','/onboarding','/email-preferences','/pro','/logout'])assert.ok(html.includes(`href="${route}"`));
assert.match(html,/aria-controls="member-panel"/);assert.match(html,/aria-controls="mobile-panel"/);
const inactive=layout({...props,profile:{full_name:'<Alfred>',plan:'pro',plan_status:'inactive'}});assert.doesNotMatch(inactive,/class="member-pro"/);assert.match(inactive,/&lt;Alfred&gt;/);assert.match(inactive,/Explore VeeAys Pro/);
});
test('logout retains redirect and clears session cookies',async()=>{
const response=await handle(new Request('https://veeays.com/logout'),{SITE_URL:'https://veeays.com'});
assert.equal(response.status,303);assert.ok(response.headers.get('location'));assert.match(response.headers.get('set-cookie'),/Max-Age=0/i);
});
