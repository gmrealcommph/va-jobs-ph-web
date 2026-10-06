import test from 'node:test';
import assert from 'node:assert/strict';
import {originalDescriptionDisplay,renderJobRead} from '../src/job-detail-read.js';
import {detail} from '../src/render.js';
const p='At Your Personal AI, we deliver cutting-edge AI solutions by combining ethical, high-quality data collection and annotation with innovative approaches.';
test('exact normalized prose duplicates only; first wording and source are preserved',()=>{
 const source=p+'\n\n'+p.replace('we deliver','we  deliver')+'\n\nDifferent original prose.';
 const before=source;const output=originalDescriptionDisplay(source);
 assert.equal(output.split('At Your Personal AI').length-1,1);
 assert.ok(output.includes(p));assert.ok(output.includes('Different original prose.'));assert.equal(source,before);
});
test('similar, case-different paragraphs and reordered content remain',()=>{
 const source=[p,p.replace('ethical','responsible')+' Our mission is to support industries.',p.replace('ethical','Ethical')].join('\n\n');
 assert.equal(originalDescriptionDisplay(source),source);
});

test('exact immediately repeated leading sentence is removed and remainder retained',()=>{
 const rest='Our mission is to support industries in harnessing AI.';
 for(const repeated of [p,p.replace('we deliver','we  deliver').replace('data collection','data\ncollection')]) {
  const source=p+'\n\n'+repeated+' '+rest;
  assert.equal(originalDescriptionDisplay(source),p+'\n\n'+rest);
 }
 assert.equal(originalDescriptionDisplay(p+'\n\n'+p+' '+rest+'\nThe Role\nSupport the team.'),p+'\n\n'+rest+'\nThe Role\nSupport the team.');
});

test('sentence comparisons preserve near matches, intervening headings and lists',()=>{
 for(const repeated of [p.replace('ethical','Ethical'),p.replace('approaches.','approaches!'),p.replace('AI solutions','AI services')]) {
  const source=p+'\n\n'+repeated+' New material.';
  assert.equal(originalDescriptionDisplay(source),source);
 }
 for(const middle of ['The Role','Responsibilities:','- A list item']) {
  const source=p+'\n\n'+middle+'\n\n'+p+' New material.';
  assert.equal(originalDescriptionDisplay(source),source);
 }
 for(const prefix of ['- ','1. ','# ']) {
  const source=p+'\n\n'+prefix+p+' New material.';
  assert.equal(originalDescriptionDisplay(source),source);
 }
});
test('repeated headings, list items and ambiguous short text are retained',()=>{
 for(const block of ['The Role','Responsibilities:',p.toUpperCase(),'- '+p,'1. '+p,'Short prose.','# '+p,p+'\nResponsibilities:']) {
 const source=block+'\n\n'+block;assert.equal(originalDescriptionDisplay(source),source);
 }
});
test('absent and ready reads only dedupe source display; unsafe HTML is escaped',()=>{
 const source=p+'\n\n'+p+'\n\n<script>alert(1)</script>';
 const html=renderJobRead(source,null);assert.match(html,/This listing is shown from the employer/);assert.match(html,/Original description/);assert.doesNotMatch(html,/<script>/);
 assert.equal(html.split('At Your Personal AI').length-1,1);
});
test('heading family has one unique flight and enum chip display is local',()=>{
 const job={id:123,title:'Support '.repeat(30),company:'Your Personal AI '.repeat(20),workplace_type:'remote',location:'Worldwide',description:p,job_url:'https://example.com',source:'himalayas'};
 const before=structuredClone(job);const html=detail(job,{user:{id:'u'}});
 assert.deepEqual(job,before);assert.equal((html.match(/qr-glance-flight"/g)||[]).length,1);
 assert.equal((html.match(/qr-glance-sparks"/g)||[]).length,3);
 assert.match(html,/>Remote<\/span>/);assert.match(html,/Save this role or mark it applied to start your journey/);
});
test('ready Quick Read stays ready while its original description display dedupes',()=>{
 const source='About the company\n\n'+p+'\n\n'+p+'\n\nResponsibilities\nManage client operations and coordinate delivery.\nRequirements\nThree years of customer support experience required.';
 const html=renderJobRead(source);
 assert.match(html,/VeeAys Quick Read/);assert.doesNotMatch(html,/This listing is shown from/);
 const original=html.split('<div class="qr-original">')[1].split('</div>')[0];
 assert.equal(original.split('At Your Personal AI').length-1,1);
});
