import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {compose,pdfBytes}from '../dist/resume-release-browser/resume-export-v3.js';
import {wordBlob}from '../dist/resume-release-browser/resume-word-v3.js';
import {styles}from '../dist/resume-release-browser/resume-layouts-v3.js';
import {encodeRecovery,decodeRecovery}from '../dist/resume-release-browser/resume-recovery.js';
const fixtures=JSON.parse(await fs.readFile('test/fixtures/resume-release/profiles.json','utf8'));
for(const id of Object.keys(styles))test(id+': all eight profiles preserve source, create A4 PDFs and editable Word files',async()=>{
 for(const [kind,d]of Object.entries(fixtures)){
  const original=structuredClone(d),p=await compose(d,id,'forest');assert.deepEqual(d,original);assert.ok(p.pages.length);
  const text=p.pages.flat().filter(c=>c.kind==='text').map(c=>c.text).join('').replace(/\s/g,'');
  for(const [key,value]of Object.entries(d))for(const row of value.split('\n').filter(Boolean))for(const part of key==='contact'?row.split(' · '):key==='experience'&&row.includes(' | ')?row.split(' | '):[row])assert.ok(text.includes(part.replace(/\s/g,'')),kind+' '+key+' '+part);
  for(const page of p.pages){assert.ok(page.some(c=>c.kind==='text'&&!['footer','continuation','monogram'].includes(c.region)));for(const c of page.filter(c=>c.kind==='text'))assert.ok(c.x>=0&&c.x+c.advance<596&&c.y>=0&&c.y+c.size<842,kind+' bounds');}
  assert.ok((await pdfBytes(p)).length>1000);assert.ok((await wordBlob(d,id,'forest')).size>1000);
 }
});
test('all twelve design identifiers survive draft recovery without changing fields',()=>{for(const id of Object.keys(styles)){const data={sections:fixtures.graduate,source:'Fictional review notes',style:id,accent:'forest',photo:null,improve:false};const restored=decodeRecovery(encodeRecovery([{label:'Draft 1',data}],0));assert.deepEqual(restored.drafts[0].data,data);}});
