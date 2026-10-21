import {compose,showPages,pdfBytes} from './resume-export.js';
import {readPhoto,cropPhoto,validateDesignDraft} from './resume-photo.js';
import {styles,renderResume} from './resume-layouts.js';
import {parseResume,validateDraft,checklist,readiness} from './resume-tools.js';
const $=s=>document.querySelector(s),form=$('#resume-form'),status=$('#studio-status');
let reviewing=false,version=0,reviewController,importRevision=0;
const values=()=>Object.fromEntries(new FormData(form));
function notice(text){status.textContent=text;}
let selectedStyle='classic',photo=null,photoRevision=0,renderRevision=0,latestPlan=null;
function saveBlob(bytes,type,name){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function paginate(d){const revision=++renderRevision;latestPlan=null;$('#export').disabled=true;try{const portrait=photo?await cropPhoto(photo.src,photo.x,photo.y,photo.zoom):null;const plan=await compose(d,selectedStyle,$('#resume-accent').value,portrait);if(revision!==renderRevision)return;latestPlan=plan;showPages($('#resume-preview'),plan);$('#export').disabled=false;}catch(e){if(revision!==renderRevision)return;$('#export').disabled=true;$('#resume-preview').classList.remove('paginated-resume');renderResume($('#resume-preview'),d,selectedStyle,$('#resume-accent').value);notice(e.message);}}
$('#resume-photo').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;const revision=++photoRevision;try{const src=await readPhoto(file);if(revision!==photoRevision)return;photo={src,x:50,y:50,zoom:1};for(const [id,value] of [['photo-x',50],['photo-y',50],['photo-zoom',1]])$('#'+id).value=value;$('#photo-status').textContent='Photo added locally. Shown in all designs. Use sliders to adjust the photo crop.';render();}catch(e){notice(e.message);}finally{$('#resume-photo').value='';}};
for(const [id,key]of [['photo-x','x'],['photo-y','y'],['photo-zoom','zoom']])$('#'+id).oninput=()=>{if(photo){photo[key]=Number($('#'+id).value);render();}};
$('#remove-photo').onclick=()=>{photoRevision++;photo=null;$('#photo-status').textContent='No photo added.';render();};
function selectStyle(key){selectedStyle=key;for(const b of $('#style-options').children)b.setAttribute('aria-pressed',String(b.dataset.style===key));$('#style-description').textContent=styles[key].description;}

function render(){
 version++;const d=values();paginate(d);
 for(const el of document.querySelectorAll('.section-control'))el.querySelector('.section-state').textContent=d[el.dataset.field].trim()?'Added':'Optional';
 document.querySelector('[data-field="name"] .section-state').textContent=d.name.trim()?'Added':'Required for export';
 $('#resume-progress').textContent=Object.values(d).filter(x=>x.trim()).length+' of 8 sections filled · Only your name is required';
}
const sample={name:'Alex Morgan',headline:'Customer Success Specialist',contact:'alex@example.com · Manila',summary:'Thoughtful service. Clear communication.',experience:'Customer Support · 2023–present\nResolved requests and maintained helpful documentation.',education:'Business Administration',skills:'Customer care · CRM · Writing',projects:'Created a support resource library.'};
for(const [key,style] of Object.entries(styles)){
 const button=document.createElement('button');button.type='button';button.dataset.style=key;button.setAttribute('aria-pressed',String(key===selectedStyle));
 const frame=document.createElement('span');frame.className='thumbnail-frame';frame.setAttribute('aria-hidden','true');
 const thumb=document.createElement('span');thumb.className='resume-sheet resume-thumbnail';renderResume(thumb,sample,key,'forest');compose(sample,key,'forest').then(plan=>showPages(thumb,plan)).catch(()=>{});frame.append(thumb);
 const name=document.createElement('span');name.textContent=style.name;button.append(frame,name);
 button.onclick=()=>{selectStyle(key);render();};
 $('#style-options').append(button);
}
$('#style-description').textContent=styles.classic.description;
$('#resume-accent').onchange=()=>{render();for(const t of document.querySelectorAll('.resume-thumbnail'))compose(sample,t.dataset.style,$('#resume-accent').value).then(plan=>showPages(t,plan));};
function workspaceView(view){$('.studio-grid').dataset.view=view;$('#view-edit').setAttribute('aria-pressed',String(view==='edit'));$('#view-preview').setAttribute('aria-pressed',String(view==='preview'));}
$('#view-edit').onclick=()=>workspaceView('edit');$('#view-preview').onclick=()=>workspaceView('preview');
function setDraft(d){for(const input of form.elements)if(input.name)input.value=d[input.name]||'';render();$('#suggestions').replaceChildren();}
function mode(improve){$('#build-panel').hidden=improve;$('#improve-panel').hidden=!improve;$('#build-mode').setAttribute('aria-pressed',String(!improve));$('#improve-mode').setAttribute('aria-pressed',String(improve));}
$('#build-mode').onclick=()=>mode(false);$('#improve-mode').onclick=()=>mode(true);form.addEventListener('input',()=>{importRevision++;$('#suggestions').replaceChildren();render();});
$('#resume-source').addEventListener('input',()=>{version++;});
$('#parse').onclick=()=>{if(Object.values(values()).some(x=>x.trim())&&!window.confirm('Replace this draft with the pasted text? Duplicate or download this draft first to keep it.'))return;try{setDraft(parseResume($('#resume-source').value));mode(false);notice('Text copied into editable sections. Check every section before export.');}catch(e){notice(e.message);}};
$('#resume-file').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;const importing=++importRevision;
  if(Object.values(values()).some(x=>x.trim())&&!window.confirm('Replace this draft with the imported file? Download or duplicate this draft first to keep it.')){e.target.value='';return;}
  try{
    if(file.size>(/\.json$/i.test(file.name)?1700000:24000)||!(/\.(txt|json)$/i.test(file.name)))throw Error('Choose a .txt file under 24 KB or résumé draft .json under 1.7 MB.');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());if(importing!==importRevision)return;
    if(/\.json$/i.test(file.name)){const data=JSON.parse(text);const sections=validateDraft({...data,version:data.version===2?1:data.version});let restoredPhoto=null;if(data.version===2){validateDesignDraft(data,styles);if(data.photo){await cropPhoto(data.photo.src,data.photo.x,data.photo.y,data.photo.zoom);restoredPhoto=data.photo;}}if(importing!==importRevision)return;photoRevision++;photo=restoredPhoto;if(data.version===2){selectStyle(data.style);$('#resume-accent').value=data.accent;}for(const [id,key]of [['photo-x','x'],['photo-y','y'],['photo-zoom','zoom']])$('#'+id).value=photo?.[key]??(key==='zoom'?1:50);$('#photo-status').textContent=photo?'Draft photo restored locally.':'No photo added.';setDraft(sections);mode(false);notice('Draft restored. Check your details.');}
    else {if(text.length>6000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))throw Error('Use plain text under 6,000 characters.');$('#resume-source').value=text;notice('File read locally. Select “Use text in editable preview” to review it.');}
  }catch(error){notice(error.message);}finally{e.target.value='';}
};
function suggestions(items,heading){const root=$('#suggestions');root.replaceChildren();const title=document.createElement('h3');title.textContent=heading;root.append(title);for(const item of items){const article=document.createElement('article');if(item.quote){const q=document.createElement('blockquote');q.textContent=item.quote;article.append(q);}const p=document.createElement('p');p.textContent=item.advice;article.append(p);root.append(article);}}
$('#check').onclick=()=>{
 const items=readiness(values());
 suggestions(items,items.length?'Things to review · '+items.length+' prompts':'No common issues found · proofread every page');
 for(const [i,item] of items.entries()){
   const button=document.createElement('button');button.type='button';button.textContent='Go to '+item.field;
   button.onclick=()=>openSection(item.field);$('#suggestions').querySelectorAll('article')[i].append(button);
 }
 const heading=document.createElement('h3');heading.textContent='Writing guide';$('#suggestions').append(heading);
 for(const advice of checklist){const p=document.createElement('p');p.textContent=advice;$('#suggestions').append(p);}
};
$('#ai-review').onclick=async()=>{
  if(reviewing)return;if(!$('#ai-consent').checked){notice('Please consent before sending text for AI review.');return;}
  const text=$('#improve-panel').hidden?Object.values(values()).filter(Boolean).join('\n'):$('#resume-source').value;
  if(text.length<40||text.length>6000){notice('AI review needs 40–6,000 characters. Shorten your text and try again.');return;}
  reviewing=true;reviewController=new AbortController();const start=version;$('#ai-review').disabled=true;notice('Reviewing your text…');
  try{const r=await fetch('/api/resume/review',{method:'POST',headers:{'content-type':'application/json'},signal:reviewController.signal,body:JSON.stringify({text,consent:true})});const data=await r.json();if(!r.ok)throw Error(data.error||'Review unavailable.');if(start!==version){notice('Your draft changed. The old review was discarded.');return;}suggestions(data.suggestions,'AI review · edit your sections to apply');notice('Review each suggestion and edit only facts you can stand behind.');}
  catch(e){notice(e.message);}finally{reviewing=false;$('#ai-review').disabled=false;}
};
$('#download-draft').onclick=()=>{saveBlob(JSON.stringify({version:2,sections:values(),style:selectedStyle,accent:$('#resume-accent').value,photo},null,2),'application/json','my-resume-draft.json');notice('Draft downloaded with design and optional photo. It contains personal information; store it securely.');};
$('#clear').onclick=()=>{if(!window.confirm('Clear this draft? Download it first if you want to keep it. Other drafts in this tab stay intact.'))return;importRevision++;reviewController?.abort();photoRevision++;photo=null;$('#photo-status').textContent='No photo added.';setDraft({});$('#resume-source').value='';$('#resume-file').value='';$('#ai-consent').checked=false;notice('Résumé text and suggestions cleared from this tab. Downloaded files are yours to delete.');};
function validName(){if(values().name.trim())return true;notice('Add your name before exporting.');mode(false);workspaceView('edit');$('#r-name').focus();return false;}
$('#export').onclick=async()=>{if(!validName())return;const plan=latestPlan;if(!plan){notice('Wait for the page preview to finish.');return;}try{saveBlob(await pdfBytes(plan),'application/pdf','my-resume.pdf');notice('PDF downloaded. Review every page before sharing.');}catch(e){notice('PDF could not be created: '+e.message);}};
$('#export-word').onclick=async()=>{if(!validName())return;const button=$('#export-word');button.disabled=true;try{const {wordBlob}=await import('./resume-word.js');const blob=await wordBlob(values(),selectedStyle,$('#resume-accent').value,photo?await cropPhoto(photo.src,photo.x,photo.y,photo.zoom):null);saveBlob(blob,blob.type,'my-resume.docx');notice('Editable Word document downloaded in a simple single-column layout. Review pagination in Word before sharing.');}catch(e){notice('Word export failed: '+e.message);}finally{button.disabled=false;}};
$('#print-resume').onclick=()=>{if(!validName())return;if(!latestPlan){notice('Wait for the page preview to finish before printing.');return;}window.print();};
window.addEventListener('pagehide',()=>{drafts.length=0;importRevision++;photoRevision++;photo=null;setDraft({});$('#resume-source').value='';$('#ai-consent').checked=false;});
render();

// Drafts are deliberately kept only in this tab's memory.
const drafts=[{label:'Draft 1',data:null}];let activeDraft=0;
function snapshot(){return {source:$('#resume-source').value,improve:!$('#improve-panel').hidden,sections:values(),style:selectedStyle,accent:$('#resume-accent').value,photo:photo?{...photo}:null};}
function refreshDrafts(){const select=$('#draft-select');select.replaceChildren();drafts.forEach((d,i)=>{const option=document.createElement('option');option.value=i;option.textContent=d.label;select.append(option);});select.value=activeDraft;}
function activateDraft(index){importRevision++;reviewController?.abort();drafts[activeDraft].data=snapshot();activeDraft=index;const d=drafts[index].data||{sections:{},style:'classic',accent:'forest',photo:null};photoRevision++;photo=d.photo?{...d.photo}:null;selectStyle(d.style);$('#resume-accent').value=d.accent;for(const [id,key] of [['photo-x','x'],['photo-y','y'],['photo-zoom','zoom']])$('#'+id).value=photo?.[key]??(key==='zoom'?1:50);$('#photo-status').textContent=photo?'Draft photo restored locally.':'No photo added.';$('#resume-source').value=d.source||'';$('#ai-consent').checked=false;setDraft(d.sections);mode(Boolean(d.improve));refreshDrafts();notice('Switched to '+drafts[index].label+'. Download a draft to keep it before leaving.');}
$('#draft-select').onchange=e=>activateDraft(Number(e.target.value));
function addDraft(copy){if(drafts.length>=10){notice('Up to 10 drafts per tab. Download your drafts to keep them.');return;}drafts.push({label:'Draft '+(drafts.length+1),data:copy?snapshot():null});activateDraft(drafts.length-1);}
$('#new-draft').onclick=()=>addDraft(false);$('#copy-draft').onclick=()=>addDraft(true);refreshDrafts();
const sections=[...document.querySelectorAll('.section-control')];
function openSection(key){mode(false);workspaceView('edit');for(const section of sections)section.open=section.dataset.field===key;$('#r-'+key).focus();}
for(const section of sections)section.addEventListener('toggle',()=>{if(section.open)for(const other of sections)if(other!==section)other.open=false;});
for(const [id,direction] of [['previous-section',-1],['next-section',1]])$('#'+id).onclick=()=>{const current=sections.findIndex(s=>s.open);openSection(sections[Math.max(0,Math.min(sections.length-1,current+direction))].dataset.field);};
for(const button of document.querySelectorAll('[data-step]'))button.onclick=()=>{workspaceView('edit');mode(false);if(button.dataset.step==='write')openSection('name');else if(button.dataset.step==='design'){$('.design-options').open=true;$('.design-options summary').focus();}else{$('#check').click();$('#check').focus();}};
