import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {styles,renderResume} from '../public/resume-layouts.js';
import {studioBody} from '../src/resume-studio.js';
import {layout} from '../src/render.js';
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.ownerDocument={createElement:tag=>new Element(tag)};this.textContent='';}
 append(el){this.children.push(el);}
 replaceChildren(){this.children=[];}
 get text(){return this.textContent+this.children.map(x=>x.text).join('');}
}
const draft={name:'Alex <script>alert(1)</script>',headline:'Support',contact:'alex@example.com',summary:'Summary',experience:'Experience\nLine two',education:'School',skills:'Tools',projects:'Portfolio'};
test('all six layouts preserve every field verbatim across repeated switching without mutating the draft',()=>{
 const original=structuredClone(draft),root=new Element('article');
 for(const style of [...Object.keys(styles),...Object.keys(styles).reverse()]){
  renderResume(root,draft,style,'plum');
  for(const value of Object.values(draft))assert.ok(root.text.includes(value));
  assert.equal(root.dataset.style,style);assert.equal(root.dataset.accent,'plum');
  assert.deepEqual(draft,original);
 }
});
test('layout renderer uses text nodes, omits empty sections and moves skills before experience only in Tech',()=>{
 const root=new Element('article');renderResume(root,draft,'tech');
 assert.deepEqual(root.children[1].children.map(x=>x.dataset.section),['summary','skills','experience','projects','education']);
 assert.equal(root.children[0].children[0].textContent,draft.name);
 renderResume(root,{name:'Alex'},'classic');assert.equal(root.children[1].children.length,0);
});
test('each design has structural CSS differences shared by thumbnails and print',()=>{
 const css=fs.readFileSync('public/resume-studio.css','utf8');
 for(const name of Object.keys(styles))assert.ok(css.includes('[data-style='+name+']'));
 assert.match(css,/grid-template-columns:110px minmax\(0,1fr\)/);
 assert.match(css,/grid-column:2;grid-row:1 \/ span 4/);
 assert.match(css,/grid-column:1;grid-row:1 \/ span 4/);
 assert.match(css,/font-family:Consolas,monospace/);
 const client=fs.readFileSync('public/resume-studio.js','utf8');
 assert.ok(client.includes("renderResume(thumb,sample,key,'forest')"));
 assert.ok(client.includes("renderResume($('#resume-preview'),d,selectedStyle"));
});
test('desktop scrolling, mobile mode and print overrides have explicit contracts',()=>{
 const css=fs.readFileSync('public/resume-studio.css','utf8'),html=studioBody();
 assert.match(css,/height:calc\(100dvh - 110px\)/);
 assert.match(css,/position:sticky;top:24px/);
 assert.match(css,/overflow:auto;overscroll-behavior:contain/);
 assert.ok(css.includes('.studio-grid[data-view=preview] .studio-editor{display:none}'));
 assert.ok(css.includes('.studio-grid .studio-preview{display:block!important}'));
 assert.ok(css.includes('@page{size:A4;margin:18mm}'));
 assert.ok(css.includes('orphans:3;widows:3'));
 assert.ok(layout({title:'Résumé Studio',body:html}).includes('src="/veeays-logo.png"'));
 assert.ok(html.includes('Better Jobs. From Home.'));
 assert.ok(html.includes('tabindex="0" aria-label="Scrollable résumé pages"'));
 assert.ok(!html.match(/<article id="resume-preview"[^>]*>[^<]+/));
});
test('design switching has no provider calls and local AI stays disabled',()=>{
 const layout=fs.readFileSync('public/resume-layouts.js','utf8');
 assert.ok(!/fetch\(|XMLHttpRequest|localStorage|innerHTML/.test(layout));
 assert.match(fs.readFileSync('wrangler.resume-local.jsonc','utf8'),/"RESUME_AI_ENABLED":"false"/);
});
