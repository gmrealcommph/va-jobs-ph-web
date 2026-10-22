import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const script=await readFile(new URL('../public/traffic.js',import.meta.url),'utf8');
function mount({choice=null,path='/',blocked=false}={}) {
  const values=new Map(choice?[['veeays_analytics_choice_v2',choice]]:[]),events={};
  const element=()=>({children:[],hidden:false,setAttribute(){},append(...nodes){this.children.push(...nodes);}});
  const body=element();
  const requests=[];
  vm.runInNewContext(script,{
    location:{pathname:path,search:''},document:{referrer:'',body,createElement:element},
    navigator:{globalPrivacyControl:blocked},URL,URLSearchParams,AbortSignal,Event,
    localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},
    crypto:{randomUUID:()=> 'synthetic'},fetch:async(...args)=>{requests.push(args);return {};},
    window:{dispatchEvent(){},addEventListener:(name,handler)=>events[name]=handler}
  });
  const box=body.children[0],panel=box.children[1];
  return {box,panel,values,requests,events,accept:panel.children[0],decline:panel.children[1]};
}
test('allow and decline dismiss the entire banner immediately and on later pages',()=>{
  for(const [action,value] of [['accept','yes'],['decline','no']]) {
    const ui=mount();assert.equal(ui.box.hidden,false);assert.equal(ui.panel.hidden,false);
    ui[action].onclick();assert.equal(ui.box.hidden,true);assert.equal(ui.panel.hidden,true);
    assert.equal(ui.values.get('veeays_analytics_choice_v2'),value);
    assert.equal(mount({choice:value}).box.hidden,true);
  }
});
test('privacy page retains a way to reopen and withdraw a saved choice',()=>{
  const ui=mount({choice:'yes',path:'/privacy'});
  assert.equal(ui.box.hidden,false);assert.equal(ui.panel.hidden,true);
  ui.box.children[0].onclick();assert.equal(ui.panel.hidden,false);
  ui.decline.onclick();assert.equal(ui.values.get('veeays_analytics_choice_v2'),'no');assert.equal(ui.box.hidden,false);
});
test('cross-tab confirmation dismisses the banner and browser privacy preferences prevent tracking',()=>{
  const ui=mount();ui.events.storage({key:'veeays_analytics_choice_v2',newValue:'no'});assert.equal(ui.box.hidden,true);
  const blocked=mount({blocked:true});assert.equal(blocked.box.hidden,true);assert.equal(blocked.requests.length,0);
});
