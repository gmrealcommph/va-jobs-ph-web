import test from 'node:test';
import assert from 'node:assert/strict';
import {initFullscreen} from '../public/admin-interactions.js';
function setup(){
 const elements=[],events={};
 const doc={fullscreenEnabled:true,fullscreenElement:null,documentElement:{},getElementById:()=>({after(){}}),createElement:()=>{const e={attrs:{},setAttribute(k,v){this.attrs[k]=v;},after(){},addEventListener(k,v){this[k]=v;}};elements.push(e);return e;},addEventListener:(k,v)=>events[k]=v};
 return {doc,elements,events};
}
test('full screen requires a tap, hides navigation, and tracks browser exit',async()=>{
 const {doc,elements,events}=setup();let requests=0;
 doc.documentElement.requestFullscreen=async options=>{requests++;assert.equal(options.navigationUI,'hide');doc.fullscreenElement=doc.documentElement;};
 doc.exitFullscreen=async()=>{doc.fullscreenElement=null;};initFullscreen(doc);
 const button=elements[0];assert.equal(requests,0);await button.click();assert.equal(button.attrs['aria-label'],'Exit full screen');assert.equal(button.attrs['aria-pressed'],'true');
 doc.fullscreenElement=null;events.fullscreenchange();assert.equal(button.attrs['aria-label'],'Full screen');
 await button.click();await button.click();assert.equal(doc.fullscreenElement,null);
});
test('unsupported and denied requests do not claim success',async()=>{
 const f=setup();initFullscreen(f.doc);assert.equal(f.elements[0].disabled,true);
 const g=setup();g.doc.documentElement.requestFullscreen=async()=>{throw Error('denied');};initFullscreen(g.doc);await g.elements[0].click();assert.equal(g.elements[0].disabled,false);assert.match(g.elements[1].textContent,/declined/);assert.equal(g.elements[0].attrs['aria-pressed'],'false');
});

test('left menu and display-mode controls stay synchronized',async()=>{
 const f=setup();let menu;
 f.doc.querySelector=()=>({append(e){menu=e;}});
 f.doc.documentElement.requestFullscreen=async()=>{f.doc.fullscreenElement=f.doc.documentElement;};
 f.doc.exitFullscreen=async()=>{f.doc.fullscreenElement=null;};initFullscreen(f.doc);
 assert.ok(menu);await menu.click();assert.equal(menu.attrs['aria-label'],'Exit full screen');assert.equal(f.elements[0].attrs['aria-pressed'],'true');
 await f.elements[0].click();assert.equal(menu.attrs['aria-label'],'Full screen');assert.equal(menu.attrs['aria-pressed'],'false');
});
