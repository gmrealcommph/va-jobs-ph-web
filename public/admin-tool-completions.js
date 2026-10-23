const number=value=>Number.isSafeInteger(value)&&value>=0?value.toLocaleString('en-PH'):'Unavailable';
export function completionCards(data){
 const ready=data?.available===true;
 return '<section class="insight-tile live-visitors-tile tool-completions-tile" aria-label="Completed career tools"><h3>Completed tools</h3><div class="tool-completion-metrics">'+[['Niche Finder','niche_finder'],['Resume Studio','resume_studio']].map(([label,key])=>'<div class="tool-completion-metric"><span>'+label+'</span><strong'+(!ready?' class="completion-unavailable"':'')+'>'+(ready?number(data[key]):'Unavailable')+'</strong></div>').join('')+'</div><p class="tool-completion-note">Completed forms · since tracking began</p></section>';
}
