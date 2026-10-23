import {completionCards} from './admin-tool-completions.js';
// Isolated staging preview only; the production dashboard uses its existing poller.
async function refresh(){
 const host=document.querySelector('.overview-insights');
 if(!host)return;
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches)for(const f of host.querySelectorAll('.flip-flap'))f.animate([{transform:'rotateX(0)'},{transform:'rotateX(-92deg)',offset:.48},{transform:'rotateX(0)'}],{duration:620});
 try{const r=await fetch('/__qa/tool-completions',{cache:'no-store',credentials:'omit'});if(r.ok)host.innerHTML=completionCards(await r.json());}catch{}
}
setInterval(()=>{if(!document.hidden)refresh();},30000);
