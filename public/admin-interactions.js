// Presentation only: native touch scrolling is left to the browser.
export function glideStep(velocity,elapsed){return velocity*Math.exp(-elapsed/230);}
export function initDashboardInteractions(doc=document,win=window){
 const reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
 const tooltip=doc.createElement('div');tooltip.className='graph-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;doc.body.append(tooltip);
 let drag=null,frame=0,suppressClick=false;
 const stop=()=>{win.cancelAnimationFrame(frame);frame=0;};
 const hide=()=>{tooltip.hidden=true;};
 const interactive='a,button,input,select,textarea,summary,svg,table,[contenteditable="true"],[role="tab"]';
 const scrollable=target=>{for(let el=target;el&&el!==doc.body;el=el.parentElement){if(el.scrollHeight>el.clientHeight+1&&/auto|scroll/.test(win.getComputedStyle(el).overflowY))return true;}return false;};
 doc.addEventListener('pointerdown',e=>{
  stop();if(e.pointerType!=='mouse'||e.button!==0||e.altKey||e.shiftKey||e.target.closest(interactive)||scrollable(e.target))return;
  drag={id:e.pointerId,y:e.clientY,time:e.timeStamp,velocity:0,active:false};
 });
 doc.addEventListener('pointermove',e=>{
  if(drag&&e.pointerId===drag.id){
   const dy=drag.y-e.clientY,dt=Math.max(1,e.timeStamp-drag.time);
   if(!drag.active&&Math.abs(dy)<6)return;
   if(!drag.active){drag.active=true;doc.body.classList.add('page-dragging');doc.body.setPointerCapture(e.pointerId);hide();}
   e.preventDefault();win.getSelection()?.removeAllRanges();win.scrollBy({top:dy,behavior:'instant'});drag.velocity=dy/dt;drag.y=e.clientY;drag.time=e.timeStamp;return;
  }
  const svg=e.target.closest('.chart svg');
  if(!svg){hide();return;}
  const circles=[...svg.querySelectorAll('circle')].filter(c=>c.querySelector('title'));
  if(!circles.length){hide();return;}
  const box=svg.getBoundingClientRect(),x=(e.clientX-box.left)/box.width*svg.viewBox.baseVal.width;
  const point=circles.reduce((best,c)=>Math.abs(Number(c.getAttribute('cx'))-x)<Math.abs(Number(best.getAttribute('cx'))-x)?c:best);
  tooltip.textContent=point.querySelector('title').textContent;tooltip.hidden=false;
  tooltip.style.left=Math.max(8,Math.min(e.clientX+12,win.innerWidth-tooltip.offsetWidth-12))+'px';tooltip.style.top=Math.max(8,Math.min(e.clientY-40,win.innerHeight-tooltip.offsetHeight-8))+'px';
 },{passive:false});
 const release=e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const previous=drag;drag=null;doc.body.classList.remove('page-dragging');
  if(doc.body.hasPointerCapture(e.pointerId))doc.body.releasePointerCapture(e.pointerId);
  if(!previous.active)return;suppressClick=true;
  win.setTimeout(()=>{suppressClick=false;},0);
  if(e.type==='pointercancel'||reduced.matches||e.timeStamp-previous.time>100)return;
  let velocity=Math.max(-2,Math.min(2,previous.velocity)),last=win.performance.now();
  const glide=now=>{const dt=Math.min(32,now-last);last=now;velocity=glideStep(velocity,dt);const before=win.scrollY;win.scrollBy({top:velocity*dt,behavior:'instant'});if(Math.abs(velocity)>.025&&win.scrollY!==before)frame=win.requestAnimationFrame(glide);else frame=0;};
  frame=win.requestAnimationFrame(glide);
 };
 doc.addEventListener('pointerup',release);doc.addEventListener('pointercancel',release);
 doc.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopPropagation();}},{capture:true});
 doc.addEventListener('wheel',stop,{passive:true});doc.addEventListener('keydown',stop);win.addEventListener('blur',()=>{stop();drag=null;hide();doc.body.classList.remove('page-dragging');});
 doc.addEventListener('pointerout',e=>{if(!e.relatedTarget)hide();});
}
// Ask the browser to keep only the visible, foreground dashboard awake.
export function initScreenAwake(doc=document,win=window,nav=navigator){
 const status=doc.createElement('span');status.className='screen-awake-status';
 status.setAttribute('role','status');
 doc.getElementById('signup-chime')?.after(status);
 const show=text=>{status.textContent=text;};
 if(!nav.wakeLock?.request){show('Screen awake unavailable');status.title='This browser does not support keeping the screen awake. Try an updated browser.';return ()=>{};}
 let lock=null,pending=false,active=doc.hasFocus(),ended=false,epoch=0;
 const eligible=()=>!ended&&active&&doc.visibilityState==='visible';
 const release=()=>{epoch++;const held=lock;lock=null;if(held)void held.release().catch(()=>{});show('Screen awake paused');};
 const acquire=async()=>{
  if(!eligible()||lock||pending)return;
  pending=true;const started=epoch;
  try{
   const held=await nav.wakeLock.request('screen');
   if(!eligible()||started!==epoch){await held.release();return;}
   lock=held;show('Screen awake');status.title='The dashboard is asking the browser to keep the display on while this app is in front.';
   held.addEventListener('release',()=>{if(lock===held){lock=null;show('Screen awake paused');}});
  }catch{show('Screen awake unavailable');status.title='The browser or battery-saving settings declined the request. Tap the dashboard to retry.';}
  finally{pending=false;if(started!==epoch&&eligible())void acquire();}
 };
 const visibility=()=>{if(doc.visibilityState==='visible'){active=doc.hasFocus();void acquire();}else release();};
 const focus=()=>{active=true;void acquire();};
 const blur=()=>{active=false;release();};
 const retry=()=>{if(eligible())void acquire();};
 const pagehide=()=>{ended=true;release();};
 const pageshow=()=>{ended=false;active=doc.hasFocus();void acquire();};
 doc.addEventListener('visibilitychange',visibility);
 doc.addEventListener('pointerdown',retry,{passive:true});
 win.addEventListener('focus',focus);win.addEventListener('blur',blur);
 win.addEventListener('pagehide',pagehide);win.addEventListener('pageshow',pageshow);
 // Android can revoke a lock while the page stays visible. Recheck without
 // requiring another touch; hidden pages and explicit app exits stay paused.
 const healthCheck=win.setInterval?.(()=>{if(lock?.released)lock=null;if(eligible())void acquire();},15000);
 show('Screen awake paused');void acquire();
 return ()=>{pagehide();if(healthCheck!==undefined)win.clearInterval(healthCheck);doc.removeEventListener('visibilitychange',visibility);doc.removeEventListener('pointerdown',retry);win.removeEventListener('focus',focus);win.removeEventListener('blur',blur);win.removeEventListener('pagehide',pagehide);win.removeEventListener('pageshow',pageshow);};
}
export function initFullscreen(doc=document){
 const anchor=doc.getElementById('signup-chime');if(!anchor)return;
 const button=doc.createElement('button');button.type='button';button.className='fullscreen-toggle';
 const status=doc.createElement('span');status.className='fullscreen-status';status.setAttribute('role','status');
 anchor.after(button);button.after(status);
 const buttons=[button],sidebar=doc.querySelector?.('aside');
 if(sidebar){const menuButton=doc.createElement('button');menuButton.type='button';menuButton.className='fullscreen-menu-toggle';sidebar.append(menuButton);buttons.push(menuButton);button.className+=' fullscreen-display-toggle';}
 const supported=!!doc.documentElement.requestFullscreen&&doc.fullscreenEnabled!==false;
 const sync=()=>{const active=!!doc.fullscreenElement;for(const control of buttons){
  const label=active?'Exit full screen':'Full screen';control.setAttribute('aria-label',label);control.title=label;control.setAttribute('aria-pressed',String(active));
  const paths=active?['M3 8h5V3','M16 3v5h5','M21 16h-5v5','M8 21v-5H3']:['M8 3H3v5','M21 8V3h-5','M16 21h5v-5','M3 16v5h5'];
  control.innerHTML='<svg class="fullscreen-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+paths.map((path,i)=>'<path class="fullscreen-corner corner-'+i+'" d="'+path+'"/>').join('')+'</svg>';
 }};
 sync();
 if(!supported){for(const control of buttons){control.disabled=true;control.setAttribute('aria-label','Full screen unavailable');control.title='Full screen unavailable';}status.textContent='Try an updated browser.';return;}
 for(const control of buttons)control.addEventListener('click',async()=>{
  for(const control of buttons)control.disabled=true;status.textContent='';
  try{if(doc.fullscreenElement)await doc.exitFullscreen();else await doc.documentElement.requestFullscreen({navigationUI:'hide'});}
  catch{status.textContent='Full screen was declined by your browser. Tap to try again.';}
  finally{for(const control of buttons)control.disabled=false;sync();}
 });
 doc.addEventListener('fullscreenchange',()=>{status.textContent='';sync();});
}
export function initDisplayMode(doc=document,win=window){
 const anchor=doc.getElementById('signup-chime');if(!anchor)return;
 const button=doc.createElement('button');button.type='button';button.className='display-mode-toggle';anchor.after(button);
 let enabled=false;try{enabled=win.localStorage.getItem('veeays-display-mode')==='on';}catch{}
 const paint=()=>{doc.documentElement.setAttribute('data-display-mode',enabled?'on':'off');button.textContent=enabled?'Exit display mode':'Tablet display';button.setAttribute('aria-pressed',String(enabled));};
 paint();button.addEventListener('click',()=>{enabled=!enabled;paint();try{win.localStorage.setItem('veeays-display-mode',enabled?'on':'off');}catch{}win.scrollTo({top:0,behavior:'instant'});});
}
if(typeof document!=='undefined'){initDashboardInteractions();initScreenAwake();initFullscreen();initDisplayMode();}
