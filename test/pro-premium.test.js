import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proPage,listing} from '../src/render.js';
test('Pro redesign preserves purchase and fallback destinations for every account state',()=>{
 for(const isPro of [false,true]){
  const live=proPage({liveCheckout:true,isPro});
  assert.equal((live.match(/action="\/pro\/checkout"/g)||[]).length,1);
  assert.match(live,/<form id="pro-checkout" method="post" action="\/pro\/checkout">/);
  assert.equal((live.match(/form="pro-checkout"/g)||[]).length,2);
  assert.ok(live.includes(isPro?'Add 30 days':'Get Pro for 30 days'));
  assert.doesNotMatch(live,/TEST MODE|Checkout is currently unavailable/);
  assert.match(proPage({testCheckout:true,isPro}),/TEST MODE · No real money is charged/);
 }
 assert.match(proPage(),/href="\/signup\?return=%2Fonboarding"/);
 assert.match(proPage(),/Checkout is currently unavailable/);
 assert.match(proPage({user:{id:'u'},profile:{onboarding_completed:false}}),/href="\/onboarding"/);
 assert.match(proPage({user:{id:'u'},profile:{onboarding_completed:true}}),/href="\/matches"/);
 assert.match(proPage({isPro:true}),/View my Pro matches/);
});
test('Pro value claims match shipped functionality and illustration is identified',()=>{
 const html=proPage({liveCheckout:true});
 for(const copy of ['Less searching.','More matching.','₱499 for 30 days','No automatic renewal','One-time payment','beyond the free top 3','Up to five saved keyword and category searches','Salary, schedule and work-type match filters','90%+ match score filter','Every public job stays free.','Requires active Pro access and email opt-in; empty digests are skipped.','Personalized category and salary email preferences are not active yet.','Example roles and scores only, not live listings.'])assert.ok(html.includes(copy),copy);
 assert.doesNotMatch(html,/Smart Alerts|instant alerts|guaranteed|<script/);
 assert.match(html,/<img src="\/pro-cozy-hero.webp" width="1536" height="1024" alt="" fetchpriority="high" decoding="async">/);
 assert.match(html,/<source media="\(max-width:700px\)" srcset="\/pro-cozy-mobile.webp">/);
 assert.match(html,/role="group" aria-label="Find your fit: Free and VeeAys Pro"/);
 assert.ok(html.indexOf('id="pro-free-title"')<html.indexOf('id="pro-plus-title"'));
 const home=listing({rows:[],total:0,page:1,names:[]});assert.doesNotMatch(home,/pro-premium.css/);
});
