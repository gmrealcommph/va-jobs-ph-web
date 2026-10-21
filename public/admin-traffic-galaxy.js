const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v.toLocaleString('en-PH');
export const channels=[
 {key:'google_organic',name:'Google Search',mark:'G',color:'#FFC83D'},
 {key:'direct_unknown',name:'Direct / Unknown',mark:'↗',color:'#22B07D'},
 {key:'referrals',name:'Referrals',mark:'↗↗',color:'#B69CFF'},
 {key:'facebook',name:'Facebook',mark:'f',color:'#69AAFF'},
 {key:'other',name:'Other',mark:'✦',color:'#FF8A5B'}
];
export function groupChannel(channel){
 const c=String(channel??'').trim().toLowerCase();
 return c==='google organic'||c==='google organic (inferred)'?0:c==='direct / unknown'?1:c==='referrals'?2:c==='facebook'?3:4;
}
const count=v=>v!==null&&v!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;
export function sessionGroups(t){
 if(!t?.available||count(t.sessions)===null||!Array.isArray(t.sources))return null;
 const counts=[0,0,0,0,0];
 for(const source of t.sources){const value=count(source.sessions);if(value===null)return null;counts[groupChannel(source.channel)]+=value;}
 const total=count(t.sessions);
 if(counts.reduce((s,v)=>s+v,0)!==total)return null;
 return {total,sources:channels.map((c,i)=>({...c,count:counts[i],share:total?100*counts[i]/total:0}))};
}
export const manilaDay=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function renderGalaxy(d){
 const data=sessionGroups(d.traffic),partial=d.end===manilaDay();
 const heading='<h3>Traffic Galaxy <a href="#marketing" aria-label="View detailed traffic">↗</a></h3>';
 if(!data)return heading+'<div class="tg-unavailable" role="status">Traffic data temporarily unavailable</div><a class="tg-link" href="#marketing">View detailed traffic →</a>';
 const positions=[[24,20],[80,25],[13,67],[85,72],[52,90]];
 return heading+'<div class="tg-period">Selected period · Manila'+(partial?' · Today partial':'')+'</div><div class="tg-space"><svg class="tg-orbits" viewBox="0 0 300 140" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="150" cy="70" rx="112" ry="50"/><ellipse cx="150" cy="70" rx="78" ry="62"/>'+positions.map(([x,y])=>'<path d="M150 64 L'+x*3+' '+y*1.4+'"/>').join('')+'</svg><div class="tg-core"><strong>'+num(data.total)+'</strong><span>Total Sessions</span></div>'+data.sources.map((s,i)=>{
 const [x,y]=positions[i],description=s.name+': '+num(s.count)+' sessions · '+(data.total?s.share.toFixed(1)+'%':'—')+(i===0?' · Organic, includes referrer-inferred traffic':'');
 return '<button type="button" class="tg-node tg-source-'+i+' tg-size-'+Math.min(2,Math.floor(s.share/34))+'" aria-label="'+esc(description)+'" data-traffic-detail="'+esc(description)+'"><span aria-hidden="true">'+s.mark+'</span></button>';
 }).join('')+'</div><div class="tg-detail" aria-live="polite">'+(data.total?'Tap a source to explore counts & shares':'No consented sessions recorded')+'</div><div class="tg-bottom"><span>Consented sessions · not unique people</span><a href="#marketing">View detailed traffic →</a></div>';
}
export function bindGalaxy(root){
 if(root.dataset.galaxyBound)return;
 root.dataset.galaxyBound='true';
 const show=event=>{const node=event.target.closest?.('[data-traffic-detail]');if(!node||!root.contains(node))return;const detail=node.closest('.traffic-mix-tile')?.querySelector('.tg-detail');if(detail)detail.textContent=node.dataset.trafficDetail;};
 root.addEventListener('pointerover',show);root.addEventListener('focusin',show);root.addEventListener('click',show);
}
export function dailySessions(d){
 if(!Array.isArray(d.traffic?.daily))return null;
 const start=Date.parse(d.start+'T00:00:00Z'),end=Date.parse(d.end+'T00:00:00Z');
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||end-start>90*86400000)return null;
 const rows=new Map(d.traffic.daily.map(r=>[r.day,r]));
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
 if(!grouped||result.reduce((s,r)=>s+(r.total||0),0)!==grouped.total)return null;
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
