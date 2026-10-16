import {updateProcessingCard} from './admin-processing-card.js';
const stamp=value=>value?Date.parse(value):NaN;
const freshWindow=45000;
export function processingState(data,age=0){
 if(!data||age>freshWindow)return {state:'unavailable',animate:false,label:'Monitoring unavailable',detail:'Live data is stale or unavailable. Activity is unconfirmed.'};
 const now=stamp(data.checked_at)+age;
 if(!Number.isFinite(now))return {state:'unavailable',animate:false,label:'Monitoring unavailable',detail:'No valid observation timestamp.'};
 const running=data.running||[];
 const stale=running.some(j=>!Number.isFinite(stamp(j.lease_until))||stamp(j.lease_until)<=now);
 if(stale||data.unmatched_running>0)return {state:'stalled',animate:false,label:'Stalled · review needed',detail:'A running record has an expired or missing lease, or disagrees with the queue.'};
 const confirmed=running.filter(j=>stamp(j.started_at)<=now&&stamp(j.started_at)>now-180000&&stamp(j.lease_until)>now);
 if(confirmed.length)return {state:'processing',animate:true,label:'Processing',detail:'Activity confirmed by a recent claim and unexpired lease; no worker heartbeat is recorded.'};
 if(running.length)return {state:'unconfirmed',animate:false,label:'Activity unconfirmed',detail:'Running records exist without a recent claim timestamp.'};
 if(data.runtime_enabled!==true||data.gate?.enabled!==true||data.automation?.enabled!==true)return {state:'paused',animate:false,label:'Paused',detail:'Automatic processing is disabled by an existing gate. Queued jobs are waiting.'};
 if(data.counts?.queued>0&&now-stamp(data.oldest_due)>900000&&(!data.latest_worker_record||now-stamp(data.latest_worker_record)>900000))return {state:'stalled',animate:false,label:'Possible stall',detail:'Due work has waited over 15 minutes without a new worker record. Worker health is unconfirmed.'};
 if(data.counts?.failed>0&&data.recent?.[0]?.event==='failed')return {state:'failed',animate:false,label:'Last attempt failed',detail:'The latest queue activity is a failed attempt. No active claim is confirmed.'};
 return {state:'idle',animate:false,label:data.counts?.queued?'Waiting for next scheduled run':'Idle · queue empty',detail:data.counts?.queued?'No job is running right now. The worker checks for eligible jobs every minute.':'No active worker claim is confirmed.'};
}
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>Number.isFinite(stamp(value))?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'medium'}).format(new Date(value)):'Unavailable';
const duration=ms=>Number.isFinite(ms)&&ms>=0?Math.floor(ms/60000)+'m '+Math.floor(ms/1000)%60+'s':'Unavailable';
export function scheduleCountdown(nextAt,now){
 const remaining=stamp(nextAt)-now;
 return Number.isFinite(remaining)?remaining>0?duration(Math.ceil(remaining/1000)*1000):'Scheduled check due · awaiting worker confirmation':'Unavailable';
}
function renderSchedule(data,state,now){
 if(['unavailable','paused'].includes(state.state))return '';
 if(!data?.schedule?.available||!Number.isFinite(stamp(data.schedule.next_expected_at)))return '<p class="qr-live-note">Next scheduled check: unavailable.</p>';
 return '<div class="qr-schedule"><div><strong>Next scheduled check · estimate</strong><p>'+date(data.schedule.next_expected_at)+'</p></div><div><strong data-next-check="'+esc(data.schedule.next_expected_at)+'">'+scheduleCountdown(data.schedule.next_expected_at,now)+'</strong><p>One check every minute</p></div></div><p class="qr-live-note">The countdown shows the expected scheduler time. Processing is confirmed only when a job is claimed; checks may find no eligible work.</p>';
}
function stageBalls(value,cx,cy,rx,ry,tone){
 if(!Number.isFinite(value)||value<0)return '';
 const count=Math.min(200,Math.floor(value)),radius=Math.max(1.5,Math.min(5,Math.sqrt(rx*ry/Math.max(1,count))*.48));
 return '<g class="qr-balls qr-balls-'+tone+'">'+Array.from({length:count},(_,i)=>{
 const phase=i*2.399963,spread=Math.sqrt((i+.5)/Math.max(1,count)),x=spread*rx,y=spread*ry;
 return '<circle cx="'+(cx+Math.cos(phase)*x).toFixed(2)+'" cy="'+(cy+Math.sin(phase)*y).toFixed(2)+'" r="'+radius.toFixed(2)+'"'+(tone==='queue'?' data-orbit-x="'+x.toFixed(2)+'" data-orbit-y="'+y.toFixed(2)+'" data-orbit-phase="'+phase.toFixed(4)+'"':'')+'/>';
 }).join('')+'</g>';
}
export function startWaitingBallAnimation(root,win=window,doc=document){
 const reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
 let frame=0,last=0,scene=null,balls=[],stopped=false;
 const draw=time=>{
  frame=0;if(stopped||doc.hidden||reduced.matches)return;
  if(time-last>=30){
   last=time;
   if(scene!==root.firstElementChild){scene=root.firstElementChild;balls=[...root.querySelectorAll('.qr-balls-queue circle')].map(el=>({el,x:Number(el.dataset.orbitX),y:Number(el.dataset.orbitY),phase:Number(el.dataset.orbitPhase)}));}
   if(scene&&!scene.classList.contains('unavailable'))for(const ball of balls){
    const angle=ball.phase+time/10000*Math.PI*2;
    ball.el.setAttribute('cx',(300+Math.cos(angle)*ball.x).toFixed(2));
    ball.el.setAttribute('cy',(67+Math.sin(angle)*ball.y).toFixed(2));
   }
  }
  frame=win.requestAnimationFrame(draw);
 };
 const resume=()=>{win.cancelAnimationFrame(frame);frame=0;if(!stopped&&!doc.hidden&&!reduced.matches)frame=win.requestAnimationFrame(draw);};
 const preference=()=>{if(reduced.matches)for(const ball of balls){ball.el.setAttribute('cx',(300+Math.cos(ball.phase)*ball.x).toFixed(2));ball.el.setAttribute('cy',(67+Math.sin(ball.phase)*ball.y).toFixed(2));}resume();};
 doc.addEventListener('visibilitychange',resume);if(reduced.addEventListener)reduced.addEventListener('change',preference);else reduced.addListener?.(preference);resume();
 return ()=>{stopped=true;win.cancelAnimationFrame(frame);doc.removeEventListener('visibilitychange',resume);if(reduced.removeEventListener)reduced.removeEventListener('change',preference);else reduced.removeListener?.(preference);};
}
export function renderProcessing(data,age=0,issue=''){
 const s=processingState(data,age),c=data?.counts,now=stamp(data?.checked_at)+age;
 if(s.state==='unavailable'&&issue)s.detail=esc(issue);
 const counts=[['Queued','queued'],['Processing','processing'],['Completed','completed'],['Failed','failed']];
 return '<div class="qr-live '+s.state+(s.animate?' is-active':'')+'"><div class="qr-live-heading"><div><h3>Live Processing Funnel</h3><p>Automatic queue · read-only · checks every 15 seconds</p></div><strong class="qr-live-badge" role="status">'+s.label+'</strong></div><p>'+s.detail+'</p>'+renderSchedule(data,s,now)+'<div class="qr-visual-board"><div class="qr-flow-shape" aria-hidden="true"><svg viewBox="0 0 600 340"><defs><linearGradient id="qr-blue" x2="1" y2="1"><stop stop-color="#8edbff"/><stop offset=".48" stop-color="#6594f5"/><stop offset="1" stop-color="#6250c9"/></linearGradient><linearGradient id="qr-orange" x2="1" y2="1"><stop stop-color="#ffdca0"/><stop offset=".5" stop-color="#f8a04d"/><stop offset="1" stop-color="#df6730"/></linearGradient><linearGradient id="qr-green" x2="1" y2="1"><stop stop-color="#b0f4cb"/><stop offset=".5" stop-color="#4dc39b"/><stop offset="1" stop-color="#21856e"/></linearGradient><radialGradient id="qr-halo"><stop stop-color="#b7b2ff" stop-opacity=".32"/><stop offset="1" stop-color="#b7b2ff" stop-opacity="0"/></radialGradient><filter id="qr-depth" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="12" stdDeviation="9" flood-color="#344779" flood-opacity=".18"/></filter></defs><ellipse cx="300" cy="160" rx="270" ry="140" fill="url(#qr-halo)"/><ellipse class="qr-orbit" cx="300" cy="245" rx="180" ry="27"/><ellipse class="qr-base" cx="300" cy="248" rx="94" ry="13"/><g class="qr-sculpture" filter="url(#qr-depth)"><g class="qr-tier qr-tier-top"><path d="M125 67 Q300 115 475 67 L410 135 Q300 180 190 135Z" fill="url(#qr-blue)"/><ellipse cx="300" cy="67" rx="175" ry="40" fill="url(#qr-blue)"/><ellipse cx="300" cy="67" rx="150" ry="28" fill="#273d8633"/>'+stageBalls(c?.queued,300,67,128,20,'queue','Queued')+'<path d="M145 56 Q300 8 455 56" fill="none" stroke="#fff" stroke-opacity=".72" stroke-width="2"/></g><g class="qr-tier qr-tier-middle"><path d="M190 145 Q300 180 410 145 L355 207 Q300 230 245 207Z" fill="url(#qr-orange)"/><ellipse cx="300" cy="145" rx="110" ry="28" fill="url(#qr-orange)"/><ellipse cx="300" cy="145" rx="88" ry="18" fill="#a9542428"/>'+stageBalls(c?.processing,300,145,77,13,'work','Processing')+'<path d="M204 138 Q300 107 396 138" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="2"/></g><g class="qr-tier qr-tier-bottom"><path d="M245 217 Q300 240 355 217 L327 253 Q300 267 273 253Z" fill="url(#qr-green)"/><ellipse cx="300" cy="217" rx="55" ry="17" fill="url(#qr-green)"/><path d="M255 213 Q300 194 345 213" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2"/></g>'+stageBalls(c?.completed,300,278,83,14,'done','Completed')+'<g class="qr-stream"><path d="M300 55V247"/><circle class="qr-particle" cx="300" cy="70" r="4"/><circle class="qr-particle qr-particle-delay" cx="300" cy="70" r="4"/></g></g><g class="qr-spark qr-spark-a"><path d="M88 131v14m-7-7h14"/></g><g class="qr-spark qr-spark-b"><path d="M494 190v12m-6-6h12"/></g><circle class="qr-satellite qr-satellite-a" cx="470" cy="105" r="7"/><circle class="qr-satellite qr-satellite-b" cx="155" cy="213" r="5"/></svg><div class="qr-scene-caption"><span class="qr-scene-dot"></span>Quick Read engine<span>Live queue snapshot</span></div></div><div class="qr-funnel">'+counts.map(([label,key],i)=>'<div class="qr-stage qr-stage-'+i+'"><span class="qr-stage-symbol" aria-hidden="true">'+['↗','✦','✓','!'][i]+'</span><span>'+label+'</span><strong>'+esc(c?.[key]??'—')+'</strong><i aria-hidden="true"></i></div>').join('')+'</div></div><div class="qr-live-details"><div><h4>Current job'+((data?.running?.length||0)>1?'s':'')+'</h4>'+(data?.running?.length?data.running.map(j=>'<p>'+esc(j.title||'Job '+j.job_id)+'<br><small>Elapsed since recorded claim: <span data-claim="'+esc(j.started_at)+'">'+duration(now-stamp(j.started_at))+'</span> · lease until '+date(j.lease_until)+'</small></p>').join(''):'<p>No active job recorded</p>')+'</div><div><h4>Most recent completion</h4><p>'+esc(data?.latest_completion?.title||'No completion recorded')+'<br><small>'+date(data?.latest_completion?.at)+(data?.latest_completion?.at?' · <span data-completed="'+esc(data.latest_completion.at)+'">'+duration(now-stamp(data.latest_completion.at))+' ago</span>':'')+'</small></p></div><div><h4>Throughput · automatic queue</h4><p>'+esc(data?.throughput?.last_hour??'—')+' completed / last hour<br>'+esc(data?.throughput?.last_24h??'—')+' completed / last 24 hours</p></div></div><p class="qr-live-note">'+(c?'Queue total '+esc(c.total)+' · other stopped '+esc(c.stopped_other)+'. All historical Quick Reads: '+esc(data.all_reads?.ready??'—')+' ready, '+esc(data.all_reads?.failed??'—')+' failed.':'Counts unavailable.')+' Counts describe current records. Recent activity shows the latest state per job, not a full event history.</p><details><summary>Recent activity</summary><ul class="qr-activity">'+(data?.recent||[]).map(j=>'<li><strong>'+esc(j.event)+'</strong> '+esc(j.title||'Job '+j.job_id)+'<small>'+date(j.at)+(j.error_code?' · '+esc(j.error_code):'')+'</small></li>').join('')+'</ul></details><p class="qr-live-note">Observed '+date(data?.checked_at)+' · Manila time'+(age>freshWindow?' · stale':'')+'</p></div>';
}
export function startProcessingMonitor(root){
 const stopBallMotion=startWaitingBallAnimation(root);
 let data=null,received=0,timer,busy=false,denied=false,lastState,issue='';
 const paint=()=>{
  const open=root.querySelector('details')?.open;
  const age=data?performance.now()-received:0;
  lastState=processingState(data,age).state;
  root.innerHTML=renderProcessing(data,age,issue);
  updateProcessingCard(age>freshWindow?null:data);
  if(open&&root.querySelector('details'))root.querySelector('details').open=true;
 };
 const poll=async()=>{
  clearTimeout(timer);if(document.hidden||busy||denied)return;
  busy=true;
  const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch('/admin/api/quick-reads',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   if(response.status===401||response.status===403){denied=true;throw Error('Admin access expired. Sign in again to restore monitoring.');}
   if(!response.ok)throw Error(response.status===429?'Too many refresh requests. Monitoring will retry automatically.':'The server could not load monitoring data. Retrying automatically.');
   const next=await response.json();
   // Compare server timestamps, never the tablet's potentially incorrect clock.
   const serverTime=stamp(response.headers?.get('date'));
   if(!next.counts||!Array.isArray(next.running)||!Number.isFinite(stamp(next.checked_at))||(Number.isFinite(serverTime)&&Math.abs(serverTime-stamp(next.checked_at))>freshWindow))throw Error('The server returned an invalid or stale snapshot. Retrying automatically.');
   data=next;issue='';received=performance.now();paint();
  }catch(error){data=null;issue=error.name==='AbortError'?'The monitoring request timed out. Retrying automatically.':error instanceof TypeError?'Could not connect to monitoring. Check the tablet connection; retrying automatically.':error.message;paint();}
  finally{clearTimeout(deadline);busy=false;if(!document.hidden&&!denied)timer=setTimeout(poll,15000);}
 };
 const tick=setInterval(()=>{
  if(document.hidden)return;
  const age=data?performance.now()-received:0;
  if(processingState(data,age).state!==lastState)paint();
  for(const el of root.querySelectorAll('[data-claim]'))el.textContent=duration(stamp(data?.checked_at)+age-stamp(el.dataset.claim));
  for(const el of root.querySelectorAll('[data-next-check]'))el.textContent=scheduleCountdown(el.dataset.nextCheck,stamp(data?.checked_at)+age);
  for(const el of root.querySelectorAll('[data-completed]'))el.textContent=duration(stamp(data?.checked_at)+age-stamp(el.dataset.completed))+' ago';
 },1000);
 document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(document.hidden){root.querySelector('.qr-live')?.classList.remove('is-active');}else poll();});
 window.addEventListener('pagehide',()=>{clearTimeout(timer);clearInterval(tick);stopBallMotion();},{once:true});
 paint();poll();
}
if(typeof document!=='undefined'&&document.getElementById('quick-live'))startProcessingMonitor(document.getElementById('quick-live'));
