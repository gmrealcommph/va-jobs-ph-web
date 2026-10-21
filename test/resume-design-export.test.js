import test from 'node:test';
import assert from 'node:assert/strict';
import {compose,pdfBytes,designs} from '../public/resume-export.js';
import {imageDimensions,validateDesignDraft} from '../public/resume-photo.js';
import {styles} from '../public/resume-layouts.js';
import {PDFDocument} from '../public/vendor/pdf-lib.esm.min.js';
const data={name:'Alex Rivera',headline:'Customer Success Specialist',contact:'alex@example.com · Manila',summary:'Thoughtful service. Clear communication.',experience:Array.from({length:35},(_,i)=>`Role ${i} · Company · 2020–2024\nResolved customer requests and documented processes.`).join('\n\n'),education:'Business Administration\nCertified training',skills:'Customer care · CRM · Writing\nProblem solving',projects:'Created a support resource library.'};
test('twelve distinct compositions keep every character and paginate within printable bounds',async()=>{
 assert.equal(Object.keys(designs).length,12);assert.deepEqual(Object.keys(styles).sort(),Object.keys(designs).sort());const hashes=new Set();
 for(const style of Object.keys(designs)){
  const original=structuredClone(data),plan=await compose(data,style,'forest');assert.ok(plan.pages.length>1);assert.deepEqual(data,original);
  const all=plan.pages.flat().filter(c=>c.kind==='text');
  // Each explicit work-history line survives, including the last entry.
  const output=all.map(c=>c.text).join('').replace(/\s/g,''); for(const line of data.experience.split('\n').filter(Boolean))assert.ok(output.includes(line.replace(/\s/g,'')),style+': '+line);
  for(const c of plan.pages.flat()){assert.ok(c.x>=0);assert.ok(c.y>=0&&c.y<842);if(c.kind==='rect')assert.ok(c.y+c.h<=842);if(c.kind==='text')assert.ok(c.y+c.size<=842);}
  hashes.add(JSON.stringify(plan.pages));
  const pdf=await PDFDocument.load(await pdfBytes(plan));assert.equal(pdf.getPageCount(),plan.pages.length);assert.equal(pdf.getTitle(),'Résumé');
 }
 assert.equal(hashes.size,12);
});
test('unsupported PDF characters fail explicitly without changing data',async()=>{const d={name:'测试'};await assert.rejects(compose(d),/preserved/);assert.equal(d.name,'测试');});
test('single-page examples remain one page and optional photos use only supported designs',async()=>{
 const simple={...data,experience:'Support · 2023–present\nResolved requests.'};
 for(const style of Object.keys(designs)){const p=await compose(simple,style,'slate','data:image/jpeg;base64,example');assert.equal(p.pages.length,1,style);assert.equal(p.pages.flat().filter(x=>x.kind==='image').length,1);}
});
test('safe photos reject SVG, missing dimensions, oversize pixels and untrusted draft data',()=>{
 assert.throws(()=>imageDimensions(new TextEncoder().encode('<svg/>')),/valid JPEG/);
 const b=new Uint8Array(24);b.set([137,80,78,71,13,10,26,10]);new DataView(b.buffer).setUint32(16,9000);new DataView(b.buffer).setUint32(20,9000);assert.throws(()=>imageDimensions(b),/16 megapixels/);
 for(const photo of [{src:'https://evil.test/image',x:50,y:50,zoom:1},{src:'data:image/jpeg;base64,abc',x:Infinity,y:0,zoom:1}])assert.throws(()=>validateDesignDraft({version:2,style:'classic',accent:'forest',photo},styles));
 assert.equal(validateDesignDraft({version:2,style:'classic',accent:'forest',photo:null},styles).photo,null);
});

test('artwork stays behind readable continuation columns and role headings keep a following line',async()=>{
 for(const style of Object.keys(designs)){
  const plan=await compose({...data,skills:Array.from({length:95},(_,i)=>'SKILL-'+i).join('\n')},style);
  assert.ok(plan.pages.length>1);
  for(const page of plan.pages)for(const c of page.filter(c=>c.kind==='text')){assert.ok(c.x+c.advance<=596,style+': '+c.text);assert.ok(c.y+c.size<800||c.y>810,style);}
  const final=plan.pages.flat().filter(c=>c.kind==='text').map(c=>c.text).join('');assert.ok(final.includes('SKILL-94'),style);
 }
});

test('every exported page is portrait ISO A4',async()=>{for(const style of Object.keys(designs)){const plan=await compose(data,style);assert.equal(plan.width,595.28);assert.equal(plan.height,841.89);const pdf=await PDFDocument.load(await pdfBytes(plan));for(const page of pdf.getPages()){assert.equal(page.getWidth(),595.28);assert.equal(page.getHeight(),841.89);}}});
