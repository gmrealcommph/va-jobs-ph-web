export function initTheme(doc=document,win=window){
  const select=doc.getElementById('theme-mode');
  if(!select)return;
  const media=win.matchMedia('(prefers-color-scheme: dark)');
  let mode='light';
  try{const stored=win.localStorage.getItem('veeays-admin-theme');if(['light','dark','system'].includes(stored))mode=stored;}catch{}
  const apply=()=>{doc.documentElement.dataset.theme=mode==='system'?(media.matches?'dark':'light'):mode;select.value=mode;};
  select.addEventListener('change',()=>{mode=['light','dark','system'].includes(select.value)?select.value:'system';try{win.localStorage.setItem('veeays-admin-theme',mode);}catch{}apply();});
  media.addEventListener('change',()=>{if(mode==='system')apply();});
  apply();
}
if(typeof document!=='undefined')initTheme();
