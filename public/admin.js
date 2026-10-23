import {completionCards} from './admin-tool-completions.js';
import {renderGalaxy,bindGalaxy} from './admin-traffic-galaxy.js';
import {renderTraffic} from './admin-traffic.js';
import {RegistrationTracker,PaymentTracker,refreshDelay,playRegistrationChime,playPaymentCelebration} from './admin-live.js';
import {renderEmailUsage} from './admin-email-health.js';
import {renderProviderBalances} from './admin-balances.js';
const $=id=>document.getElementById(id);
const refreshSeconds=30;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=value=>Number(value||0).toLocaleString('en-PH');
const money=(value,currency='USD')=>new Intl.NumberFormat('en-PH',{style:'currency',currency}).format(Number(value||0));
const date=value=>value?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'No timestamp';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const row=(label,value)=>'<div class="statrow"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>';
const card=(label,value,note,tone='')=>'<article class="card '+tone+'"><span class="kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="'+(label.includes('member')?'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8':label.includes('Pro')?'M3 6l4 4 5-7 5 7 4-4-3 13H6z':label.includes('revenue')?'M3 6h18v14H3zM3 10h18m-6 5h3':label.includes('error')?'M12 3 2 21h20ZM12 9v5m0 3v1':label.includes('visits')?'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6':'M3 5h18v16H3zM8 5V2h8v3M7 10h10m-10 5h7')+'"/></svg></span><div class="kpi-content"><h3>'+esc(label)+'</h3><div class="value">'+esc(value)+'</div><p>'+esc(note)+'</p>'+(label==='Registered members'?'<div class="account-actions"><a href="#members">View members</a><a href="#marketing">Traffic sources</a></div>':'')+'</div></article>';

function curvePath(points){
 if(!points.length)return '';
 return 'M'+points[0].join(',')+points.slice(1).map((p,i)=>{const a=points[i],mid=(a[0]+p[0])/2;return ' C'+mid+','+a[1]+' '+mid+','+p[1]+' '+p.join(',');}).join('');
}
function miniTrend(data,key,bars=false){
 const valid=(data||[]).filter(d=>Number.isFinite(Number(d[key]))&&d[key]!==null);
 if(!valid.length)return '<small class="visual-unavailable">Daily trend unavailable</small>';
 const values=valid.map(d=>Number(d[key])),max=Math.max(1,...values),w=180,h=46;
 const points=curvePath(values.map((v,i)=>[8+i*164/Math.max(1,values.length-1),40-v/max*34]));
 return '<svg class="mini-trend" viewBox="0 0 180 46" role="img" aria-label="'+esc(key+' daily trend; exact values in daily tables')+'">'+(bars?values.map((v,i)=>'<rect x="'+(6+i*168/values.length)+'" y="'+(40-v/max*34)+'" width="'+Math.max(2,120/values.length)+'" height="'+(v/max*34)+'" rx="2"><title>'+esc(valid[i].day+': '+num(v))+'</title></rect>').join(''):'<path class="mini-line" d="'+points+'"/><path class="mini-line mini-motion" pathLength="100" d="'+points+'"/>')+'</svg>';
}
function growthOrbits(data){
 const days=(data||[]).filter(d=>Number.isFinite(Number(d.members))&&d.members!==null);
 if(!days.length)return '';
 let total=0;const cumulative=days.map(d=>({day:d.day,value:total+=Number(d.members)}));
 const indices=[...new Set([.25,.5,.75,1].map(f=>Math.max(0,Math.ceil(days.length*f)-1)))];
 const selected=indices.map(i=>cumulative[i]);
 return '<div class="growth-orbits"><h3>Community growth <span>Cumulative registrations · selected period</span></h3><svg viewBox="0 0 240 190" role="img" aria-label="Cumulative new members through selected dates">'+selected.reverse().map((d,i)=>{const r=82-i*18;return '<g class="orbit-layer" style="--layer:'+i+'"><circle cx="120" cy="103" r="'+r+'"/><text x="120" y="'+(i===selected.length-1?107:103-r+13)+'">'+num(d.value)+'</text><title>'+esc(d.day+': '+num(d.value)+' cumulative registrations')+'</title></g>';}).join('')+'</svg><div class="orbit-legend">'+selected.reverse().map(d=>'<span>'+esc(d.day.slice(5))+'<strong>'+num(d.value)+'</strong></span>').join('')+'</div></div>';
}
function quotaDots(q){
 if(!q||!Number.isFinite(Number(q.limit))||Number(q.limit)<=0)return '';
 const ratio=Math.max(0,Math.min(1,Number(q.used)/Number(q.limit)));
 return '<svg class="quota-dots" viewBox="0 0 100 29" role="img" aria-label="Daily email quota '+(ratio*100).toFixed(1)+' percent used">'+Array.from({length:30},(_,i)=>'<circle cx="'+(5+i%10*10)+'" cy="'+(5+Math.floor(i/10)*10)+'" r="3" class="'+(i<Math.round(ratio*30)?'used':'remaining')+'"/>').join('')+'</svg>';
}


function jobsBarChart(label,data){
 const base=chart(label,data,'jobs',false,'',true);
 const valid=(data||[]).filter(d=>d.jobs!==null&&Number.isFinite(Number(d.jobs)));
 if(!valid.length)return base;
 const max=Math.max(1,...valid.map(d=>Number(d.jobs))),step=450/valid.length,width=Math.max(1,Math.min(34,step*.78));
 const bars=valid.map((d,i)=>{const height=100*Number(d.jobs)/max,x=45+step*(i+.5);return '<g class="jobs-bar-group jobs-bar-phase-'+(i%5)+'"><rect class="jobs-bar '+(Number(d.jobs)===max?'jobs-bar-peak':'')+'" x="'+(x-width/2).toFixed(2)+'" y="'+(120-height).toFixed(2)+'" width="'+width.toFixed(2)+'" height="'+height.toFixed(2)+'" rx="'+width/2+'"><title>'+esc(d.day+': '+num(d.jobs)+' new jobs')+'</title></rect>'+(Number(d.jobs)===0?'<circle class="jobs-zero" cx="'+x.toFixed(2)+'" cy="120" r="1.5"/>':'')+'</g>';}).join('');
 const svg='<svg class="jobs-bar-chart" viewBox="0 0 540 148" preserveAspectRatio="none" role="img" aria-label="Daily new jobs; bar heights show measured counts. Exact dates and values in the table below."><line x1="45" x2="495" y1="120" y2="120"/><text x="35" y="22" text-anchor="end">'+num(max)+'</text><text x="35" y="123" text-anchor="end">0</text>'+bars+'<text x="45" y="145">'+esc(valid[0].day)+'</text><text x="495" y="145" text-anchor="end">'+esc(valid.at(-1).day)+'</text></svg>';
 return base.replace(/<svg[\s\S]*?<\/svg>/,'<div class="jobs-scale">Peak '+num(Math.max(...valid.map(d=>Number(d.jobs))))+'</div>'+svg.replace(/<text[\s\S]*?<\/text>/g,'')+'<div class="jobs-axis"><span>'+esc(valid[0].day)+'</span><span>'+esc(valid.at(-1).day)+'</span></div>');
}
function primaryCard(label,value,note,data,key,graphLabel,href,graphNote=''){
 return '<article class="card primary-card '+(key==='quick_reads'?'completions-card':'')+'"><div class="primary-graph"><span class="primary-graph-label">'+esc(graphLabel)+'</span>'+(key==='jobs'?jobsBarChart(graphLabel,data):chart(graphLabel,data,key,key==='revenue_php','',true))+(graphNote?'<small class="primary-graph-note">'+esc(graphNote)+'</small>':'')+'</div><div class="primary-total"><h3>'+esc(label)+'</h3><div class="value">'+esc(value)+'</div><p>'+esc(note)+'</p><a href="'+href+'">View details ↗</a></div></article>';
}

function table(headers,rows,empty='No records in this period.'){
  if(!rows.length) return '<p>'+esc(empty)+'</p>';
  return '<table><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
}
function chart(title,data,key,currency=false,note='',large=false){
  const heading='<h3>'+esc(title)+'</h3>'+(note?'<p class="note">'+esc(note)+'</p>':'');
  if(!data.length) return '<article class="chart">'+heading+'<p>No daily values to plot in this period.</p></article>';
  const values=data.map(d=>Number(d[key])),max=Math.max(1,...values),w=540,h=large?230:160;
  const x=i=>44+(values.length===1?.5:i/(values.length-1))*(w-60);
  const y=v=>h-22-(v/max)*(h-42);
  const points=curvePath(values.map((v,i)=>[x(i),y(v)]));
  const fmt=v=>currency?money(v,'PHP'):num(v);
  const grid=large?[0,.25,.5,.75,1].map(f=>'<line x1="44" y1="'+y(max*f)+'" x2="524" y2="'+y(max*f)+'"/><text x="0" y="'+(y(max*f)+4)+'">'+esc(num(max*f))+'</text>').join(''):'<line x1="44" y1="'+y(0)+'" x2="524" y2="'+y(0)+'"/><line x1="44" y1="'+y(max)+'" x2="524" y2="'+y(max)+'"/><text x="0" y="'+(y(max)+4)+'">'+esc(num(max))+'</text><text x="25" y="'+(y(0)+4)+'">0</text>';
  return '<article class="chart">'+heading+'<svg preserveAspectRatio="none" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(title+'; daily values available in the table below.')+'">'+grid+(large?'<path class="chart-area" d="'+points+' L'+x(values.length-1)+','+y(0)+' L'+x(0)+','+y(0)+' Z"/>':'')+'<path class="chart-line" d="'+points+'"/>'+(values.length>1?'<path class="chart-motion" pathLength="100" aria-hidden="true" d="'+points+'"/>':'')+values.map((v,i)=>'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="3" fill="#22B07D"><title>'+esc(data[i].day+': '+fmt(v))+'</title></circle>').join('')+'<text x="44" y="'+(h-2)+'">'+esc(data[0]?.day||'')+'</text><text text-anchor="end" x="524" y="'+(h-2)+'">'+esc(data.at(-1)?.day||'')+'</text></svg><details><summary>View daily values</summary><div class="table-wrap">'+table(['Manila date',title],data.map(d=>[d.day,fmt(d[key])]))+'</div></details></article>';
}
function renderCollectionHealth(d){
 const sources=Array.isArray(d.imports)?d.imports:null;
 if(!sources?.length)return '<div class="collection-no-data"><svg viewBox="0 0 100 70" aria-hidden="true"><rect x="12" y="12" width="60" height="42" rx="9"/><path d="M24 41l12-12 12 6 12-13M70 47h17m-8-8v16"/><circle cx="24" cy="23" r="2"/></svg><p class="collection-empty">Collection records unavailable for this period.</p></div>';
 const reviewed=sources.filter(s=>s.last_collected_at&&Date.parse(d.generated_at)-Date.parse(s.last_collected_at)<=86400000).length;
 return '<div class="collection-summary"><div class="collection-ring"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="collection-ring-track" cx="32" cy="32" r="26"/><circle class="collection-ring-fill" cx="32" cy="32" r="26" pathLength="100" stroke-dasharray="'+(100*reviewed/sources.length).toFixed(2)+' 100"/></svg><span>'+reviewed+'/'+sources.length+'</span></div><strong>'+reviewed+'<small> / '+sources.length+'</small></strong><span>sources collected within 24h</span><a href="#imports">Inspect all ↗</a></div><ul class="collection-list">'+[...sources].sort((a,b)=>Date.parse(b.last_collected_at||0)-Date.parse(a.last_collected_at||0)).slice(0,3).map(s=>{
 const age=Date.parse(d.generated_at)-Date.parse(s.last_collected_at),fresh=Number.isFinite(age)&&age<=86400000;
 return '<li><span class="collection-dot '+(fresh?'fresh':'review')+'"></span><div><strong>'+esc(s.source||'Unknown')+'</strong><small>'+esc(s.last_collected_at?date(s.last_collected_at):'No collection timestamp')+'</small></div><div><strong>'+num(s.new_jobs)+'</strong><small>added in period</small></div><svg class="collection-arrivals" viewBox="0 0 72 26" aria-hidden="true"><rect class="arrival-track" x="2" y="9" width="68" height="8" rx="4"/><rect class="arrival-fill" x="2" y="9" width="'+(68*Math.max(0,Number(s.new_jobs)||0)/Math.max(1,...sources.map(v=>Number(v.new_jobs)||0))).toFixed(2)+'" height="8" rx="4"/></svg></li>';
 }).join('')+'</ul><p class="collection-note">Freshness reflects data arrival; it does not confirm every import succeeded.</p>';
}
function renderMemberAnalytics(m){
  if(!m)return '<p>Unavailable · extended member query is not connected.</p>';
  const metric=(label,value,note,tone)=>'<div class="ma-metric '+tone+'"><span>'+esc(label)+'</span><strong>'+num(value)+'</strong><small>'+esc(note)+'</small></div>';
  const detail=(label,value)=>'<div class="ma-row"><span>'+esc(label)+'</span><strong>'+num(value)+'</strong></div>';
  const cohort=(label,n,tone)=>{
    const total=Number(m.cohort_registered),pct=total>0?100*Number(n)/total:0;
    return '<div class="ma-cohort '+tone+'"><h4>'+esc(label)+'</h4><div class="ma-cohort-body"><div class="ma-cohort-visual"><svg viewBox="0 0 80 80" aria-hidden="true"><circle class="ma-track" cx="40" cy="40" r="32"/><circle class="ma-fill" cx="40" cy="40" r="32" pathLength="100" stroke-dasharray="'+Math.max(0,Math.min(100,pct)).toFixed(2)+' 100"/></svg><strong>'+(total>0?pct.toFixed(1)+'%':'—')+'</strong></div><p>'+(total>0?'<b>'+num(n)+' / '+num(total)+'</b><span>registrations</span>':'Not applicable · empty cohort')+'</p></div></div>';
  };
  return '<div class="ma-heading"><div><span class="ma-eyebrow">MEMBERSHIP & ACCESS</span><h3>Your member community</h3><p>Account status today and outcomes for your selected signup cohort.</p></div><span class="ma-badge">Current snapshot</span></div><div class="ma-metrics">'+metric('Verified accounts',m.verified,'Email verified · now','ma-teal')+metric('Unverified accounts',m.unverified,'Email not yet verified · now','ma-blue')+metric('Free plan profiles',m.free_plan,'Current plan status','ma-blue')+metric('Active Pro access',m.active_pro,'Current access status','ma-violet')+'</div><div class="ma-grid"><section class="ma-panel"><div class="ma-panel-heading"><h3>Pro access breakdown</h3><span>NOW</span></div>'+detail('With confirmed purchase history',m.active_pro_with_purchase)+detail('Without a purchase record',m.active_pro_without_purchase_record)+detail('Expiring within 7 days',m.expiring_7d)+'<p class="ma-note">A missing purchase record does not establish how access was granted.</p></section><section class="ma-panel"><div class="ma-panel-heading"><h3>Signup cohort outcomes</h3><span>SELECTED PERIOD</span></div>'+cohort('Verified by now',m.cohort_verified_now,'ma-teal')+cohort('Purchased by now',m.cohort_purchased_now,'ma-violet')+'<p class="ma-note">Registrations in the selected period; outcomes may occur later.</p></section></div><div class="ma-profile"><span>Profile coverage</span><strong>'+num(m.missing_profile)+' missing profiles</strong><span class="ma-profile-note">Email verification and plan access are separate measures.</span></div><details class="ma-details"><summary>How membership is measured <span>Coverage & definitions</span></summary><p>Cohort = registrations in selected period; verification/purchase may occur later. No purchase record is not proof of a grant. Grant provenance and recurring subscriptions are not tracked. Free profiles and Pro access are distinct from email verification.</p></details>';
}
function renderActions(actions){
 const ranks={critical:0,high:1,warning:2};
 const issues=(actions||[]).slice().sort((a,b)=>(ranks[a.severity]??3)-(ranks[b.severity]??3));
 if(!issues.length)return '<div class="action-clear"><span aria-hidden="true">✓</span><strong>No issues detected</strong><p>Connected checks only. Unconnected monitors cannot confirm health.</p></div>';
 const first=issues[0],href=i=>/^#[a-z-]+$/.test(i.href||'')?i.href:'#action-center';
 const explanations={'#operations':'Inspect the affected Quick Reads and their recorded errors.','#imports':'Check the latest collection times for the affected job boards.','#email-health':'Review the provider allowance and queued email batches.','#marketing':'Check the traffic integration and its data coverage.','#system-health':'Review which analytics checks are currently available.'};
 return '<div class="action-priority" data-severity="'+esc(first.severity)+'"><div class="action-priority-label"><span aria-hidden="true">!</span><strong>'+esc(first.severity)+' priority</strong><small>'+issues.length+' issue'+(issues.length===1?'':'s')+'</small></div><h3>'+esc(first.title)+'</h3><p>'+esc(explanations[href(first)]||'Inspect the available records before taking action.')+'</p><a class="action-inspect" href="'+href(first)+'">Inspect '+(href(first)==='#operations'?'Quick Reads':href(first)==='#imports'?'collections':href(first)==='#email-health'?'email health':'details')+' <span aria-hidden="true">↗</span></a></div>'+(issues.length>1?'<details class="action-more"><summary>'+ (issues.length-1)+' more issue'+(issues.length===2?'':'s')+'</summary><ul class="issues">'+issues.slice(1).map(i=>'<li data-severity="'+esc(i.severity)+'"><span class="severity">'+esc(i.severity)+'</span> <a href="'+href(i)+'">'+esc(i.title)+'</a></li>').join('')+'</ul></details>':'');
}
function collectionTerminal(d){
 const boards=(Array.isArray(d.imports)?d.imports:[]).map(s=>s.source).filter(s=>typeof s==='string'&&s.trim()).slice(0,2);
 const lines=['$ collect --boards configured',...boards.map(board=>'> scan '+board),'$ normalize --listings','$ deduplicate --jobs','$ prepare --quick-reads'].slice(0,6);
 return '<article class="card primary-card collection-terminal"><header><h3>Across the job boards</h3></header><div class="terminal-stage"><div class="terminal-screen" aria-hidden="true">'+lines.map(line=>'<div class="terminal-row"><span>'+esc(line)+'</span></div>').join('')+'</div><div class="collection-radar" aria-hidden="true"><div class="radar-grid"></div><div class="radar-sweep"></div><i class="radar-signal signal-one"></i><i class="radar-signal signal-two"></i><i class="radar-signal signal-three"></i><i class="radar-signal signal-four"></i><i class="radar-center"></i></div></div><p class="sr-only">Looping illustration of collecting and organizing job listings. This is not a live processing log.</p><a href="#imports">Collection health ↗</a></article>';
}
function renderOverviewInsights(d){
  const m=d.extended?.available?d.extended.members:null;
  const field=(label,value,share,tone="")=>'<div class="member-metric '+tone+'"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong>'+(Number.isFinite(share)?'<svg viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="4" rx="2" class="member-bar-track"/><rect width="'+Math.max(0,Math.min(100,share)).toFixed(2)+'" height="4" rx="2" class="member-bar-fill"/></svg>':'')+'</div>';
  const rate=(n,total)=>total>0?(100*n/total).toFixed(1)+'%':'—';
  const members=m?'<div class="insight-values">'+field('Verified · now',num(m.verified))+field('Unverified · now',num(m.unverified))+field('Cohort verified',rate(m.cohort_verified_now,m.cohort_registered),m.cohort_registered>0?100*m.cohort_verified_now/m.cohort_registered:null,'verified')+field('Cohort purchased',rate(m.cohort_purchased_now,m.cohort_registered),m.cohort_registered>0?100*m.cohort_purchased_now/m.cohort_registered:null,'purchased')+'</div>':'<p>Member details unavailable.</p>';
  const liveTile=completionCards(d.tool_completions);
  const percent=m&&m.cohort_registered>0?100*m.cohort_verified_now/m.cohort_registered:null;
  const ring='<div class="reference-ring" role="img" aria-label="'+esc('Signup cohort verified: '+(percent===null?'unavailable':percent.toFixed(1)+'%')+'; '+num(m?.cohort_registered??0)+' registrations')+'"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="ring-track" cx="50" cy="50" r="42"/><circle class="member-ring-rest" cx="50" cy="50" r="42" pathLength="100" stroke-dasharray="'+(percent===null?0:100).toFixed(2)+' 100"/><circle class="ring-value" cx="50" cy="50" r="42" pathLength="100" stroke-dasharray="'+(percent===null?0:Math.max(0,Math.min(100,percent))).toFixed(2)+' 100"/></svg><div><strong>'+(percent===null?'—':percent.toFixed(1)+'%')+'</strong></div></div>';
  return '<section class="insight-tile member-health-tile"><h3>Member health <a href="#members" aria-label="View member details">↗</a></h3>'+ring+members+'</section><section class="insight-tile traffic-mix-tile">'+renderGalaxy(d)+'</section>'+liveTile;
}
function render(d){
  $('report-day').textContent=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',day:'numeric'}).format(new Date(d.generated_at));
  $('report-month').textContent=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',weekday:'short'}).format(new Date(d.generated_at))+', '+new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'long'}).format(new Date(d.generated_at));
  const rev=d.revenue.length?d.revenue.map(r=>money(r.amount,r.currency)).join(' · '):money(0,'PHP');
  const kpis=[
    card('Registered members',num(d.members),num(d.new_members)+' joined in period','featured'),
    card('Active Pro access',num(d.pro_access),num(d.paid_pro_members)+' with confirmed live payments','mint'),
    card('Confirmed live revenue',rev,'Paid date in selected period · before fees','yellow'),
    card('Live jobs',num(d.live_jobs),'Currently public, eligible and deduplicated'),
    card('New jobs',num(d.new_jobs),num(d.new_live_jobs)+' currently live; created in period'),
    card('Quick Reads completed',num(d.quick_period.completed),'Current ready records generated in period'),
    card('Quick Read errors',num(d.quick_period.errors),'Current failures updated in period',d.quick_period.errors>0?'attention':''),
    card('Site visits',d.visitors?.available?num(d.visitors.visits):'Unavailable',d.visitors?.available?num(d.visitors.page_views)+' page views · Cloudflare · bots excluded':d.visitors?.reason==='not_connected'||!d.visitors?'Cloudflare dashboard connection is not configured':d.visitors.reason==='access_denied'?'Cloudflare token needs read access':d.visitors.reason==='site_not_found'?'Cloudflare analytics site could not be identified':'Cloudflare data unavailable for this period; try a shorter period')
  ];
  $('overview').innerHTML=[
    primaryCard('Members',num(d.members),num(d.new_members)+' joined in selected period',d.daily,'members','Daily registrations','#members'),
    primaryCard('Jobs',num(d.live_jobs),'Live now · '+num(d.new_jobs)+' added in period',d.daily.filter(v=>v.day!=='2026-10-02'),'jobs','Daily new jobs','#imports','Oct 2 initial bulk import excluded'),
    primaryCard('Quick Reads',num(d.quick_period.completed),'Completed in period · '+num(d.quick_period.errors)+' current errors',d.daily.filter(v=>v.day!=='2026-10-06'),'quick_reads','Daily completions','#operations','Oct 6 bulk backfill excluded'),
    collectionTerminal(d)
  ].join('');
  const queueCount=state=>Array.isArray(d.queue)?num(d.queue.filter(q=>q.state===state).reduce((n,q)=>n+Number(q.count||0),0)):'Unavailable';
  const extended=d.extended?.available?d.extended:null;
  const knownCount=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))?num(v):'Unavailable';
  const reviewSources=Array.isArray(d.imports)&&d.imports.length?num(d.imports.filter(s=>!Number.isFinite(Date.parse(s.last_collected_at))||Date.parse(d.generated_at)-Date.parse(s.last_collected_at)>86400000).length):'Unavailable';
  $('quick-stats').innerHTML=[card('Queued Quick Reads',queueCount('pending'),'Current queue snapshot'),card('Running Quick Reads',queueCount('running'),'Recorded state · see live funnel'),card('Sources to review',reviewSources,'Missing or over 24h since collection'),card('Email retries',extended?knownCount(extended.email?.retrying):'Unavailable','Application batches awaiting retry'),card('Pro expiring soon',extended?knownCount(extended.members?.expiring_7d):'Unavailable','Active access expiring within 7 days'),kpis[7]].map((html,i)=>{
 const icons=['M5 7h14M5 12h11M5 17h8','M12 3v4m0 10v4M3 12h4m10 0h4M8 8l-3-3m11 11 3 3M8 16l-3 3m11-11 3-3','M12 4 3 20h18ZM12 9v5m0 3v1','M3 6h18v13H3zM3 6l9 7 9-7','M5 7h14v14H5zM8 3v7m8-7v7M8 15h8','M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6'];
 return html.replace('class="value">Unavailable','class="value value-unknown">Unavailable').replace('class="card ','class="card operational-tile op-tone-'+i+' ').replace(/<span class="kpi-icon"[\s\S]*?<\/span>/,'<span class="op-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="'+icons[i]+'"/></svg></span>');
 }).join('');
  $('overview-insights').innerHTML=renderOverviewInsights(d);
  bindGalaxy($('overview-insights'));
  $('collection-health').innerHTML=renderCollectionHealth(d);
  $('platform-status').textContent='Updated '+date(d.generated_at);
  // The initial bulk-import spike is excluded only from this trend, not totals.
  const jobTrend=d.daily.filter(day=>day.day!=='2026-10-02');
  const quickReadTrend=d.daily.filter(day=>day.day!=='2026-10-06');
  $('charts').innerHTML=chart('New members',d.daily,'members')+chart('New jobs',jobTrend,'jobs',false,'Initial bulk import on Oct 2, 2026 excluded from this graph. Job totals include it.')+chart('Quick Reads completed',quickReadTrend,'quick_reads',false,'Bulk backfill on Oct 6, 2026 excluded from this graph. Completion totals include it.')+chart('Confirmed live revenue · PHP',d.daily,'revenue_php',true);
  const pilot=d.pilot;
  $('quick').innerHTML='<article><h3>Queue & completion state · now</h3>'+d.queue.map(q=>row('Queue / '+q.state,num(q.count))).join('')+d.quick_reads.map(q=>row('Quick Reads / '+q.status,num(q.count))).join('')+row('Worker automation',d.runtime.quick_read_enabled?'Enabled':'Disabled')+row('Database automation',d.automation?.enabled?'Enabled':'Disabled')+'<p class="note">Queue states are current snapshots, independent of the period filter.</p></article><article><h3>Processing cost reservations</h3>'+(pilot?row('Processing',pilot.enabled?'Enabled':'Disabled')+row('Claims',num(pilot.claims))+row('VeeAys spending cap',pilot.budget_usd===null?'No cap':money(pilot.budget_usd))+row('Reserved',money(pilot.reserved_usd))+row('Remaining under cap',pilot.budget_usd===null?'Not capped':money(Math.max(0,Number(pilot.budget_usd)-Number(pilot.reserved_usd))))+row('Worst-case request reservation',money(pilot.worst_request_usd)):'<p>Pilot reservation record unavailable.</p>')+'<p class="note">USD reservations are conservative budget holds. Actual provider spend is not connected. This dashboard cannot change caps or run jobs.</p></article>';
  $('errors').innerHTML=table(['Job ID','Error code','Last update'],d.errors.map(e=>[e.job_id,e.error_code||'Unspecified',date(e.updated_at)]),'No current failures updated in this period.');
  $('import-table').innerHTML=table(['Source','Latest collection · Manila','Freshness','New jobs in period','Active eligible rows'],d.imports.map(i=>[i.source||'Unknown',date(i.last_collected_at),!i.last_collected_at?'Unknown':Date.parse(d.generated_at)-Date.parse(i.last_collected_at)>86400000?'Review · over 24h':'Recent',num(i.new_jobs),num(i.eligible_active_rows)]));
  $('payment-table').innerHTML=table(['Mode','Current status','Checkout records'],d.payment_events.map(p=>[p.livemode?'Live':'Test · excluded from revenue',p.status,num(p.count)]));
  const x=d.extended?.available?d.extended:null;
  const actionsOpen=$('actions').querySelector('details')?.open;
  $('actions').innerHTML=renderActions(d.actions);
  if(actionsOpen&&$('actions').querySelector('details'))$('actions').querySelector('details').open=true;
  const usage=d.email_health?.usage;
  $('provider-balances').innerHTML=renderProviderBalances(d,{row,num,money,date,esc});
  $('email').innerHTML=renderEmailUsage(usage,{row,num,date,esc,compact:true})+(x?'<h3>Application batches · selected period</h3>'+row('Email batches awaiting retry',num(x.email.retrying))+row('Held email batches',num(x.email.held))+row('Accepted app batches in period',num(x.email.accepted_in_period)):'')+'<details><summary>Delivery coverage and operational protections</summary><p class="note">App batch counts do not measure account-wide emails or SMTP sends. 70% warning · 90% high · 100% critical. Provider acceptance does not prove delivery. Delivery failures, bounces and Supabase Auth email errors need provider events/logs. Supabase Auth cap of 100/hour is user-reported, separate from Resend account quota, and does not increase the Free plan allowance of 100/day and 3,000/month. Background alerts remain disabled pending independent destination approval.</p></details>';
  const m=x?.members;
  $('member-detail').innerHTML=renderMemberAnalytics(m);
  $('marketing-detail').innerHTML=renderTraffic(d);
  $('system').innerHTML=(x?row('Database analytics query succeeded',date(x.system.database_query_succeeded_at)):'<p>Database analytics status unavailable.</p>')+'<p>Worker errors, API latency history, DB failure history and independent uptime: unavailable. A successful query is a point-in-time check, not uptime. Deployment history was audited separately; no live deployment monitor is connected.</p>';
  if(x){$('import-table').innerHTML+= '<h3>Job quality · raw records now</h3>'+row('Active records with posted date over 30 days old',num(x.job_quality.active_posted_over_30d))+row('Active records missing posted date',num(x.job_quality.active_missing_posted_at))+row('Duplicate URL groups',num(x.job_quality.duplicate_url_groups))+row('Duplicate source-ID groups',num(x.job_quality.duplicate_source_groups))+row('Inactive records',num(x.job_quality.inactive_rows))+'<p class="note">Old posting dates indicate age, not confirmed expiration. Duplicate groups are raw candidates; public listings already deduplicate. Import failures and confirmed expired jobs require authoritative importer/source events.</p>';}
  $('payment-table').innerHTML+='<p class="note">Gross uses the existing confirmed-live ledger once per checkout/payment. Fees, refunds, chargebacks, failed payment events and net revenue are unavailable: the current ledger stores creating, pending, creation_failed and confirmed only. Creation failure is not a payment failure. No fee estimates are presented as actual amounts.</p>';
}
function preset(){
  for(const id of ['start','end'])$(id).max=today();
  if($('period').value==='custom') return;
  $('end').value=today();
  $('start').value=new Date(Date.parse($('end').value+'T00:00:00Z')-(Number($('period').value)-1)*86400000).toISOString().slice(0,10);
}
let lastSuccess=null,requestId=0,inFlight=false,timer=null,failures=0,accessExpired=false;
const registrations=new RegistrationTracker(),payments=new PaymentTracker(),signupQueue=[];
let activeToast=null,toastTimer=null,audioContext=null,chimeEnabled=true;
try{chimeEnabled=localStorage.getItem('veeays-admin-sound')!=='off';}catch{}
function showNextSignup(){
  if(activeToast || document.hidden || accessExpired || !signupQueue.length)return;
  const event=signupQueue.shift(),toast=document.createElement('div');
  toast.className='signup-toast';
  const payment=event.kind==='payment';
  const title=document.createElement('strong');title.textContent=payment?'Payment confirmed!':'New account registered';
  const text=document.createElement('p');text.textContent=payment?money(event.amount_minor/100,event.currency)+' live payment verified · '+date(event.confirmed_at)+'.':'Welcome to VeeAys! Registered '+date(event.registered_at)+'.';
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label',payment?'Dismiss payment notification':'Dismiss registration notification');
  const dismiss=()=>{clearTimeout(toastTimer);toast.remove();activeToast=null;showNextSignup();};
  close.addEventListener('click',dismiss);
  toast.append(title,text,close);$('signup-notifications').append(toast);activeToast=toast;
  if(chimeEnabled){try{(payment?playPaymentCelebration:playRegistrationChime)(audioContext);}catch{/* A sound failure must not hide the notification. */}}
  toastTimer=setTimeout(dismiss,8000);
}
function schedule(){
  clearTimeout(timer);
  const delay=refreshDelay(refreshSeconds,failures);
  if(!delay || document.hidden || accessExpired)return;
  timer=setTimeout(()=>{preset();load({automatic:true});},delay);
}
async function load({automatic=false}={}){
  if(automatic && inFlight)return;
  clearTimeout(timer);
  const id=++requestId;
  const start=$('start').value,end=$('end').value,span=(Date.parse(end)-Date.parse(start))/86400000;
  if(!start || !end || !Number.isFinite(span) || span<0 || span>90 || end>today()){
    $('status').className='error';$('status').textContent='Choose valid dates, up to 91 days, ending today or earlier.';schedule();return;
  }
  inFlight=true;
  if(typeof window==='undefined'||!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)for(const flap of $('overview-insights').querySelectorAll('.tool-completions-tile .flip-flap'))flap.animate?.([{transform:'rotateX(0)'},{transform:'rotateX(-92deg)',offset:.48},{transform:'rotateX(0)'}],{duration:620,easing:'ease-in-out'});
  $('filters').querySelector('button').disabled=true;
  if(!automatic || !lastSuccess){
    $('dashboard').setAttribute('aria-busy','true');
    $('status').className='';$('status').textContent='Loading production metrics…';
  }
  const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),60000);
  try{
    const r=await fetch('/admin/api/analytics?'+new URLSearchParams({start,end}),{credentials:'same-origin',cache:'no-store',signal:controller.signal});
    const d=await r.json();
    if(!r.ok) throw Object.assign(new Error(d.error||'Could not load analytics.'),{status:r.status});
    if(id!==requestId)return;
    const openCharts=[...$('charts').querySelectorAll('details')].map(detail=>detail.open);
    const openPrimary=[...$('overview').querySelectorAll('details')].map(detail=>detail.open);
    const periodChanged=lastSuccess&&(lastSuccess.start!==d.start||lastSuccess.end!==d.end);
    render(d);
    [...$('overview').querySelectorAll('details')].forEach((detail,i)=>{detail.open=!!openPrimary[i];});
    if(periodChanged&&!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)$('overview').animate?.([{opacity:.65,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'ease-out'});
    [...$('charts').querySelectorAll('details')].forEach((detail,i)=>{detail.open=!!openCharts[i];});
    signupQueue.push(...registrations.observe(d.registrations),...payments.observe(d.confirmed_payments).map(event=>({...event,kind:'payment'})));showNextSignup();
    lastSuccess=d;failures=0;accessExpired=false;$('status').className='';
    $('status').textContent='Updated '+date(d.generated_at)+' · '+d.start+' through '+d.end+' · Totals marked “now” reflect current state.';
  }catch(error){
    if(id!==requestId)return;
    failures++;
    if([401,403].includes(error.status)){
      accessExpired=true;lastSuccess=null;signupQueue.length=0;
      clearTimeout(toastTimer);activeToast?.remove();activeToast=null;
      for(const id of ['overview','quick-stats','collection-health','charts','quick','errors','import-table','payment-table','actions','email','provider-balances','member-detail','marketing-detail','system'])$(id).replaceChildren();
      $('platform-status').textContent='Admin access expired';
    }
    else $('platform-status').textContent=lastSuccess?'Refresh failed · previous snapshot':'Analytics unavailable';
    $('status').className='error';$('status').textContent=(['TimeoutError','AbortError'].includes(error.name)?'The connection is taking too long. Retrying automatically.':error.message)+(lastSuccess?' Showing previous data for '+lastSuccess.start+' through '+lastSuccess.end+', updated '+date(lastSuccess.generated_at)+'.':' Please refresh to retry.');
  }finally{
    clearTimeout(deadline);
    if(id===requestId){inFlight=false;$('filters').querySelector('button').disabled=false;$('dashboard').setAttribute('aria-busy','false');schedule();}
  }
}
$('period').addEventListener('change',()=>{preset();if($('period').value!=='custom')load();});
for(const id of ['start','end']){$(id).max=today();$(id).addEventListener('change',()=>{$('period').value='custom';});}
$('filters').addEventListener('submit',e=>{e.preventDefault();load();});

function paintSoundToggle(){
 const button=$('signup-chime');button.setAttribute('aria-checked',String(chimeEnabled));button.setAttribute('aria-label','Notification sounds');button.innerHTML='<span>Sounds</span><i aria-hidden="true"></i>';
}
async function unlockAudio(){
 if(!chimeEnabled||typeof window==='undefined')return;
 try{const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;audioContext??=new AudioContext();await audioContext.resume();}catch{}
}
paintSoundToggle();
document.addEventListener('pointerdown',unlockAudio,{passive:true});
document.addEventListener('keydown',unlockAudio);
$('signup-chime').addEventListener('click',()=>{chimeEnabled=!chimeEnabled;try{localStorage.setItem('veeays-admin-sound',chimeEnabled?'on':'off');}catch{}paintSoundToggle();if(chimeEnabled)unlockAudio();});
document.addEventListener('visibilitychange',()=>{
  clearTimeout(timer);
  if(!document.hidden){showNextSignup();if(refreshSeconds && !accessExpired && !inFlight){preset();load({automatic:true});}}
});
preset();load();





