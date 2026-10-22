import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'acorn';
import {filterGuides,learningPage} from '../src/learning-hub.js';
import {learningGuides,learningCategories} from '../src/learning-guides.js';
test('only populated categories and genuine counts are presented',()=>{
 assert.deepEqual(learningCategories.map(c=>learningGuides.filter(g=>g.category===c.id).length),[2,2,1,1]);
 const html=learningPage('/resources').body;
 assert.equal((html.match(/class="career-pathway career-tone-/g)||[]).length,4);
 assert.equal((html.match(/data-resource-card /g)||[]).length,6);
 assert.doesNotMatch(html,/1,000|1000 members|18 guides|14 guides/);
});
test('accent-insensitive multiword search and category intersections return real guides',()=>{
 assert.deepEqual(filterGuides('resume').map(g=>g.slug),filterGuides('résumé').map(g=>g.slug));
 assert.equal(filterGuides('', 'job-safety').length,1);
 assert.equal(filterGuides('interview','job-safety').length,0);
 assert.equal(filterGuides('remote interview').length,1);
 assert.equal(filterGuides('zzzxxyy').length,0);
});
test('server-side GET fallback escapes queries and renders honest empty states',()=>{
 const html=learningPage('/resources',new URLSearchParams({q:'<script>alert(1)</script>'})).body;
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>alert'));
 assert.ok(html.includes('0 guides found'));assert.ok(html.includes('id="resource-empty"><'));
 assert.ok(learningPage('/resources',new URLSearchParams({category:'invalid'})).body.includes('6 guides to explore'));
 const filtered=learningPage('/resources',new URLSearchParams({category:'job-safety'})).body;
 assert.equal((filtered.match(/data-search="[^"]+" hidden/g)||[]).length,5);
});
test('all original editorial sections and exercises remain, with checklists and real next links',()=>{
 for(const guide of learningGuides){const html=learningPage('/resources/'+guide.slug).body;
 for(const [,content] of guide.sections)assert.ok(html.includes(content));
 assert.ok(html.includes(guide.exercise));assert.ok(html.includes('id="guide-checklist"'));
 assert.ok(html.includes('/resources/'+guide.next));assert.ok(html.includes('aria-label="In this guide"'));
 }
});
test('Career Hub uses lightweight pathways, preserves all guides and corrects shared branding',()=>{
 parse(readFileSync(new URL('../public/learning-hub.js',import.meta.url),'utf8'),{ecmaVersion:'latest',sourceType:'module'});
 const html=learningPage('/resources').body;
 assert.match(html,/Your Remote<br><span>Career Starts Here/);
 assert.match(html,/Start My Journey/);assert.match(html,/Build My Résumé/);
 assert.match(html,/Your Path to Remote Work/);assert.match(html,/Put Your Learning Into Action/);
 assert.doesNotMatch(html,/<img|resources-hero|course complete|progress saved|localStorage/);
 assert.equal((html.match(/class="career-road-link"/g)||[]).length,4);
 for(const guide of learningGuides)assert.ok(html.includes('/resources/'+guide.slug));
 const render=readFileSync(new URL('../src/render.js',import.meta.url),'utf8');
 assert.doesNotMatch(render,/Global possibilities\./);
 assert.match(render,/class="footer-tagline">\s*Better Jobs\. From Home\./);
});
