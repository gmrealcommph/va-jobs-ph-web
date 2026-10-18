const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text??'—');return node;};
let turnstileReady;
export function loadTurnstile(doc=document){
 if(globalThis.turnstile)return Promise.resolve(globalThis.turnstile);
 if(!turnstileReady)turnstileReady=new Promise((resolve,reject)=>{
  const script=doc.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
  const timer=setTimeout(()=>{script.remove();turnstileReady=undefined;reject(Error('Security check unavailable. Reopen member details.'));},15000);
  script.onload=()=>{clearTimeout(timer);if(globalThis.turnstile)resolve(globalThis.turnstile);else{turnstileReady=undefined;reject(Error('Security check unavailable.'));}};
  script.onerror=()=>{clearTimeout(timer);script.remove();turnstileReady=undefined;reject(Error('Security check unavailable. Reopen member details.'));};doc.head.append(script);
 });return turnstileReady;
}
export function memberChallenge(api,host,sitekey,send){
 let token='';send.disabled=true;
 const invalidate=()=>{token='';send.disabled=true;};
 const widget=api.render(host,{sitekey,action:'admin-reauth',callback:value=>{token=value;send.disabled=!value;},'expired-callback':invalidate,'error-callback':invalidate,'timeout-callback':invalidate});
 return {token:()=>token,reset:()=>{invalidate();api.reset(widget);},remove:()=>{invalidate();api.remove(widget);}};
}
export function initMembers(doc=document){
 const host=doc.getElementById('members');if(!host)return;
 const article=el('article'),title=el('h3','Manage members'),form=el('form'),query=el('input'),filter=el('select'),submit=el('button','Search'),status=el('p'),list=el('div'),prev=el('button','Previous'),next=el('button','Next');
 article.id='member-management';query.type='search';query.maxLength=100;query.setAttribute('aria-label','Search members by name, email or ID');query.placeholder='Name, email or member ID';
 filter.setAttribute('aria-label','Filter members');for(const [value,label] of [['all','All members'],['verified','Verified'],['unverified','Unverified'],['suspended','Suspended'],['review','Needs review']]){const o=el('option',label);o.value=value;filter.append(o);}
 status.setAttribute('role','status');list.className='table-wrap';form.append(query,filter,submit);article.append(title,el('p','Review flags are hints from a limited domain list and verification age. They do not prove abuse. No automatic deletion occurs.'),form,status,list,prev,next);host.append(article);
 let offset=0,loading=false;
 const read=async(params)=>{const r=await fetch('/admin/api/members?'+new URLSearchParams(params),{credentials:'same-origin',cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Members unavailable');return d;};
 async function details(id){
  try{
   const data=await read({id}),member=data.members[0];if(!member)throw Error('Member unavailable');
   const dialog=el('dialog');dialog.className='member-dialog';const close=el('button','Close');close.type='button';close.onclick=()=>dialog.close();dialog.append(el('h2',member.email),close);
   for(const field of ['id','full_name','created_at','email_confirmed_at','last_sign_in_at','plan','plan_status','pro_expires_at','suspended','review_reason','confirmed_receipts'])dialog.append(el('p',field.replaceAll('_',' ')+': '+(member[field]??'—')));
   dialog.append(el('p','Deletion permanently removes personal data. Pro members are protected from admin actions. Accounts with billing records are protected from admin deletion. Payments are not refunded.'));
   if(member.deletion_protected)dialog.append(el('p','Deletion is disabled because this member has billing records.'));
   const actions=el('form'),action=el('select'),reason=el('textarea'),confirmation=el('input'),password=el('input'),send=el('button','Confirm action'),message=el('p');
   let challenge;const captchaHost=el('div');
   for(const value of (member.deletion_protected?['suspend','reactivate']:['suspend','reactivate','delete'])){const o=el('option',value);o.value=value;action.append(o);}
   const label=(text,node)=>{const l=el('label',text);l.append(node);return l;};
   reason.required=true;reason.minLength=5;reason.maxLength=500;confirmation.required=true;password.type='password';password.autocomplete='current-password';password.required=true;password.maxLength=128;message.setAttribute('role','status');
   const hint=el('p');const paint=()=>{hint.textContent='Type '+action.value.toUpperCase()+' '+id+' to confirm.';confirmation.value='';};action.onchange=paint;paint();
   actions.append(label('Action',action),label('Reason for audit log',reason),hint,label('Typed confirmation',confirmation),label('Your current admin password',password),captchaHost,send,message);
   if(data.actions_enabled&&!member.protected&&member.plan==='free')dialog.append(actions);else dialog.append(el('p',member.protected?'Administrator accounts are protected.':member.plan!=='free'?'Pro or unclassified members are protected.':'Member actions await activation approval.'));
   dialog.append(el('h3','Recent audit history'));for(const entry of data.audit||[])dialog.append(el('p',entry.created_at+' · '+entry.action+' · '+entry.reason+' · Admin '+entry.actor));
   actions.onsubmit=async e=>{e.preventDefault();if(confirmation.value!==action.value.toUpperCase()+' '+id){message.textContent='Confirmation does not match.';return;}send.disabled=true;
    try{if((data.captcha?.required||data.captcha?.site_key)&&!challenge?.token())throw Error('Complete the security check.');const r=await fetch('/admin/api/members',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({id,action:action.value,reason:reason.value,confirm:confirmation.value,password:password.value,token:data.token,captchaToken:challenge?.token()})});const result=await r.json();password.value='';if(!r.ok)throw Error(result.error);dialog.close();await load();}catch(error){password.value='';message.textContent=error.message;send.disabled=false;}finally{challenge?.reset();}
   };
   dialog.addEventListener('close',()=>{password.value='';challenge?.remove();challenge=undefined;dialog.remove();});doc.body.append(dialog);dialog.showModal();close.focus();
   if(data.actions_enabled&&!member.protected&&member.plan==='free'&&(data.captcha?.required||data.captcha?.site_key)){
    send.disabled=true;
    try{if(!data.captcha.site_key)throw Error('Security check unavailable.');const api=await loadTurnstile(doc);if(dialog.open)challenge=memberChallenge(api,captchaHost,data.captcha.site_key,send);}catch(error){message.textContent=error.message;}
   }
  }catch(error){status.textContent=error.message;}
 }
 async function load(){if(loading)return;loading=true;prev.disabled=next.disabled=submit.disabled=true;status.textContent='Loading members…';try{const data=await read({q:query.value,filter:filter.value,offset}),table=el('table'),head=el('tr');for(const text of ['Member','Verification','Status','Review','Details'])head.append(el('th',text));table.append(head);for(const m of data.members.slice(0,50)){const row=el('tr');row.append(el('td',m.email),el('td',m.email_confirmed_at?'Verified':'Unverified'),el('td',m.suspended?'Suspended':'Active'),el('td',m.review_reason||'—'));const cell=el('td'),button=el('button','Review');button.type='button';button.onclick=()=>details(m.id);cell.append(button);row.append(cell);table.append(row);}list.replaceChildren(table);status.textContent=data.members.length?'Showing members '+(offset+1)+'–'+(offset+Math.min(50,data.members.length)): 'No members found.';prev.disabled=offset===0;next.disabled=data.members.length<=50;}catch(error){list.replaceChildren();status.textContent=error.message;}finally{loading=false;submit.disabled=false;}}
 form.onsubmit=e=>{e.preventDefault();offset=0;void load();};prev.onclick=()=>{offset=Math.max(0,offset-50);void load();};next.onclick=()=>{offset+=50;void load();};void load();
}
if(typeof document!=='undefined')initMembers();


