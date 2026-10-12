import test from 'node:test';
import assert from 'node:assert/strict';
import {RegistrationTracker,refreshDelay,playRegistrationChime} from '../public/admin-live.js';
const event=(n,registered_at='2026-10-08T10:00:30Z')=>({event_id:n.toString(16).padStart(32,'0'),registered_at});
const snapshot=events=>({available:true,generated_at:'2026-10-08T10:00:00Z',events});
test('first successful snapshot establishes a baseline without old-account notifications',()=>{
 const tracker=new RegistrationTracker();
 assert.deepEqual(tracker.observe(snapshot([event(1)])),[]);
 assert.deepEqual(tracker.observe(snapshot([event(1)])),[]);
});
test('each fresh account alerts once, even when totals could be offset by deletion',()=>{
 const tracker=new RegistrationTracker();tracker.observe(snapshot([event(1)]));
 assert.deepEqual(tracker.observe(snapshot([event(2),event(3)])),[event(2),event(3)]);
 assert.deepEqual(tracker.observe(snapshot([event(2),event(3)])),[]);
});
test('failures do not reset seen events or replay notifications after recovery',()=>{
 const tracker=new RegistrationTracker();tracker.observe(snapshot([event(1)]));
 assert.deepEqual(tracker.observe({available:false}),[]);
 assert.deepEqual(tracker.observe(snapshot([event(1),event(2)])),[event(2)]);
 assert.deepEqual(tracker.observe(snapshot([event(2)])),[]);
});
test('old rows newly entering a bounded snapshot do not announce as new signups',()=>{
 const tracker=new RegistrationTracker();tracker.observe(snapshot([event(1)]));
 assert.deepEqual(tracker.observe(snapshot([event(99,'2026-10-07T10:00:00Z'),event(1)])),[]);
});
test('late-committing registrations within overlap are detected without invalid event data',()=>{
 const tracker=new RegistrationTracker();tracker.observe(snapshot([event(1)]));
 const late=event(2,'2026-10-08T09:59:59Z');
 assert.deepEqual(tracker.observe(snapshot([late,{event_id:'invalid',registered_at:'invalid'}])),[late]);
});
test('refresh settings include pause and bounded retry backoff',()=>{
 assert.equal(refreshDelay(30),30000);assert.equal(refreshDelay(15),15000);
 assert.equal(refreshDelay(60),60000);assert.equal(refreshDelay(0),0);
 assert.equal(refreshDelay(30,1),60000);assert.equal(refreshDelay(30,50),300000);
 assert.equal(refreshDelay(999),0);
});
test('desk bell requires activated audio and schedules one sharp strike with fading partials',()=>{
 assert.equal(playRegistrationChime(null),false);
 assert.equal(playRegistrationChime({state:'suspended'}),false);
 const tones=[],gains=[];
 const context={state:'running',currentTime:10,destination:{},
  createOscillator(){const tone={frequency:{setValueAtTime(v,t){tone.frequencyValue=v;tone.frequencyTime=t;}},connect(){},start(t){tone.startTime=t;},stop(t){tone.stopTime=t;}};tones.push(tone);return tone;},
  createGain(){const gain={gain:{setValueAtTime(){},exponentialRampToValueAtTime(v,t){gains.push({v,t});}},connect(){}};return gain;}};
 assert.equal(playRegistrationChime(context),true);
 assert.deepEqual(tones.map(t=>t.frequencyValue),[1760,2816,3872]);
 assert.deepEqual(tones.map(t=>t.startTime),[10,10,10]);
 assert.ok(tones.every(t=>t.stopTime-t.startTime<0.85));
 const peaks=gains.filter(g=>g.t===10.003).map(g=>g.v);
 assert.ok(Math.max(...peaks)>=0.09,'Bell peak should be at least twice the original level');
 assert.ok(peaks.reduce((sum,value)=>sum+value,0)<1,'Combined partials must leave clipping headroom');
});
