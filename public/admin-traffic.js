import {renderDailyTraffic} from './admin-traffic-galaxy.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number(v).toLocaleString('en-PH');
const ratio=(value,total)=>total>0?(100*value/total).toFixed(1)+'%':'—';
const paths={globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c4 5 4 13 0 18-4-5-4-13 0-18Z',session:'M4 5h16v14H4ZM4 9h16M9 13l-2 2 2 2m6-4 2 2-2 2',user:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 10l2 2 3-4',arrow:'M7 17 17 7M7 7h10v10',campaign:'M4 10v6h4l10 4V6L8 10H4ZM8 16l2 5M21 10v6',page:'M7 3h7l4 4v14H7ZM14 3v5h5M10 12h5m-5 4h5',info:'M12 8h.01M12 11v6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'};
const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[name]+'"/></svg>';
const empty=(title,copy)=>'<div class="tf-empty"><span class="tf-empty-icon">'+icon('campaign')+'</span><h4>'+esc(title)+'</h4><p>'+esc(copy)+'</p></div>';
const table=(headers,rows)=>'<div class="table-wrap tf-campaign-table"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const head=(name,caption,badge)=>'<div class="tf-panel-head"><div><h3>'+esc(name)+'</h3><p>'+esc(caption)+'</p></div><span class="tf-label">'+esc(badge)+'</span></div>';
const foot=copy=>'<p class="tf-footnote">'+icon('info')+'<span>'+esc(copy)+'</span></p>';
function landings(rows,key){return '<ol class="tf-landings">'+rows.filter(x=>x[key]>0).map((x,i)=>'<li><span class="tf-rank">'+(i+1)+'</span><span class="tf-page-icon">'+icon('page')+'</span><div><strong>'+esc(x.path||x.landing)+'</strong>'+(x.path==='/'||x.landing==='/'?'<span>Homepage</span>':'')+'</div><b>'+n(x[key])+'</b></li>').join('')+'</ol>';}
export function renderTraffic(d){
 const v=d.visitors,a=v?.attribution,t=d.traffic;
 const metric=(label,value,note,glyph,tone)=>'<div class="tf-metric '+tone+'"><span class="tf-metric-icon">'+icon(glyph)+'</span><div><span class="tf-metric-label">'+esc(label)+'</span><strong>'+esc(value)+'</strong><span class="tf-metric-note">'+esc(note)+'</span></div></div>';
 let html='<div class="traffic-heading"><div><span class="eyebrow">AUDIENCE &amp; ACQUISITION</span><h3>Where your visitors come from</h3><p>Measured visits, referring channels and landing pages.</p></div><span class="traffic-badge"><i></i> Measured data only</span></div>';
 html+='<div class="traffic-summary">'+metric('Site visits',v?.available?n(v.visits):'Unavailable','Cloudflare · selected period','globe','tf-blue')+metric('Consented sessions',t?.available?n(t.sessions):'Unavailable','Optional analytics · 30-minute visits','session','tf-teal')+metric('Linked registrations',t?.available?n(t.registrations):'Unavailable','New accounts linked to a visit','user','tf-violet')+'</div>';
 html+='<div class="tf-grid"><section class="tf-panel">'+head('Traffic sources','Recorded visits by referring channel','CLOUDFLARE');
 if(a?.available&&a.sources.length){
  const sum=a.sources.reduce((s,x)=>s+x.visits,0),max=Math.max(1,...a.sources.map(x=>x.visits));
  html+='<div class="tf-sources">'+a.sources.map(x=>{
   const tone=/Facebook/.test(x.source)?'tf-facebook':/Google/.test(x.source)?'tf-google':/LinkedIn/.test(x.source)?'tf-linkedin':/Direct/.test(x.source)?'tf-direct':'tf-referral';
   const mark=/Facebook/.test(x.source)?'f':/Google/.test(x.source)?'G':/LinkedIn/.test(x.source)?'in':icon('arrow');
   return '<div class="tf-source '+tone+'"><span class="tf-source-icon">'+mark+'</span><div class="tf-source-body"><div class="tf-source-line"><strong>'+esc(x.source)+'</strong><b>'+n(x.visits)+' <small>visits</small></b></div><svg class="tf-bar" viewBox="0 0 100 5" preserveAspectRatio="none" aria-hidden="true"><rect class="tf-bar-track" width="100" height="5" rx="2.5"/><rect class="tf-bar-value" width="'+Math.max(0,Math.min(100,100*x.visits/max)).toFixed(2)+'" height="5" rx="2.5"/></svg><span class="tf-source-note">'+(a.truncated?'Partial provider breakdown':ratio(x.visits,sum)+' of reported source visits')+'</span></div></div>';
  }).join('')+'</div>';
 }else html+=empty(a?.available?'No visits recorded':'Source data unavailable',a?.available?'No source visits were recorded for this period.':'Referrer attribution unavailable for this period.');
 html+=foot('Direct / unknown includes visits with no referrer. Visits are not unique people.'+(a?.truncated?' Provider row limit reached; breakdown is partial.':''))+'</section>';
 html+='<section class="tf-panel">'+head('Top landing pages','The public pages visitors arrive on','VISIT ENTRIES');
 html+=a?.available&&a.landings.some(x=>x.visits>0)?landings(a.landings,'visits'):empty('No landing pages to show',a?.available?'No public landing visits were recorded in this period.':'Landing-page data unavailable.');
 html+=foot('Public paths only. Private pages and query strings are excluded.')+'</section></div>';
 // Daily channel counts use the consented-session dataset, not Cloudflare visits.
 if(t?.available){
  html+='<section class="tf-panel tf-daily">'+head('Daily sessions by source','Consented sessions · Asia/Manila · today is partial','SUPABASE');
  html+=renderDailyTraffic(d);
  html+=foot('¹ Google organic combines tagged organic Google visits and Google referrer-inferred visits. ² Other includes LinkedIn, paid campaigns, and other campaigns. Today is partial until midnight PH. These session counts are not Cloudflare visit totals and do not represent unique visitors.');
  html+='</section>';
 }
 // Campaign reporting is temporarily omitted while attribution is being tested. Collection is unchanged.
 if(t?.available&&t.historical_unavailable)html+='<p class="tf-history">This period includes dates before collection; historical UTM attribution and linked conversions are unavailable.</p>';
 html+='<details class="tf-details tf-method"><summary><span>'+icon('info')+' How these numbers are measured</span><span class="tf-hint">Coverage &amp; definitions</span></summary><div class="tf-definition-grid"><div><h4>Traffic coverage</h4><p>Cloudflare visits and consented sessions are separate measures and are never added together. Google organic is inferred from the referrer; untagged paid traffic cannot be separated. Consent, blockers, stripped referrers, bots and provider sampling affect coverage. Neither measure represents unique people.</p></div><div><h4>Linked conversions</h4><p>A registration is a new account created during its first-touch, fixed 30-minute visit, counted once per account. A Pro buyer has a confirmed live purchase after that registration, counted once within 90 days of the visit and as of this refresh. Renewals, grants and test payments do not add conversions.</p></div><div><h4>Attribution limits</h4><p>Later purchases can change earlier cohorts. Cross-device journeys and registrations outside 30 minutes are unlinked. No Meta view-through attribution is claimed. Analytics records expire after 90 days through daily cleanup; historical attribution is never invented.</p></div></div></details>';
 return html;
}
