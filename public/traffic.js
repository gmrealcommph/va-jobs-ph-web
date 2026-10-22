// Optional first-touch session analytics. No request or identifier before affirmative consent.
const allowed=/^\/(?:jobs(?:\/[1-9]\d{0,18})?|categories(?:\/[A-Za-z0-9%_-]{1,100})?|employers|about|pro)?\/?$/;
const privacy=location.pathname==='/privacy';
if(!/^\/(?:admin|api|auth|webhooks|account\/delete)(?:\/|$)/.test(location.pathname)){
 const initial={landing:location.pathname,referrer:document.referrer};
 const params=new URLSearchParams(location.search);
 for(const field of ['utm_source','utm_medium','utm_campaign']){const v=params.get(field);initial[field]=v&&/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(v)?v.toLowerCase():null;}
 // Strip referrer paths before sending; HTTP request details are never persisted by analytics.
 try{initial.referrer=new URL(initial.referrer).origin;}catch{initial.referrer='';}
 const blocked=()=>navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';
 const get=key=>{try{return localStorage.getItem(key);}catch{return null;}};
 const set=value=>{try{localStorage.setItem('veeays_analytics_choice_v2',value);}catch{}};
 const clear=()=>{try{localStorage.removeItem('veeays_traffic_session');}catch{}};
 const send=body=>fetch('/traffic/event',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
 async function collect(){
  if(!allowed.test(location.pathname)||privacy||blocked()||get('veeays_analytics_choice_v2')!=='yes')return;
  let session;try{session=JSON.parse(get('veeays_traffic_session'));}catch{}
  if(!session||session.expires<=Date.now()){
   session={...initial,id:crypto.randomUUID(),expires:Date.now()+1800000};
   try{localStorage.setItem('veeays_traffic_session',JSON.stringify(session));}catch{}
  }
  try{await send({...session,consent:true});}catch{}
 }
 async function track(){
  // Cross-tab lock prevents simultaneous first loads from allocating two sessions.
  if(navigator.locks)await navigator.locks.request('veeays-traffic',collect);else await collect();
 }
 const box=document.createElement('aside');box.className='traffic-choice';box.setAttribute('aria-label','Optional analytics');
 const button=document.createElement('button');button.type='button';button.textContent='Analytics choices';
 const panel=document.createElement('div');panel.hidden=true;panel.innerHTML='<p>Help us improve VeeAys. Allow optional Google Analytics to measure visits, sign-ups and Pro purchases. Your choice won’t affect browsing. <a href="/privacy">Privacy details</a></p>';
 const accept=document.createElement('button');accept.type='button';accept.className='traffic-allow';accept.textContent='Allow analytics';
 const decline=document.createElement('button');decline.type='button';decline.className='traffic-decline';decline.textContent=privacy?'Decline / withdraw':'Decline';
 const status=document.createElement('p');status.setAttribute('role','status');
 button.onclick=()=>{panel.hidden=!panel.hidden;};
 accept.onclick=()=>{if(blocked()){status.textContent='Your browser privacy preference blocks optional analytics.';return;}set('yes');window.dispatchEvent(new Event('veeays:consent'));status.textContent='Optional analytics allowed.';panel.hidden=true;box.hidden=!privacy;track();};
 decline.onclick=()=>{set('no');window.dispatchEvent(new Event('veeays:consent'));clear();send({consent:false}).catch(()=>{});status.textContent='Optional analytics declined. Future collection stopped.';panel.hidden=true;box.hidden=!privacy;};
 panel.append(accept,decline);box.append(button,panel,status);document.body.append(box);
 if(!get('veeays_analytics_choice_v2')&&!blocked())panel.hidden=false;
 box.hidden=!privacy&&(!!get('veeays_analytics_choice_v2')||blocked());
 if(blocked()){clear();if(get('veeays_analytics_choice_v2')==='yes')send({consent:false}).catch(()=>{});}else track();
 window.addEventListener('storage',e=>{if(e.key!=='veeays_analytics_choice_v2')return;if(e.newValue!=='yes')clear();box.hidden=!privacy&&(!!e.newValue||blocked());panel.hidden=privacy||!!e.newValue||blocked();});
}
