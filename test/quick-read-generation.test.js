import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceUnits,sourceFingerprint,validateSelection,validateStored,generateWithProvider,SECTIONS} from '../src/quick-read-generation.js';
import {generateJob,quickReadEndpoint} from '../src/quick-read-service.js';
import {renderJobRead,renderAtAGlance,formatSalary} from '../src/job-detail-read.js';
import {installLogoFallback} from '../public/job-detail-logo.js';
import {detail} from '../src/render.js';
import {readFileSync} from 'node:fs';
// Synthetic acceptance fixture, not a fetched production listing.
export const technologySource=`TechnologyAdvice serves technology clients worldwide.
TechnologyAdvice serves technology clients worldwide.
Entry-level, full-time Client Success Operations Coordinator in the Philippines.
Coordinate client success operations using Salesforce.
Google Sheets and Excel experience required.
9PM–6AM PHT Apr–Oct / 10PM–7AM PHT Nov–Mar.
Must have a laptop/PC, internet and a backup connection.
PH work authorization required; no visa sponsorship.
Pre-employment screening required.
AI-generated or incomplete application answers will be auto-rejected.
Salesforce certification highly preferred.
Health insurance and paid leave.
Salary ₱37,500–₱46,000 per month.`;
export function validSelection(source=technologySource) {
  const q=Object.fromEntries(SECTIONS.map(k=>[k,[]]));
  for(const u of sourceUnits(source)) {
    const key=/application|answers|screening/i.test(u.text)?'application_notes':/preferred/i.test(u.text)?'nice_to_have':/PHT|laptop|authorization|sponsorship/i.test(u.text)?'important_requirements':/serves technology/.test(u.text)?'company_overview':/insurance/.test(u.text)?'benefits':/experience required/.test(u.text)?'requirements':/Coordinate client/.test(u.text)?'responsibilities':'about_role';
    q[key].push(u.id);
  }
  return q;
}
test('TechnologyAdvice acceptance facts survive source organization, exact duplicate intro removed',()=>{
  const q=validateSelection(validSelection(),technologySource);
  assert.equal(q.company_overview.length,1);
  for(const fact of ['Philippines','Entry-level','full-time','Salesforce','Google Sheets','Excel','9PM–6AM','10PM–7AM','laptop/PC','backup connection','PH work authorization','no visa sponsorship','Pre-employment screening','AI-generated','auto-rejected','insurance','₱37,500–₱46,000']) assert.ok(JSON.stringify(q).includes(fact),fact);
  assert.match(q.nice_to_have[0],/highly preferred/);
  assert.equal(validateStored(q,technologySource)?.formatter,'source-organizer-v2');
});
const liveTechnologySource=readFileSync(new URL('./fixtures/technologyadvice-37688.txt',import.meta.url),'utf8');
function liveTechnologySelection(source=liveTechnologySource) {
  const units=sourceUnits(source);
  const selection=Object.fromEntries(SECTIONS.map(k=>[k,[]]));
  for(const u of units) {
    let key=u.is_heading?'other_details':u.section_hint==='unknown'?'company_overview':u.section_hint;
    if(/\b(application|apply|auto[- ]reject|screening|pre[- ]employment)\b/i.test(u.text)) key='application_notes';
    else if(/\b(authori[sz]|sponsorship|visa|permit|laptop|PC|computer|equipment|internet|backup|shift|schedule|PHT|timezone)\w*/i.test(u.text)) key='important_requirements';
    selection[key].push(u.id);
  }
  return selection;
}
test('real live job 37688: source coverage, duplicated introduction, benefits and material conditions',()=>{
  const source=liveTechnologySource;
  const units=sourceUnits(source);
  assert.equal(units.filter(u=>u.text.includes('Headquartered in Nashville')).length,1);
  const selection=liveTechnologySelection();
  const q=validateSelection(selection,source);
  assert.ok(q.benefits.some(t=>t.includes('Plus 5 additional days')));
  assert.ok(q.benefits.some(t=>t.includes('Speaker Series Bonus')));
  assert.ok(q.important_requirements.some(t=>t.includes('9PM to 6AM PHT (Apr - Oct) or 10PM to 7AM PHT (Nov - Mar)')));
  assert.ok(q.important_requirements.some(t=>t.includes('must maintain authorization')));
  assert.ok(q.application_notes.some(t=>t.includes('AI-generated or incomplete')));
  assert.ok(q.requirements.some(t=>t.includes('Google Sheets or Excel')));
  assert.ok(q.requirements.includes('Proactive about spotting issues, finding answers, and escalating problems when needed.'));
  assert.ok(JSON.stringify(q).includes('₱37,500—₱46,000 PHP'));
  assert.equal(source.includes('Hi, we\'re TechnologyAdvice. Headquartered'),true);
});

test('37688 provider routing cues identify real application conditions, not ordinary finding answers',async()=>{
  const units=sourceUnits(liveTechnologySource);
  const warning=units.find(u=>u.text==='Any AI-generated or incomplete application answers will be auto-rejected.');
  const screening=units.find(u=>u.text==='Pre-employment screening required.');
  const qualification=units.find(u=>u.text==='Proactive about spotting issues, finding answers, and escalating problems when needed.');
  const selection=liveTechnologySelection();
  const env={OPENAI_API_KEY:'test-only',QUICK_READ_MODEL:'gpt-5-mini'};
  const result=await generateWithProvider(env,liveTechnologySource,async(url,init)=>{
    const body=JSON.parse(init.body);
    const ids=JSON.parse(body.input).application_note_ids;
    for(const unit of [warning,screening]) assert.ok(ids.includes(unit.id));
    assert.equal(ids.includes(qualification.id),false);
    assert.match(body.instructions,/finding answers are not application conditions/);
    return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(selection)}]}]});
  });
  assert.ok(result.application_notes.includes(warning.text));
  assert.ok(result.application_notes.includes(screening.text));
  assert.ok(result.requirements.includes(qualification.text));
  assert.deepEqual(validateStored(result,liveTechnologySource),result);
  let finish;
  const hash=await sourceFingerprint(liveTechnologySource);
  const persisted=await generateJob(env,'37688',{
    call:async(e,name,args)=>name==='claim_job_quick_read'
      ?{status:'claimed',description:liveTechnologySource,source_hash:hash}
      :(finish=args,{status:'ready'}),
    generate:async()=>result
  });
  assert.equal(persisted.status,'ready');
  assert.equal(finish.p_error,null);
  assert.ok(finish.p_payload.application_notes.includes(warning.text));
  assert.ok(finish.p_payload.requirements.includes(qualification.text));
  for(const key of ['requirements','responsibilities','important_requirements','benefits']) {
    const misplaced=structuredClone(selection);
    misplaced.application_notes=misplaced.application_notes.filter(id=>id!==warning.id);
    misplaced[key].push(warning.id);
    assert.throws(()=>validateSelection(misplaced,liveTechnologySource),/application_condition_misplaced|unsupported_requirement/);
    await assert.rejects(generateWithProvider(env,liveTechnologySource,async()=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(misplaced)}]}]})),/application_condition_misplaced|unsupported_requirement/);
  }
  const omitted=structuredClone(selection);
  omitted.application_notes=omitted.application_notes.filter(id=>id!==warning.id);
  assert.throws(()=>validateSelection(omitted,liveTechnologySource),/source_omitted/);
});
test('strict schema rejects malformed, empty, additional keys, invented source IDs, duplicate and missing material',()=>{
  for(const q of [null,[],{}, {...validSelection(),salary:'invented'}, {...validSelection(),requirements:[999]}, {...validSelection(),application_notes:[]}, {...validSelection(),benefits:'free meals'}, {...validSelection(),company_overview:[0,0]}]) assert.throws(()=>validateSelection(q,technologySource));
});
test('preferences cannot become requirements and mixed required/preferred stays visibly mixed',()=>{
  const q=validSelection();q.requirements.push(q.nice_to_have.pop());assert.throws(()=>validateSelection(q,technologySource),/preference_upgraded/);
  const source=technologySource+'\nExcel required; Zoho preferred.';
  const mixed=validSelection(source);const id=sourceUnits(source).at(-1).id;
  assert.throws(()=>validateSelection(mixed,source),/mixed_obligation/);
  mixed.nice_to_have=mixed.nice_to_have.filter(n=>n!==id);mixed.other_details.push(id);
  assert.ok(validateSelection(mixed,source).other_details.includes('Excel required; Zoho preferred.'));
});
test('material eligibility and application conditions cannot be hidden under ordinary duties',()=>{
  for(const key of ['application_notes','important_requirements']) {
    const q=validSelection();q.responsibilities.push(q[key].pop());assert.throws(()=>validateSelection(q,technologySource),/misplaced/);
  }
});
test('stored corruption or invented facts falls back without partially displaying output',()=>{
  const q=validateSelection(validSelection(),technologySource);q.benefits.push('Free car');
  assert.equal(validateStored(q,technologySource),null);
  const html=renderJobRead(technologySource,q);
  assert.match(html,/This listing is shown from the employer/);assert.doesNotMatch(html,/Free car/);
});
test('original text remains byte-for-byte equivalent after HTML escaping',()=>{
  const source=technologySource+'\nA & B < 10; "quoted".\r\n';
  const selection=validSelection(source);const q=validateSelection(selection,source);
  const html=renderJobRead(source,q);
  const encoded=html.match(/<div class="qr-original">([\s\S]*?)<\/div>/)[1];
  const decoded=encoded.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  assert.equal(decoded,source);
});
test('HTML source normalization affects organizer input only',()=>{
  const html='<p>About the role</p><p>Coordinate client success operations with Salesforce &amp; Excel.</p><p>Philippines work authorization required; no visa sponsorship.</p>';
  assert.equal(sourceUnits(html)[1].text,'Coordinate client success operations with Salesforce & Excel.');
  assert.throws(()=>sourceUnits(html+'<script>alert(1)</script>'),/unsafe_source/);
});
test('no invention of salary/country from timezone; contradictions and source taxonomy persist',()=>{
  const source='Work 9AM AEST.\nLocation stated as Australia.\nLocation stated as Philippines.\nCategory: Insurance.\nSalary not specified.\nCoordinate finance operations for clients worldwide.';
  const q=Object.fromEntries(SECTIONS.map(k=>[k,[]]));q.other_details=sourceUnits(source).map(u=>u.id);
  assert.deepEqual(validateSelection(q,source).other_details,sourceUnits(source).map(u=>u.text));
  assert.equal(renderAtAGlance({description:source}),'');
});
test('Responses adapter uses server key, strict schema, no remote storage and validates completed output',async()=>{
  let sent;
  const env={OPENAI_API_KEY:'test-only',QUICK_READ_MODEL:'gpt-5-mini'};
  const q=await generateWithProvider(env,technologySource,async(url,init)=>{
    sent={url,init,body:JSON.parse(init.body)};
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(validSelection())}]}]});
  });
  assert.equal(sent.url,'https://api.openai.com/v1/responses');assert.equal(sent.body.store,false);
  assert.equal(sent.body.text.format.strict,true);assert.equal(sent.init.headers.Authorization,'Bearer test-only');
  assert.equal(q.version,2);
  for(const response of [{status:'incomplete',output:[]},{status:'completed',output:[{content:[{type:'refusal'}]}]},{status:'completed',output:[{content:[{type:'output_text',text:'bad'}]}]}]) await assert.rejects(generateWithProvider(env,technologySource,async()=>Response.json(response)));
});
test('fingerprint unchanged skips provider, changed source fingerprint differs',async()=>{
  assert.equal(await sourceFingerprint(technologySource),await sourceFingerprint(technologySource));
  assert.notEqual(await sourceFingerprint(technologySource),await sourceFingerprint(technologySource+' changed'));
  const result=await generateJob({},'42',{call:async()=>({status:'unchanged'}),generate:()=>assert.fail('Provider must not run')});
  assert.equal(result.status,'unchanged');
});
test('generation persists validated payload; malformed provider writes only failure metadata',async()=>{
  const hash=await sourceFingerprint(technologySource);let finish;
  const call=async(env,name,args)=>name==='claim_job_quick_read'?{status:'claimed',description:technologySource,source_hash:hash}:(finish=args,{status:args.p_error?'failed':'ready'});
  const deps={call,generate:async()=>validateSelection(validSelection(),technologySource)};
  assert.equal((await generateJob({QUICK_READ_MODEL:'test-model'},42,deps)).status,'ready');
  assert.equal(finish.p_payload.version,2);
  deps.generate=async()=>({summary:'Invented'});
  assert.equal((await generateJob({},42,deps)).status,'failed');assert.equal(finish.p_payload,null);
});
test('manual endpoint disabled, unauthorized, GET and batch gate never generate',async()=>{
  let calls=0;const deps={call:async()=>{calls++;}};
  assert.equal((await quickReadEndpoint(new Request('https://x',{method:'POST'}),{},42,deps)).status,503);
  assert.equal((await quickReadEndpoint(new Request('https://x'),{},42,deps)).status,405);
  const env={QUICK_READ_MODE:'manual',QUICK_READ_ADMIN_TOKEN:'x'.repeat(32),OPENAI_API_KEY:'test-only',QUICK_READ_MODEL:'test'};
  assert.equal((await quickReadEndpoint(new Request('https://x',{method:'POST'}),env,42,deps)).status,401);
  const req=()=>new Request('https://x',{method:'POST',headers:{authorization:'Bearer '+env.QUICK_READ_ADMIN_TOKEN},body:'{"limit":1900}'});
  assert.equal((await quickReadEndpoint(req(),env,null,deps)).status,403);
  assert.equal((await quickReadEndpoint(req(),{...env,QUICK_READ_BATCH_ENABLED:'true'},null,deps)).status,400);
  assert.equal(calls,0);
});
test('bounded batch stops at rate gate without advancing cursor past unprocessed job',async()=>{
  const env={QUICK_READ_MODE:'manual',QUICK_READ_ADMIN_TOKEN:'x'.repeat(32),OPENAI_API_KEY:'test-only',QUICK_READ_MODEL:'test',QUICK_READ_BATCH_ENABLED:'true'};
  const called=[];
  const call=async(e,name,args)=>{
    called.push({name,args});
    if(name==='quick_read_candidates') return [{id:'37688'},{id:'39665'},{id:'99999'}];
    return {status:args.p_job_id==='37688'?'unchanged':'rate_limited'};
  };
  const req=new Request('https://x',{method:'POST',headers:{authorization:'Bearer '+env.QUICK_READ_ADMIN_TOKEN},body:'{"limit":3,"after_id":"0"}'});
  const result=await (await quickReadEndpoint(req,env,null,{call})).json();
  assert.equal(result.results.length,2);assert.equal(result.next_after_id,'37688');
  assert.equal(called[0].args.p_limit,3);assert.equal(called.length,3);
});
test('At a glance uses authoritative values, omits absent ones and never assumes converted USD/currency/period',()=>{
  assert.equal(formatSalary({salary_min_usd:500}), '');assert.equal(formatSalary({salary_min:37500}), '');
  assert.equal(formatSalary({salary_min:46000,salary_max:37500,salary_currency:'PHP'}),'');
  const html=renderAtAGlance({salary_min:37500,salary_max:46000,salary_currency:'PHP',salary_period:'month',schedule_region:'PH night shift',employment_type:'Full Time',engagement_type:'Employee',experience_level:'Entry Level'});
  for(const s of ['37,500','46,000','month','PH night shift','Full-time','Employee','Entry Level']) assert.ok(html.includes(s));
  assert.doesNotMatch(html,/Location|Work setup/);
});
test('logo load/error/decode failure keeps accessible decorative fallback and never reveals broken image',()=>{
  for(const width of [0,120]) {
    const handlers={};const classes=new Set();
    const img={complete:true,naturalWidth:width,parentElement:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}},addEventListener:(event,fn)=>handlers[event]=fn};
    installLogoFallback(img);assert.equal(classes.has('qr-logo-loaded'),width>0);
    handlers.error();assert.equal(img.hidden,true);assert.equal(classes.size,0);
  }
  const html=detail({id:42,company:'TechnologyAdvice',description:technologySource,company_logo_url:'https://invalid.example/logo'});
  assert.match(html,/class="job-application-initials" aria-hidden="true">T<\/div>/);
  assert.doesNotMatch(html,/data-company-logo|TechnologyAdvice logo/);
  assert.match(detail({id:42,company:'TechnologyAdvice',description:technologySource}),/job-application-initials/);
});
