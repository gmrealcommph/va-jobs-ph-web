import test from 'node:test';
import assert from 'node:assert/strict';
import {glideStep,initDashboardInteractions} from '../public/admin-interactions.js';
test('glide decays consistently by elapsed time and preserves direction',()=>{
 assert.equal(glideStep(0,16),0);assert.ok(glideStep(1,16)>0&&glideStep(1,16)<1);
 assert.equal(glideStep(-1,16),-glideStep(1,16));
 assert.ok(Math.abs(glideStep(glideStep(1,16),16)-glideStep(1,32))<1e-12);
});
test('drag ignores touch and controls; reduced motion prevents inertia',()=>{
 const handlers={},classes=new Set(),scrolls=[];let frames=0,capture=false;
 const body={append(){},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},setPointerCapture(){capture=true;},hasPointerCapture:()=>capture,releasePointerCapture(){capture=false;}};
 const doc={body,createElement:()=>({setAttribute(){},style:{}}),addEventListener:(name,fn)=>handlers[name]=fn};
 const win={matchMedia:()=>({matches:true}),cancelAnimationFrame(){},setTimeout(){},requestAnimationFrame(){frames++;},getSelection:()=>({removeAllRanges(){}}),scrollBy:v=>scrolls.push(v.top),getComputedStyle:()=>({overflowY:'visible'}),addEventListener(){}};
 initDashboardInteractions(doc,win);
 const target={closest:()=>null,parentElement:body,scrollHeight:100,clientHeight:100};
 const event={pointerType:'mouse',button:0,pointerId:1,clientY:200,timeStamp:0,target,preventDefault(){}};
 handlers.pointerdown({...event,pointerType:'touch'});handlers.pointermove({...event,clientY:150,timeStamp:16});assert.deepEqual(scrolls,[]);
 handlers.pointerdown({...event,target:{...target,closest:()=>({})}});handlers.pointermove({...event,clientY:150,timeStamp:16});assert.deepEqual(scrolls,[]);
 handlers.pointerdown(event);handlers.pointermove({...event,clientY:197,timeStamp:5});assert.deepEqual(scrolls,[]);
 handlers.pointermove({...event,clientY:150,timeStamp:16});assert.deepEqual(scrolls,[50]);assert.ok(classes.has('page-dragging'));
 handlers.pointerup({...event,type:'pointerup',timeStamp:18});assert.equal(frames,0);assert.equal(capture,false);assert.equal(classes.size,0);
});
