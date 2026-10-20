import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listing} from '../src/render.js';
const base={rows:[],total:100,page:1,search:'',category:'',names:[]};
test('hero uses five available categories by inventory, never claims search trends, and excludes empty categories',()=>{
 const categoryEntries=[{name:'Empty',count:0},{name:'Unknown',count:null},{name:'Other',count:99},...['A & B','C','D','E','F','G'].map((name,i)=>({name,count:10-i}))];
 const html=listing({...base,categoryEntries});
 const hero=html.split('<div class="home-values">')[0];
 const roles=hero.match(/<nav class="green-room-roles"[\s\S]*?<\/nav>/)[0];
 assert.equal((roles.match(/<a /g)||[]).length,5);
 assert.match(roles,/Popular Remote Roles/);assert.match(roles,/href="\/categories\/A%20%26%20B">A &amp; B/);
 assert.doesNotMatch(roles,/>G<|Empty|Unknown|Other|Trending|search trends/);
 assert.doesNotMatch(hero,/green-room-stats|Find legitimate work-from-home/);
 assert.match(hero,/href="#job-categories"/);assert.match(html,/id="job-categories"/);
 assert.doesNotMatch(listing(base),/class="green-room-roles"/);
});
