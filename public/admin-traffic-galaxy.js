const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v.toLocaleString('en-PH');
export const channels=[
 {key:'google_organic',name:'Google Search',mark:'G',color:'#EF4444'},
 {key:'direct_unknown',name:'Direct / Unknown',mark:'↗',color:'#22B07D'},
 {key:'referrals',name:'Referrals',mark:'↗↗',color:'#B69CFF'},
 {key:'facebook',name:'Facebook',mark:'f',color:'#69AAFF'},
 {key:'other',name:'Other',mark:'✦',color:'#FF8A5B'}
];
export function groupChannel(channel){
 const c=String(channel??'').trim().toLowerCase();
 return c==='google organic'||c==='google organic (inferred)'?0:c==='direct / unknown'?1:c==='referrals'?2:c==='facebook'?3:4;
}
const count=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;
export function sessionGroups(t){
 if(!t?.available||count(t.sessions)===null||!Array.isArray(t.sources))return null;
 const counts=[0,0,0,0,0];
 for(const source of t.sources){const value=count(source?.sessions);if(value===null)return null;counts[groupChannel(source.channel)]+=value;}
 const total=count(t.sessions);
 if(counts.reduce((s,v)=>s+v,0)!==total)return null;
 return {total,sources:channels.map((c,i)=>({...c,count:counts[i],share:total?100*counts[i]/total:0}))};
}
export const manilaDay=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const sourceDescription=(s,i,total)=>s.name+': '+num(s.count)+' sessions · '+(total?s.share.toFixed(1)+'%':'—')+(i===0?' · Organic, includes referrer-inferred traffic':'');
export function renderGalaxy(d){return renderWaves(d);}
export function renderWaves(d){
 const data=sessionGroups(d.traffic),partial=d.end===manilaDay();
 const heading='<h3>Traffic Waves <a href="#marketing" aria-label="View Site Visitors &amp; Traffic Sources">↗</a></h3>';
 if(!data)return heading+'<div class="tg-unavailable" role="status">Traffic data temporarily unavailable</div><a class="tg-link" href="#marketing">View detailed traffic →</a>';
 const days=dailySessions(d);
 let chart='<div class="tw-empty">'+(data.total?'Daily source detail unavailable':'No consented sessions recorded')+'</div>';
 if(days&&data.total){
  const max=Math.max(1,...days.map(r=>r.total||0)),step=300/days.length;
  // Shared, bounded interpolation between daily samples preserves nonnegative layers.
  // Only the stroke texture moves, never data geometry. Gaps split the paths.
  chart='<svg class="tw-chart" viewBox="0 0 300 58" preserveAspectRatio="none" aria-hidden="true">'+data.sources.map((s,j)=>{
   const runs=[];let run=[];
   for(let i=0;i<days.length;i++){const r=days[i];if(!r.available){if(run.length)runs.push(run);run=[];continue;}const below=r.values.slice(0,j).reduce((a,b)=>a+b,0);run.push({x:(i+.5)*step,bottom:58-below/max*54,top:58-(below+r.values[j])/max*54});}if(run.length)runs.push(run);
   const curve=(points,key)=>points.slice(1).map((p,i)=>{const previous=points[i],mid=(previous.x+p.x)/2;return 'C'+mid+' '+previous[key]+' '+mid+' '+p[key]+' '+p.x+' '+p[key];}).join('');
   const paths=runs.map(points=>{const first=points[0],last=points.at(-1),reverse=[...points].reverse();return 'M'+(first.x-step/2)+' '+first.top+'H'+first.x+curve(points,'top')+'H'+(last.x+step/2)+'V'+last.bottom+'H'+last.x+curve(reverse,'bottom')+'H'+(first.x-step/2)+'Z';}).join('');
   return '<path class="tw-layer tg-source-'+j+'" data-wave-source="'+j+'" data-traffic-detail="'+esc(sourceDescription(s,j,data.total))+'" d="'+paths+'" fill="'+s.color+'"/><path class="tw-flow" d="'+paths+'"/>';
  }).join('')+'</svg>';
 }
 return heading+'<div class="tg-period">'+esc(d.start||'Selected period')+' – '+esc(d.end||'')+' · Asia/Manila'+(partial?' · Today partial':'')+'</div><div class="tw-total"><strong>'+num(data.total)+'</strong><span>Total Sessions</span><small>Supabase · consented</small></div><div class="tw-plot" title="Daily source counts; curves interpolate between days. Motion is decorative. Exact daily counts in detailed traffic.">'+chart+'</div><div class="tw-legend">'+data.sources.map((s,i)=>{
  const description=sourceDescription(s,i,data.total);
  return '<button type="button" class="tw-chip tg-source-'+i+'" aria-pressed="false" aria-label="'+esc(description)+'" data-wave-source="'+i+'" data-traffic-detail="'+esc(description)+'"><i aria-hidden="true"></i>'+esc(i===0?'Google':i===1?'Direct':s.name)+'</button>';
 }).join('')+'</div><div class="tg-detail" aria-live="polite">'+(data.total?(days?'Daily samples · curves between days':'Daily source detail unavailable'):'No consented sessions recorded')+'</div><div class="tg-bottom"><span>Sessions ≠ people</span><a href="#marketing">View detailed traffic →</a></div>';
}
export function bindGalaxy(root){
 if(root.dataset.galaxyBound)return;
 root.dataset.galaxyBound='true';
 const show=event=>{const node=event.target.closest?.('[data-traffic-detail]');if(!node||!root.contains(node))return;const tile=node.closest('.traffic-mix-tile'),detail=tile?.querySelector('.tg-detail');if(detail)detail.textContent=node.dataset.trafficDetail;
  tile?.querySelectorAll?.('[data-wave-source]').forEach(el=>{const active=el.dataset.waveSource===node.dataset.waveSource;el.classList.toggle('tw-active',active);el.classList.toggle('tw-muted',!active);if(el.matches('button'))el.setAttribute('aria-pressed',String(active));});
 };
 root.addEventListener('pointerover',show);root.addEventListener('focusin',show);root.addEventListener('click',show);
}
export function dailySessions(d){
 if(!Array.isArray(d.traffic?.daily))return null;
 const start=Date.parse(d.start+'T00:00:00Z'),end=Date.parse(d.end+'T00:00:00Z');
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||end-start>90*86400000)return null;
 const rows=new Map();
 for(const r of d.traffic.daily){if(!r||rows.has(r.day)||r.day<d.start||r.day>d.end||!/^\d{4}-\d{2}-\d{2}$/.test(r.day))return null;rows.set(r.day,r);}
 const earliest=Math.max(Date.parse(d.traffic.started_at)||-Infinity,Date.parse(d.traffic.checked_at)-90*86400000);
 const first=Number.isFinite(earliest)?manilaDay(new Date(earliest)):d.start;
 const result=[];
 for(let time=start;time<=end;time+=86400000){
  const day=new Date(time).toISOString().slice(0,10),row=rows.get(day);
  if(day<first){result.push({day,available:false});continue;}
  const values=channels.slice(0,4).map(c=>row?count(row[c.key]):0),total=row?count(row.sessions):0;
  if(total===null||values.includes(null)||values.reduce((s,v)=>s+v,0)>total)return null;
  values.push(total-values.reduce((s,v)=>s+v,0));
  result.push({day,total,values,available:true,partial:day===manilaDay()||day===first&&earliest>time-8*3600000});
 }
 const grouped=sessionGroups(d.traffic);
 if(!grouped||result.reduce((s,r)=>s+(r.total||0),0)!==grouped.total||grouped.sources.some((s,j)=>result.reduce((n,r)=>n+(r.values?.[j]||0),0)!==s.count))return null;
 return result;
}
export function renderDailyTraffic(d){
 const data=sessionGroups(d.traffic),days=dailySessions(d);
 if(!data)return '<p>Session source data temporarily unavailable.</p>';
 const breakdown='<div class="tg-breakdown">'+data.sources.map((s,i)=>'<span class="tg-source-'+i+'"><i></i>'+esc(s.name)+' <b>'+num(s.count)+' · '+(data.total?s.share.toFixed(1)+'%':'—')+'</b></span>').join('')+'</div>';
 if(!days)return breakdown+'<p>Daily session detail unavailable. Period totals are still shown above.</p>';
 const max=Math.max(1,...days.map(r=>r.total||0)),step=640/days.length;
 const bars=days.map((r,i)=>{
  let y=145;const label=r.day+(r.partial?' · partial':'')+(r.available?': '+num(r.total)+' sessions':': outside tracking coverage');
  const segments=r.available?r.values.map((v,j)=>{const h=v/max*120;y-=h;return '<rect x="'+(40+i*step+step*.13)+'" y="'+y+'" width="'+step*.74+'" height="'+h+'" fill="'+channels[j].color+'"/>';}).join(''):'';
  return '<g><title>'+esc(label+(r.available?' · '+channels.map((c,j)=>c.name+' '+r.values[j]).join(', '):''))+'</title>'+segments+'<text x="'+(40+i*step+step/2)+'" y="164" text-anchor="middle">'+(i===0||i===days.length-1||days.length<9?r.day.slice(5):'')+'</text></g>';
 }).join('');
 return breakdown+'<svg class="tg-daily-chart" viewBox="0 0 700 180" role="img" aria-label="Daily consented sessions by source, Asia/Manila. Exact values in the daily table below."><text x="4" y="28">'+num(max)+'</text><text x="18" y="146">0</text><path d="M38 24V145H682" fill="none" stroke="currentColor" opacity=".2"/>'+bars+'</svg><details><summary>Daily counts & tracking coverage</summary><div class="table-wrap"><table><thead><tr>'+['Date (PH)','Total',...channels.map(c=>c.name)].map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+days.map(r=>'<tr><td>'+r.day+(r.partial?' · partial':'')+'</td>'+(r.available?[r.total,...r.values].map(v=>'<td>'+num(v)+'</td>').join(''):'<td colspan="6">Outside tracking coverage</td>')+'</tr>').join('')+'</tbody></table></div></details>';
}
