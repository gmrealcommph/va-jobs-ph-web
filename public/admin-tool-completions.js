const number=value=>Number.isSafeInteger(value)&&value>=0?String(value):null;
export function completionCards(data){
 const ready=data?.available===true;
 const counters=[['Niches','niche_finder'],['Resumes','resume_studio']].map(([label,key])=>{
  const value=ready?number(data[key]):null;
  const digits=value===null?'<span class="completion-missing">Unavailable</span>':value.padStart(2,'0').split('').map(char=>'<span class="flip-digit" aria-hidden="true"><span class="flip-static">'+char+'</span><span class="flip-flap">'+char+'</span></span>').join('');
  return '<div class="completion-counter"><div class="flip-clock" role="img" aria-label="'+label+': '+(value??'Unavailable')+'">'+digits+'</div><span class="completion-label">'+label+'</span></div>';
 }).join('');
 return '<section class="insight-tile live-visitors-tile tool-completions-tile" aria-label="Completed career tools"><h3>Tools completed</h3><div class="completion-counter-row">'+counters+'</div><p class="tool-completion-note">Completed forms · refreshes every 30 seconds</p></section>';
}
