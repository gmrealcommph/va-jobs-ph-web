const $=id=>document.getElementById(id),message=$('health-message');let cursor=null,busy=false;
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const labels={active:'Active records',member_visible:'Member-visible jobs',aging:'Verified age 31–45 days',provisional_aging:'Legacy date 31–45 days',over_45:'Provisional over 45 days',hidden_expired:'Inactive / hidden records',missing_original_dates:'Missing original date',missing_legacy_dates:'Missing legacy posting date',verification_failures:'Verification failures',unverified:'Unverified / stale evidence',member_reports:'Open member reports'};
const date=value=>value?new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila'}):'Unknown';
function reviewForm(job,report){
 const form=node('form'),legend=node('legend',report?'Review member report':'Record job review'),box=node('fieldset');box.append(legend);
 for(const [name,value] of Object.entries({job_id:job.id,report_id:report?.id||'',revision:report?.revision??job.revision})){const input=node('input');input.type='hidden';input.name=name;input.value=value;box.append(input);}
 const action=node('select');action.name='action';for(const [value,label] of report?[['resolved','Resolve report'],['dismissed','Dismiss report']]:[['needs_review','Needs review'],['reviewed','Reviewed'],['evergreen','Evergreen exception']]){const option=node('option',label);option.value=value;action.append(option);}const actionLabel=node('label','Decision ');actionLabel.append(action);box.append(actionLabel);
 const reason=node('textarea');reason.name='reason';reason.required=true;reason.minLength=3;reason.maxLength=1000;const reasonLabel=node('label','Review reason (required)');reasonLabel.append(reason);box.append(reasonLabel);
 if(!report){const expiry=node('input');expiry.type='date';expiry.name='expires_at';const l=node('label','Evergreen review expiry (within 90 days)');l.append(expiry);box.append(l);action.addEventListener('change',()=>{expiry.required=action.value==='evergreen';});}
 const button=node('button','Save review');button.type='submit';box.append(button);form.append(box);
 form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;message.textContent='Saving review…';try{const r=await fetch('/admin/api/job-health',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(form))});const d=await r.json();if(!r.ok)throw Error(d.error||'Review failed.');message.textContent='Review saved. Evergreen exceptions apply to public visibility.';await load(0);}catch(e){message.textContent=e.message;}finally{button.disabled=false;}});return form;
}
async function load(after=0){
 if(busy)return;busy=true;$('health-refresh').disabled=true;$('health-next').disabled=true;message.textContent='Loading Job Health…';
 try{const r=await fetch('/admin/api/job-health?after='+after+'&filter='+encodeURIComponent($('health-filter').value));const d=await r.json();if(!r.ok)throw Error(d.error||'Could not load Job Health.');
 $('health-metrics').replaceChildren(...Object.entries(labels).map(([key,label])=>{const card=node('article',label);card.append(node('strong',String(d.metrics[key]??0)));return card;}));
 $('health-queue').replaceChildren(...d.queue.map(job=>{const card=node('article');card.append(node('h3',job.title+' · '+job.company));const link=node('a','View listing');link.href='/jobs/'+job.id;card.append(link);
 card.append(node('p',`Record: ${job.status} · Member-visible: ${job.visible?'yes':'no'} · ${job.source}`),node('p',`Employer posting date: ${date(job.original_posted_at)} · Legacy date: ${date(job.legacy_posted_at)} · Imported: ${date(job.imported_at)}`),node('p',`Last checked: ${date(job.last_checked_at)} · Last verified open: ${date(job.last_verified_at)} · ${job.verification_status||'unverified'} · ${job.verification_reason||'No source evidence recorded'}`),node('p',`Review: ${job.review_state||'not reviewed'} · ${job.review_reason||''} · Expiry: ${date(job.expires_at)}`));
 card.append(node('p',`Source last publication: ${date(job.source_published_at)} · Date provenance: ${job.date_provenance||'unknown'}`));
 if(job.evidence_url){try{const u=new URL(job.evidence_url);if(u.protocol==='https:'){const a=node('a','Source evidence');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}}catch{}}
 for(const report of job.reports){card.append(node('h4',report.category.replaceAll('_',' ')+' · '+date(report.created_at)),node('p',report.details||'No additional details'),reviewForm(job,report));}card.append(reviewForm(job));return card;}));
 cursor=d.next_after;$('health-next').hidden=cursor===null;message.textContent=`Checked ${date(d.checked_at)}. ${d.queue.length} review candidates on this page. Date-based public freshness rules are active.`;
 }catch(e){message.textContent=e.message;}finally{busy=false;$('health-refresh').disabled=false;$('health-next').disabled=false;}
}
$('health-refresh').addEventListener('click',()=>load(0));$('health-filter').addEventListener('change',()=>load(0));$('health-next').addEventListener('click',()=>load(cursor));load();
