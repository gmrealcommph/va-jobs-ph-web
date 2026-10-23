import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';import {myJobsPage} from '../src/render.js';
test('tracker loads a same-origin external script under existing strict CSP',()=>{const html=myJobsPage();assert.match(html,/<script src="\/application-tracker.js\?v=20261023" defer><\/script>/);assert.doesNotMatch(html,/<script>/);});
test('tracker script opens editors and filters stages without inline execution',async()=>{
 const node=extra=>({dataset:{},hidden:false,attributes:{},classList:{toggle(){}},addEventListener(type,fn){this[type]=fn;},setAttribute(k,v){this.attributes[k]=v;},...extra});
 const tabs=[node({dataset:{filter:'all'}}),node({dataset:{filter:'interview'}})],cards=[node({dataset:{status:'applied'}}),node({dataset:{status:'interview'}})],empty=node(),panel=node({hidden:true}),button=node({closest:()=>({querySelector:()=>panel})});
 const root={querySelectorAll:s=>s==='.tracker-tab'?tabs:s==='.tracker-card'?cards:[button],querySelector:()=>empty};
 vm.runInNewContext(await readFile(new URL('../public/application-tracker.js',import.meta.url),'utf8'),{document:{querySelector:()=>root}});
 button.click();assert.equal(panel.hidden,false);assert.equal(button.attributes['aria-expanded'],'true');button.click();assert.equal(panel.hidden,true);
 tabs[1].click();assert.equal(cards[0].hidden,true);assert.equal(cards[1].hidden,false);assert.equal(tabs[1].attributes['aria-pressed'],'true');tabs[0].click();assert.equal(cards[0].hidden,false);
});
