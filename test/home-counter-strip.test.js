import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listing} from '../src/render.js';
const options={rows:[],total:1984,page:1,search:'',category:'',names:[]};
test('homepage relocates the single live counter below hero and links to listings',()=>{
 const html=listing(options);
 assert.equal((html.match(/data-live-opportunity-count=/g)||[]).length,1);
 assert.match(html,/<\/section>\s*<section class="home-counter-strip"/);
 assert.match(html,/data-live-opportunity-count="1984"/);
 assert.match(html,/href="\/jobs">Explore what’s waiting for you/);
 assert.doesNotMatch(html,/Made for Filipino talent|Global &amp; remote opportunities|Apply directly to employers/);
 for(const total of [0,9,42,9999,10000]) assert.match(listing({...options,total}),new RegExp(`data-live-opportunity-count="${total}"`));
 assert.doesNotMatch(listing({...options,browseOnly:true}),/home-counter-strip/);
 assert.doesNotMatch(listing({...options,category:'Writing'}),/home-counter-strip/);
 assert.doesNotMatch(listing({...options,search:'Excel'}),/data-live-opportunity-count=/);
});
