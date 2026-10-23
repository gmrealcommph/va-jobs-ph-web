// One anonymous event per in-memory draft. Never read or transmit form contents.
export function completionReporter({send=globalThis.fetch,uuid=()=>crypto.randomUUID()}={}){
 const ids=new WeakMap(),done=new WeakSet(),pending=new WeakSet();
 return async draft=>{
  if(!draft||done.has(draft)||pending.has(draft))return;
  if(typeof navigator!=='undefined'&&(navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true))return;
  if(!ids.has(draft))ids.set(draft,uuid());pending.add(draft);
  try{const r=await send('/tools/resume-completed',{method:'POST',headers:{'content-type':'application/json'},credentials:'omit',body:JSON.stringify({id:ids.get(draft)}),signal:AbortSignal.timeout(2500)});if(r.ok)done.add(draft);}catch{}finally{pending.delete(draft);}
 };
}
