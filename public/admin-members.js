const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text??'—');return node;};
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
   dialog.append(el('p','Deletion permanently removes personal data and ends Pro access. Financial receipts are detached and preserved; payments are not refunded. Open checkout links must be closed.'));
   const actions=el('form'),action=el('select'),reason=el('textarea'),confirmation=el('input'),password=el('input'),send=el('button','Confirm action'),message=el('p');
   for(const value of ['suspend','reactivate','delete']){const o=el('option',value);o.value=value;action.append(o);}
   const label=(text,node)=>{const l=el('label',text);l.append(node);return l;};
   reason.required=true;reason.minLength=5;reason.maxLength=500;confirmation.required=true;password.type='password';password.autocomplete='current-password';password.required=true;password.maxLength=128;message.setAttribute('role','status');
   const hint=el('p');const paint=()=>{hint.textContent='Type '+action.value.toUpperCase()+' '+id+' to confirm.';confirmation.value='';};action.onchange=paint;paint();
   actions.append(label('Action',action),label('Reason for audit log',reason),hint,label('Typed confirmation',confirmation),label('Your current admin password',password),send,message);
   if(data.actions_enabled&&!member.protected)dialog.append(actions);else dialog.append(el('p',member.protected?'Administrator accounts are protected.':'Member actions await activation approval.'));
   dialog.append(el('h3','Recent audit history'));for(const entry of data.audit||[])dialog.append(el('p',entry.created_at+' · '+entry.action+' · '+entry.reason+' · Admin '+entry.actor));
   actions.onsubmit=async e=>{e.preventDefault();if(confirmation.value!==action.value.toUpperCase()+' '+id){message.textContent='Confirmation does not match.';return;}send.disabled=true;
    try{const r=await fetch('/admin/api/members',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({id,action:action.value,reason:reason.value,confirm:confirmation.value,password:password.value,token:data.token})});const result=await r.json();password.value='';if(!r.ok)throw Error(result.error);dialog.close();await load();}catch(error){password.value='';message.textContent=error.message;send.disabled=false;}
   };
   dialog.addEventListener('close',()=>{password.value='';dialog.remove();});doc.body.append(dialog);dialog.showModal();close.focus();
  }catch(error){status.textContent=error.message;}
 }
 async function load(){if(loading)return;loading=true;prev.disabled=next.disabled=submit.disabled=true;status.textContent='Loading members…';try{const data=await read({q:query.value,filter:filter.value,offset}),table=el('table'),head=el('tr');for(const text of ['Member','Verification','Status','Review','Details'])head.append(el('th',text));table.append(head);for(const m of data.members.slice(0,50)){const row=el('tr');row.append(el('td',m.email),el('td',m.email_confirmed_at?'Verified':'Unverified'),el('td',m.suspended?'Suspended':'Active'),el('td',m.review_reason||'—'));const cell=el('td'),button=el('button','Review');button.type='button';button.onclick=()=>details(m.id);cell.append(button);row.append(cell);table.append(row);}list.replaceChildren(table);status.textContent=data.members.length?'Showing members '+(offset+1)+'–'+(offset+Math.min(50,data.members.length)): 'No members found.';prev.disabled=offset===0;next.disabled=data.members.length<=50;}catch(error){list.replaceChildren();status.textContent=error.message;}finally{loading=false;submit.disabled=false;}}
 form.onsubmit=e=>{e.preventDefault();offset=0;void load();};prev.onclick=()=>{offset=Math.max(0,offset-50);void load();};next.onclick=()=>{offset+=50;void load();};void load();
}
if(typeof document!=='undefined')initMembers();
