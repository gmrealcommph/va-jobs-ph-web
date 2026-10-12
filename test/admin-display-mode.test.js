import test from 'node:test';
import assert from 'node:assert/strict';
import {initDisplayMode} from '../public/admin-interactions.js';
test('display preference persists locally and always provides an exit control',()=>{
 const attrs={},button={setAttribute(k,v){attrs[k]=v;},addEventListener(k,fn){this[k]=fn;}},root={setAttribute(k,v){this[k]=v;}},store=new Map([['veeays-display-mode','on']]);let scrolled=0;
 initDisplayMode({getElementById:()=>({after(){}}),createElement:()=>button,documentElement:root},{localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},scrollTo(){scrolled++;}});
 assert.equal(root['data-display-mode'],'on');assert.equal(button.textContent,'Exit display mode');button.click();assert.equal(root['data-display-mode'],'off');assert.equal(store.get('veeays-display-mode'),'off');assert.equal(scrolled,1);assert.equal(attrs['aria-pressed'],'false');
});
