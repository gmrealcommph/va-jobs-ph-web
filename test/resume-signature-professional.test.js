import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {compose}from '../dist/resume-release-browser/resume-export-v3.js';
const fixtures=JSON.parse(await fs.readFile('test/fixtures/resume-release/profiles.json','utf8'));
test('Signature Professional retains chronological sections and separates employer/date from role',async()=>{
 const d=fixtures.senior||fixtures.realistic||Object.values(fixtures).find(d=>d.experience.includes('Northline'));
 const p=await compose(d,'signature','forest'),all=p.pages.flat().filter(c=>c.kind==='text'),labels=['PROFILE','PROFESSIONAL EXPERIENCE','EDUCATION & CERTIFICATIONS','SKILLS & TOOLS','SELECTED PROJECTS'];
 let previous=-1;for(const label of labels){const n=all.findIndex(c=>c.text===label);assert.ok(n>previous,label);previous=n;}
 for(const header of d.experience.split('\n\n').map(s=>s.split('\n')[0])){const parts=header.split(' | ');if(parts.length!==3)continue;const role=all.find(c=>c.text===parts[0]),company=all.find(c=>c.text===parts[1]),date=all.find(c=>c.text===parts[2]);assert.ok(role&&company&&date);assert.equal(role.family,'serif');assert.ok(company.bold);assert.ok(Math.abs(company.y-date.y)<2);assert.ok(date.x>company.x+company.advance);}
});
