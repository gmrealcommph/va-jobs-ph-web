// Local, explicit edits to boilerplate only. Never rewrite applicant evidence.
export function reviseLetter(letter,style){
 const closing='Thank you for considering my application. I would welcome a conversation about your priorities and how I could contribute.';
 const replaceClosing=text=>letter.endsWith(closing)?letter.slice(0,-closing.length)+text:letter;
 if(style==='Shorter')return replaceClosing('Thank you for considering my application.');
 if(style==='Confident')return replaceClosing('I look forward to discussing your priorities and the contribution I could make. Thank you for your consideration.');
 if(style==='Conversational')return replaceClosing('Thank you for taking the time to read my application. I would be glad to talk about what your team needs.').replace(/^Dear hiring team,/, 'Hello hiring team,');
 return letter;
}
const keys=['summary','experience','education','skills','projects'];
export function selectedJob(value,origin=location.origin){
 if(!value.trim())return null;try{const u=new URL(value,origin);if(![origin,'https://veeays.com'].includes(u.origin))throw Error();const match=u.pathname.match(/^\/jobs\/([1-9]\d{0,18})\/?$/);if(!match)throw Error();return match[1];}catch{throw Error('Paste a VeeAys job link, such as https://veeays.com/jobs/123.');}
}
export function bindProTools({values,setField,changed}){
 const root=document.querySelector('#pro-tools');if(!root)return;
 const $=s=>root.querySelector(s),status=$('#pro-tool-status'),results=$('#pro-tool-results');let busy=false,revision=0;
 const answerKeys=['motivation','achievement','fit'];
 const answers=()=>Object.fromEntries(answerKeys.map(k=>[k,$('#pro-'+k).value]));
 function contextualQuestions(){
  const skill=(values().skills||'').split(/[;\n,]/)[0].trim().slice(0,90);
  $('#pro-achievement-label').textContent=skill?'Which accomplishment using “'+skill+'” could help with the selected role? Include a result only if true.':'Which specific accomplishment shows you can help with the selected role? Include a result only if true.';
  const experience=(values().projects||values().experience||'').split('\n').find(v=>v.trim())?.slice(0,90);
  $('#pro-fit-label').textContent=experience?'Beyond “'+experience+'”, what working style or experience would help you fit this role?':'What working style or experience fits the selected role beyond your résumé?';
 }
 root.querySelector('.pro-cover-context').addEventListener('toggle',contextualQuestions);
 $('#pro-job').addEventListener('input',contextualQuestions);
 root.closest('.studio')?.querySelector('#resume-form')?.addEventListener('input',contextualQuestions);
 $('#pro-skip-context').onclick=()=>{for(const k of answerKeys)$('#pro-'+k).value='';status.textContent='Questions skipped. You can draft using your résumé and the selected posting.';};
 contextualQuestions();
 const job=new URL(location.href).searchParams.get('job');if(/^[1-9]\d{0,18}$/.test(job||''))$('#pro-job').value=location.origin+'/jobs/'+job;
 const element=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
 root.closest('.studio')?.querySelector('#resume-form')?.addEventListener('input',()=>revision++);
 function show(data,tool,source){
  results.replaceChildren();
  if(tool==='cover-letter'){
   const label=element('label','Your editable cover letter'),area=document.createElement('textarea');area.rows=12;area.value=data.letter;area.id='pro-letter-output';label.htmlFor=area.id;results.append(label,area,element('p','Check all facts and wording before sharing. Nothing has been sent to an employer.'));
   const evidence=element('details',''),heading=element('summary','Source sections used');evidence.append(heading);for(const item of data.sources||[])evidence.append(element('h3',item.label),element('blockquote',item.quote));results.append(evidence);
   const download=element('button','Download cover letter (.txt)');download.type='button';download.onclick=()=>{const u=URL.createObjectURL(new Blob([area.value],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='cover-letter.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};results.append(download);
   const controls=element('div',''),note=element('p','Style changes run in this tab with no AI call. They adjust the introduction and closing; your evidence stays intact.');controls.className='pro-tool-actions';
   for(const style of ['Shorter','Confident','Conversational']){const button=element('button',style);button.type='button';button.onclick=()=>{const before=area.value,after=reviseLetter(before,style);area.value=after;undo.hidden=false;undo.onclick=()=>{if(area.value!==after){status.textContent='Your newer edits were kept.';return;}area.value=before;undo.hidden=true;};status.textContent='Style updated locally. Review before sharing.';};controls.append(button);}
   const undo=element('button','Undo style change');undo.type='button';undo.hidden=true;controls.append(undo);results.append(note,controls);return;
  }
  if(!data.suggestions.length)results.append(element('p','No edits suggested. Proofread your résumé and adapt it to the role.'));
  for(const suggestion of data.suggestions){
   const article=document.createElement('article');article.className='pro-edit';article.append(element('h3',suggestion.field[0].toUpperCase()+suggestion.field.slice(1)),element('blockquote',suggestion.quote),element('p',suggestion.reason));
   if(suggestion.rewrite===suggestion.quote){article.append(element('p','Your source wording is unchanged. Revise it in the editor if you choose.'));results.append(article);continue;}
   const label=element('label','Suggested wording · edit before applying'),area=document.createElement('textarea');area.value=suggestion.rewrite;area.rows=3;area.maxLength=2500;label.append(area);article.append(label);
   const apply=element('button','Apply this edit'),undo=element('button','Undo edit');apply.type=undo.type='button';undo.hidden=true;let before,after;
   apply.onclick=()=>{before=values()[suggestion.field]||'';if(!before.includes(suggestion.quote)||!area.value.trim()){status.textContent='This section changed or the suggestion is empty. Review it before applying.';return;}after=before.replace(suggestion.quote,area.value.trim());if(after.length>2500){status.textContent='This edit is too long for the section.';return;}setField(suggestion.field,after);changed();apply.disabled=true;undo.hidden=false;status.textContent='Edit applied. Check the preview; you can undo it.';};
   undo.onclick=()=>{if(values()[suggestion.field]!==after){status.textContent='This section has changed since applying. Your newer edits were kept.';return;}setField(suggestion.field,before);changed();apply.disabled=false;undo.hidden=true;status.textContent='Original wording restored.';};article.append(apply,undo);results.append(article);
  }
 }
 async function run(tool){
  if(busy)return;if(!$('#pro-ai-consent').checked){status.textContent='Please agree before sending your résumé text.';return;}
  let job_id;try{job_id=selectedJob($('#pro-job').value);}catch(e){status.textContent=e.message;return;}if(tool==='cover-letter'&&!job_id){status.textContent='Choose a VeeAys job for your cover letter.';return;}
  const context=tool==='cover-letter'?answers():null,contextSnapshot=JSON.stringify(context);
  const sections=Object.fromEntries(keys.map(k=>[k,values()[k]||''])),snapshot=JSON.stringify(sections),current=revision,jobInput=$('#pro-job').value;
  busy=true;$('#pro-optimize').disabled=$('#pro-cover').disabled=true;status.textContent=tool==='optimize'?'Reviewing your existing experience…':'Drafting your introduction…';
  try{const r=await fetch('/api/pro-tools/'+tool,{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(30000),body:JSON.stringify({sections,job_id,consent:true,...(context?{answers:context}:{})})});const data=await r.json();if(!r.ok)throw Error(data.error||'Try again later. Your draft is unchanged.');if((context&&contextSnapshot!==JSON.stringify(answers()))||current!==revision||jobInput!==$('#pro-job').value||snapshot!==JSON.stringify(Object.fromEntries(keys.map(k=>[k,values()[k]||''])))){status.textContent='Your résumé, answers or selected job changed while this request ran. The older result was discarded.';return;}show(data,tool,sections);if(data.job)$('#pro-job-status').textContent=data.job.title+' · '+data.job.company;status.textContent=(data.demo?'Example response · no AI used. ':data.cached?'Saved result reused. ':'Ready. ')+(tool==='optimize'?'Review each source-preserving edit before applying.':'Edit and check the letter before sharing.');}catch(e){status.textContent=e.name==='TimeoutError'?'This request took too long. No automatic retry was made. Your draft is safe.':e.message;}finally{busy=false;$('#pro-optimize').disabled=$('#pro-cover').disabled=false;}
 }
 $('#pro-optimize').onclick=()=>run('optimize');$('#pro-cover').onclick=()=>run('cover-letter');
 return {reset(){revision++;for(const k of answerKeys)$('#pro-'+k).value='';contextualQuestions();results.replaceChildren();status.textContent='';$('#pro-ai-consent').checked=false;}};
}
