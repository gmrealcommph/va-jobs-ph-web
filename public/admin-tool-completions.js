const number=value=>Number.isSafeInteger(value)&&value>=0?value.toLocaleString('en-PH'):'Unavailable';
export function completionCards(data){
 const ready=data?.available===true;
 return [['Niche Finder forms completed','niche_finder','Results successfully saved'],['Résumés completed','resume_studio','Valid form reached Review & download']].map(([label,key,note])=>'<article class="card"><div class="kpi-content"><h3>'+label+'</h3><div class="value">'+(ready?number(data[key]):'Unavailable')+'</div><p>'+note+' · total since counting began</p></div></article>').join('');
}
