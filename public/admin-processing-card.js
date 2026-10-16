export function processingCard(data){
 const counts=data?.counts;
 if(!counts||!['completed','queued','processing','failed'].every(key=>Number.isFinite(counts[key])&&counts[key]>=0))return '<p class="note">Processing snapshot unavailable. Check Quick Reads.</p>';
 const rows=[['Processed',counts.completed,'#178a69'],['Queued',counts.queued,'#e59b34'],['Processing',counts.processing,'#2685df'],['Failed',counts.failed,'#c94040']];
 const max=Math.max(1,...rows.map(r=>Number(r[1])||0));
 return '<p class="note">Automatic queue · current snapshot</p><svg class="processing-bars" viewBox="0 0 300 152" role="img" aria-label="Automatic Quick Reads queue counts">'+rows.map(([label,value,color],i)=>{const n=Math.max(0,Number(value)||0),y=i*37;return '<text x="0" y="'+(y+14)+'">'+label+'</text><rect x="90" y="'+y+'" width="'+(155*n/max).toFixed(2)+'" height="20" rx="5" fill="'+color+'"/><text x="252" y="'+(y+14)+'">'+n.toLocaleString('en')+'</text>';}).join('')+'</svg><p class="note">Processed = completed queue records; queued = pending now. These are not historical queue trends.</p>';
}
let snapshot=null;
export function updateProcessingCard(data){snapshot=data;if(typeof document!=='undefined'){const root=document.getElementById('processing-card');if(root)root.innerHTML=processingCard(data);}}
export function currentProcessingCard(){return processingCard(snapshot);}
