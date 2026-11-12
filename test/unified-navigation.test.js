import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layout} from '../src/render.js';

const render=(route,user=null,profile=null)=>layout({title:'Preview',description:'',canonical:`https://veeays.com${route}`,body:'<p>Approved page content</p>',user,profile});
test('all public and member routes share one header, unchanged authentic logo and scoped styling',()=>{
  for(const route of ['/','/pro','/categories','/categories/Marketing','/jobs','/jobs/123','/employers','/login','/signup','/onboarding','/matches','/my-jobs','/saved-searches','/job-alerts','/email-preferences','/about','/contact','/privacy']){
    const html=render(route);
    assert.equal((html.match(/<header class="site-header veeays-navigation">/g)||[]).length,1,route);
    assert.match(html,/src="\/veeays-logo.png" alt="VeeAys" width="1200" height="400"/);
    assert.match(html,/href="\/navigation.css\?v=20261021-resources"/);
    assert.match(html,/<main id="main">\s*<p>Approved page content<\/p>/);
    assert.match(html,/class="skip" href="#main"/);
  }
});
test('active discovery tab follows route families without highlighting unrelated tabs',()=>{
  for(const [route,active] of [['/','/'],['/jobs/123','/'],['/categories/Marketing','/categories'],['/employers','/employers'],['/pro','/pro']]){
    const nav=render(route).match(/<nav class="discovery-nav"[^>]*>(.*?)<\/nav>/s)[1];
    assert.equal((nav.match(/aria-current="page"/g)||[]).length,1,route);
    assert.ok(nav.includes(`href="${active}" aria-current="page"`),route);
  }
  assert.match(render('/login'),/href="\/login" aria-current="page"/);
  assert.match(render('/signup'),/href="\/signup" aria-current="page"/);
});
test('account actions preserve signed-out, Free, active Pro and expired Pro behavior',()=>{
  const anonymous=render('/');assert.doesNotMatch(anonymous,/class="member-menu/);
  for(const status of ['free','active','expired']){
    const html=render('/my-jobs',{id:'fixture'},{full_name:'Alex <script>',plan:status==='free'?'free':'pro',plan_status:'active',pro_expires_at:status==='expired'?'2000-01-01':null});
    for(const route of ['/matches','/my-jobs','/onboarding','/saved-searches','/job-alerts','/pro','/logout'])assert.ok(html.includes(`href="${route}"`));
    assert.equal(html.includes('<span class="member-pro">PRO</span>'),status==='active');
    assert.doesNotMatch(html,/<script>Alex|Alex <script>/);
    assert.match(html,/aria-controls="member-panel"/);assert.match(html,/aria-controls="mobile-panel"/);
  }
});
