import test from 'node:test';
import assert from 'node:assert/strict';
import {readiness} from '../public/resume-tools.js';
import {wordBlob} from '../public/resume-word.js';
import {styles} from '../public/resume-layouts.js';
import {inflateRawSync} from 'node:zlib';
function unzip(bytes){const b=Buffer.from(bytes),files={};let i=0;while(i<b.length-4){if(b.readUInt32LE(i)!==0x04034b50){i++;continue;}const method=b.readUInt16LE(i+8),size=b.readUInt32LE(i+18),nameSize=b.readUInt16LE(i+26),extra=b.readUInt16LE(i+28),name=b.subarray(i+30,i+30+nameSize).toString(),start=i+30+nameSize+extra;files[name]=(method===8?inflateRawSync(b.subarray(start,start+size)):b.subarray(start,start+size)).toString();i=start+size;}return files;}
test('local readiness flags common errors without changing facts or scoring',()=>{
 const d={name:'Alex',contact:'alex@invalid',experience:'Support 2025–2022\nResponsible for emails',education:'Jan 2023 to 02/2024'};const original=structuredClone(d),items=readiness(d);
 for(const text of ['email','end year','specific','Date formats'])assert.ok(items.some(i=>i.advice.includes(text)),text);
 assert.deepEqual(d,original);assert.ok(items.every(i=>!('score' in i)));
 assert.equal(readiness({name:'Alex',contact:'alex@example.com',headline:'Support',skills:'Writing',projects:'Created a school guide · 2024'}).length,0);
 assert.ok(readiness({contact:'Manila'}).some(i=>i.field==='contact'));
});
test('all twelve simplified DOCX exports preserve long text, escape markup and use A4',async()=>{
 const d={name:'Alex <Rivera>',contact:'alex@example.com',experience:Array.from({length:80},(_,i)=>'Resolved request '+i).join('\n'),projects:'FINAL-CONTENT-MARKER & honest results'};
 for(const style of Object.keys(styles)){const blob=await wordBlob(d,style,'forest',null),files=unzip(await blob.arrayBuffer()),xml=files['word/document.xml'];assert.ok(xml,style);for(const text of ['Alex &lt;Rivera&gt;','Resolved request 79','FINAL-CONTENT-MARKER &amp; honest results','w:w="11906"','w:h="16838"'])assert.ok(xml.includes(text),style+': '+text);}
});
