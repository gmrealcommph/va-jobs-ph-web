import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layout,proPage,matchesPage} from '../src/render.js';
const props={title:'Test',body:'',canonical:'https://veeays.com/jobs',user:{id:'member'}};
test('members can reach Pro without opening desktop or mobile account menus',()=>{
 for(const profile of [null,{plan:'free'},{plan:'pro',plan_status:'inactive'},{plan:'pro',plan_status:'active',pro_expires_at:'2020-01-01'}]){
  const html=layout({...props,profile});
  assert.match(html,/<nav class="discovery-nav"[^>]*>[^]*?href="\/pro"[^>]*>VeeAys Pro<\/a><\/nav>/);
  assert.match(html,/<a class="mobile-pro-link" href="\/pro">Explore Pro<\/a>\s*<details class="mobile-menu/);
  assert.doesNotMatch(html,/class="member-pro"/);
 }
 const pro=layout({...props,profile:{plan:'pro',plan_status:'active'}});
 assert.match(pro,/<a class="mobile-pro-link" href="\/pro">Your Pro<\/a>/);
 assert.doesNotMatch(pro,/Explore Pro|Explore VeeAys Pro/);
 assert.doesNotMatch(layout({...props,user:null}),/class="mobile-pro-link"/);
});
test('free match-limit context explains shipped benefits without locking public jobs',()=>{
 const html=matchesPage({summary:{locked_matches:4,is_pro:false}});
 for(const text of ['4 more matches found','three free matches','salary and schedule','opt in','₱499','No automatic renewal','Browsing and applying stay free'])assert.ok(html.includes(text),text);
 for(const state of [{summary:{locked_matches:0}},{summary:{locked_matches:4,is_pro:true}},{summary:{locked_matches:4},error:'Unavailable'}])assert.doesNotMatch(matchesPage(state),/pro-unlock-card/);
});
test('Pro purchase page ties the price to existing benefits and keeps free access clear',()=>{
 const html=proPage({user:{id:'member'},liveCheckout:true});
 for(const text of ['₱499 for 30 days','No automatic renewal','beyond the free top 3','Opt-in daily email of new matches','Browsing and applying stay free','action="/pro/checkout"'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/Pro\+AI|guaranteed|auto-renew|ON AUTOPILOT/);
});
