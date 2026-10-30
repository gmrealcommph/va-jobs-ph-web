// Read-only data feed for the Operations HQ scene (GET /admin/api/ops-hq).
// Composes existing admin RPC snapshots. Anything with no verified source is null.
// No personal data: events carry only hashed ids, timestamps and counts.
const TZ='Asia/Manila';
const MAX_EVENTS=60, CACHE_MS=15000;
const cache=new Map();
const dayKey=(d)=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const num=(v)=>{const n=Number(v);return v!==null&&v!==undefined&&v!==''&&Number.isFinite(n)?n:null;};
const iso=(v)=>{const t=Date.parse(v);return Number.isFinite(t)?new Date(t).toISOString():null;};
const ok=(r)=>r&&r.status==='fulfilled'&&r.value&&typeof r.value==='object'?r.value:null;

export function buildOpsHq({analytics,quick,registrations,payments},now=new Date(),since=null){
  const today=dayKey(now), yesterday=dayKey(new Date(now.getTime()-86400000));
  const daily=Array.isArray(analytics?.daily)?analytics.daily:[];
  const dayRow=(k)=>daily.find((x)=>String(x.day).slice(0,10)===k)||null;
  const t=dayRow(today), y=dayRow(yesterday);
  const newM=t?num(t.members):null, prevM=y?num(y.members):null;
  const growth=newM!==null&&prevM?Math.round(((newM-prevM)/prevM)*1000)/10:null;
  const counts=quick?.counts||null, reads=quick?.all_reads||null;
  const upgradesToday=payments?.available&&Array.isArray(payments.events)
    ? payments.events.filter((e)=>dayKey(new Date(e.confirmed_at))===today).length : null;
  const metrics={
    intake:{new_today:newM,total:num(analytics?.members),growth_pct:growth},
    jobs:{active:num(analytics?.live_jobs),new_today:t?num(t.jobs):null,processing:null},
    reads:{queued:counts?num(counts.queued):null,running:counts?num(counts.processing):null,
      ready_total:reads?num(reads.ready):null,failed:reads?num(reads.failed):null},
    pro:{active:num(analytics?.pro_access),upgrades_today:upgradesToday,expiring_7d:null},
    refer:{verified_signups:null,eligible_conversions:null,on_hold:null},
    comms:{accepted_today:null,delivered_today:null,suppressed_or_bounced_today:null},
    health:{database:analytics?'healthy':'unknown',edge:'healthy',queue_depth:counts?num(counts.queued):null,alerts:null},
    chief:{open:null,done:null}
  };
  const events=[];
  if(registrations?.available&&Array.isArray(registrations.events))for(const e of registrations.events){
    const at=iso(e.registered_at);if(e.event_id&&at)events.push({event_id:'reg:'+e.event_id,desk:'intake',kind:'good',type:'member_registered',occurred_at:at,count:1});}
  if(payments?.available&&Array.isArray(payments.events))for(const e of payments.events){
    const at=iso(e.confirmed_at);if(e.event_id&&at)events.push({event_id:'pay:'+e.event_id,desk:'pro',kind:'good',type:'pro_upgrade',occurred_at:at,count:1});}
  if(quick&&Array.isArray(quick.recent))for(const e of quick.recent){
    const at=iso(e.at);if(!at||!['completed','failed'].includes(e.event))continue;
    events.push({event_id:'qr:'+e.event+':'+e.job_id+':'+at,desk:'reads',kind:e.event==='completed'?'good':'alert',
      type:e.event==='completed'?'quick_read_completed':'quick_read_failed',occurred_at:at,count:1});}
  const floor=iso(since);
  const out=events.filter((e)=>!floor||e.occurred_at>=floor)
    .sort((a,b)=>a.occurred_at<b.occurred_at?-1:a.occurred_at>b.occurred_at?1:a.event_id<b.event_id?-1:1).slice(-MAX_EVENTS);
  return {generated_at:now.toISOString(),stale:false,metrics,events:out};
}

export async function opsHqPayload(env,token,userId,call,since=null,now=new Date()){
  const hit=cache.get(userId);
  let sources;
  if(hit&&hit.expires>Date.now())sources=hit.sources;
  else{
    const d=dayKey(now), y=dayKey(new Date(now.getTime()-86400000));
    const r=await Promise.allSettled([
      call(env,token,'veeays_admin_analytics',{p_start:y,p_end:d}),
      call(env,token,'veeays_admin_quick_reads',{}),
      call(env,token,'veeays_admin_registration_snapshot',{}),
      call(env,token,'veeays_admin_payment_snapshot',{})
    ]);
    for(const x of r)if(x.status==='rejected'&&[401,403].includes(x.reason?.status))throw x.reason;
    sources={analytics:ok(r[0]),quick:ok(r[1]),registrations:ok(r[2]),payments:ok(r[3]),generated:now};
    if(!sources.analytics&&!sources.quick){
      if(hit)return {...buildOpsHq(hit.sources,now,since),stale:true,generated_at:hit.sources.generated.toISOString()};
      throw Object.assign(new Error('Ops HQ unavailable'),{status:503});
    }
    for(const [k,v] of cache)if(v.expires<=Date.now())cache.delete(k);
    if(cache.size<100)cache.set(userId,{expires:Date.now()+CACHE_MS,sources});
  }
  return buildOpsHq(sources,now,since);
}
export function _resetOpsHqCache(){cache.clear();}
