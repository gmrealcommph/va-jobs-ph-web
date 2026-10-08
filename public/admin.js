const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=value=>Number(value||0).toLocaleString('en-PH');
const money=(value,currency='USD')=>new Intl.NumberFormat('en-PH',{style:'currency',currency}).format(Number(value||0));
const date=value=>value?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'No timestamp';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const row=(label,value)=>'<div class="statrow"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>';
const card=(label,value,note,tone='')=>'<article class="card '+tone+'"><h3>'+esc(label)+'</h3><div class="value">'+esc(value)+'</div><p>'+esc(note)+'</p></article>';
function table(headers,rows,empty='No records in this period.'){
  if(!rows.length) return '<p>'+esc(empty)+'</p>';
  return '<table><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
}
function chart(title,data,key,currency=false){
  const values=data.map(d=>Number(d[key])),max=Math.max(1,...values),w=540,h=160;
  const x=i=>44+(values.length===1?.5:i/(values.length-1))*(w-60);
  const y=v=>h-22-(v/max)*(h-42);
  const points=values.map((v,i)=>x(i)+','+y(v)).join(' ');
  const fmt=v=>currency?money(v,'PHP'):num(v);
  return '<article class="chart"><h3>'+esc(title)+'</h3><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(title+'; daily values available in the table below.')+'"><line x1="44" y1="'+y(0)+'" x2="524" y2="'+y(0)+'"/><line x1="44" y1="'+y(max)+'" x2="524" y2="'+y(max)+'"/><text x="0" y="'+(y(max)+4)+'">'+esc(num(max))+'</text><text x="25" y="'+(y(0)+4)+'">0</text><polyline points="'+points+'"/>'+values.map((v,i)=>'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="3" fill="#22B07D"><title>'+esc(data[i].day+': '+fmt(v))+'</title></circle>').join('')+'<text x="44" y="158">'+esc(data[0]?.day||'')+'</text><text text-anchor="end" x="524" y="158">'+esc(data.at(-1)?.day||'')+'</text></svg><details><summary>View daily values</summary><div class="table-wrap">'+table(['Manila date',title],data.map(d=>[d.day,fmt(d[key])]))+'</div></details></article>';
}
function render(d){
  const rev=d.revenue.length?d.revenue.map(r=>money(r.amount,r.currency)).join(' · '):money(0,'PHP');
  $('overview').innerHTML=[
    card('Registered members',num(d.members),num(d.new_members)+' joined in period','featured'),
    card('Active Pro access',num(d.pro_access),num(d.paid_pro_members)+' with confirmed live payments','mint'),
    card('Confirmed live revenue',rev,'Paid date in selected period · before fees','yellow'),
    card('Live jobs',num(d.live_jobs),'Currently public, eligible and deduplicated'),
    card('New jobs',num(d.new_jobs),num(d.new_live_jobs)+' currently live; created in period'),
    card('Quick Reads completed',num(d.quick_period.completed),'Current ready records generated in period'),
    card('Quick Read errors',num(d.quick_period.errors),'Current failures updated in period'),
    card('Site visitors','Unavailable','Visitor tracking is not connected')
  ].join('');
  $('charts').innerHTML=chart('New members',d.daily,'members')+chart('New jobs',d.daily,'jobs')+chart('Quick Reads completed',d.daily,'quick_reads')+chart('Confirmed live revenue · PHP',d.daily,'revenue_php',true);
  const pilot=d.pilot;
  $('quick').innerHTML='<article><h3>Queue & completion state · now</h3>'+d.queue.map(q=>row('Queue / '+q.state,num(q.count))).join('')+d.quick_reads.map(q=>row('Quick Reads / '+q.status,num(q.count))).join('')+row('Worker automation',d.runtime.quick_read_enabled?'Enabled':'Disabled')+row('Database automation',d.automation?.enabled?'Enabled':'Disabled')+'<p class="note">Queue states are current snapshots, independent of the period filter.</p></article><article><h3>Cost reservations · current pilot</h3>'+(pilot?row('Pilot gate',pilot.enabled?'Enabled':'Disabled')+row('Claims',num(pilot.claims))+row('Budget',money(pilot.budget_usd))+row('Reserved',money(pilot.reserved_usd))+row('Remaining',money(Math.max(0,Number(pilot.budget_usd)-Number(pilot.reserved_usd))))+row('Worst-case request reservation',money(pilot.worst_request_usd)):'<p>Pilot reservation record unavailable.</p>')+'<p class="note">USD reservations are conservative budget holds. Actual provider spend is not connected. This dashboard cannot change caps or run jobs.</p></article>';
  $('errors').innerHTML=table(['Job ID','Error code','Last update'],d.errors.map(e=>[e.job_id,e.error_code||'Unspecified',date(e.updated_at)]),'No current failures updated in this period.');
  $('import-table').innerHTML=table(['Source','Latest collection · Manila','Freshness','New jobs in period','Active eligible rows'],d.imports.map(i=>[i.source||'Unknown',date(i.last_collected_at),!i.last_collected_at?'Unknown':Date.parse(d.generated_at)-Date.parse(i.last_collected_at)>86400000?'Review · over 24h':'Recent',num(i.new_jobs),num(i.eligible_active_rows)]));
  $('payment-table').innerHTML=table(['Mode','Current status','Checkout records'],d.payment_events.map(p=>[p.livemode?'Live':'Test · excluded from revenue',p.status,num(p.count)]));
}
function preset(){
  if($('period').value==='custom') return;
  $('end').value=today();
  $('start').value=new Date(Date.parse($('end').value+'T00:00:00Z')-(Number($('period').value)-1)*86400000).toISOString().slice(0,10);
}
let lastSuccess=null,requestId=0;
async function load(){
  const id=++requestId;
  const start=$('start').value,end=$('end').value,span=(Date.parse(end)-Date.parse(start))/86400000;
  if(!start || !end || !Number.isFinite(span) || span<0 || span>90 || end>today()){
    $('status').className='error';$('status').textContent='Choose valid dates, up to 91 days, ending today or earlier.';return;
  }
  $('filters').querySelector('button').disabled=true;
  $('dashboard').setAttribute('aria-busy','true');
  $('status').className='';$('status').textContent='Loading production metrics…';
  try{
    const r=await fetch('/admin/api/analytics?'+new URLSearchParams({start,end}),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||'Could not load analytics.');
    if(id!==requestId)return;
    render(d);lastSuccess=d;
    $('status').textContent='Updated '+date(d.generated_at)+' · '+d.start+' through '+d.end+' · Totals marked “now” reflect current state.';
  }catch(error){
    if(id!==requestId)return;
    $('status').className='error';$('status').textContent=(error.name==='TimeoutError'?'The request timed out. Please retry.':error.message)+(lastSuccess?' Showing previous data for '+lastSuccess.start+' through '+lastSuccess.end+', updated '+date(lastSuccess.generated_at)+'.':' Please refresh to retry.');
  }finally{
    if(id===requestId){$('filters').querySelector('button').disabled=false;$('dashboard').setAttribute('aria-busy','false');}
  }
}
$('period').addEventListener('change',()=>{preset();if($('period').value!=='custom')load();});
for(const id of ['start','end']){$(id).max=today();$(id).addEventListener('change',()=>{$('period').value='custom';});}
$('filters').addEventListener('submit',e=>{e.preventDefault();load();});
preset();load();
