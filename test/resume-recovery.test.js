import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeRecovery,decodeRecovery} from '../public/resume-recovery.js';
import {validateDraftExtras} from '../public/resume-tools.js';
const now=1000000000;
const data={sections:{name:'Alex <script>',skills:'Writing'},style:'classic',accent:'forest',photo:null,source:'Unparsed honest source',improve:true};
test('recovery round trip preserves independent drafts, source and design without mutating input',()=>{
 const drafts=[{label:'Draft 1',data:structuredClone(data)},{label:'Draft 2',data:{...data,sections:{name:'Jamie'},accent:'plum'}}],original=structuredClone(drafts);
 const restored=decodeRecovery(encodeRecovery(drafts,1,now),now);
 assert.deepEqual(restored.drafts,drafts);assert.equal(restored.active,1);assert.deepEqual(drafts,original);
 restored.drafts[1].data.sections.name='Changed';assert.equal(restored.drafts[0].data.sections.name,'Alex <script>');
});
test('recovery rejects malformed, oversized, expired and unsafe photo data atomically',()=>{
 const base={version:1,saved:now,active:0,drafts:[{data}]};
 for(const bad of [{...base,active:2},{...base,drafts:[]},{...base,saved:now-86400001},{...base,saved:now+60001},{...base,version:2},{...base,drafts:[{data:{...data,source:'x'.repeat(6001)}}]},{...base,drafts:[{data:{...data,photo:{src:'https://evil.invalid/photo',x:50,y:50,zoom:1}}}]}])assert.throws(()=>decodeRecovery(JSON.stringify(bad),now));
 assert.throws(()=>decodeRecovery('x'.repeat(4000001),now));assert.throws(()=>decodeRecovery('{',now));assert.equal(data.sections.name,'Alex <script>');
});
test('blank unsaved draft slots can be safely recovered',()=>{const d=decodeRecovery(encodeRecovery([{data:null}],0,now),now);assert.deepEqual(d.drafts[0].data.sections,{});});
test('downloaded drafts accept legacy files and preserve optional unparsed source safely',()=>{assert.deepEqual(validateDraftExtras({}),{source:'',improve:false});assert.deepEqual(validateDraftExtras(data),{source:data.source,improve:true});assert.throws(()=>validateDraftExtras({source:{html:'unsafe'}}));assert.throws(()=>validateDraftExtras({source:'x'.repeat(6001)}));assert.throws(()=>validateDraftExtras({improve:'true'}));});
