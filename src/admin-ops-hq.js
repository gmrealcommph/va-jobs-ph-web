// Read-only data feed for the Operations HQ scene (GET /admin/api/ops-hq).
// Composes EXISTING admin RPC snapshots only. Any metric with no verified source is null,
// never a guess. Events carry hashed ids, timestamps and counts only: no personal data.
const TZ='Asia/Manila';
const MAX_EVENTS=60;        // normal page size
const HARD_MAX=200;         // a page may grow past MAX_EVENTS only to finish a group of equal timestamps
const FAST_MS=15000;        // quick reads, registration and payment snapshots (event latency)
const MID_MS=60000;         // veeays_admin_analytics scans member/job totals; same 60s lifetime as the admin dashboard
const SLOW_MS=120000;       // veeays_admin_extended is the heaviest RPC; refresh at most every 2 minutes
const GRACE_MS=300000;      // reuse a last-good snapshot for at most 5 minutes when its RPC fails
const FRESH_MS=90000;       // beyond this a reused snapshot makes the payload "stale"
const LATE_WARN_MS=10*60000, LATE_CRIT_MS=30*60000;
const cache={fast:{},mid:{},slow:{},last:{}};   // shared across admins; last = last good snapshot per source
const dayKey=(d)=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const num=(v)=>{const n=Number(v);return v!==null&&v!==undefined&&v!==''&&Number.isFinite(n)?n:null;};
const iso=(v)=>{const t=Date.parse(v);return Number.isFinite(t)?new Date(t).toISOString():null;};
const obj=(r)=>r&&r.status==='fulfilled'&&r.value&&typeof r.value==='object'?r.value:null;

// Health is derived from real checks of the data we just read, not from "the HTTP request worked".
//  database: every source RPC answered (healthy), some failed (warning), none usable (critical).
//  edge:     the minute-cron Quick Read worker is draining its queue. If automation is enabled and the
//            oldest due item is old, the scheduled Worker is behind. If automation is off or unknown: unknown.
export function healthFrom({failed,total,quick,now}){
  const database=failed===0?'healthy':failed<total?'warning':'critical';
  let edge='unknown',alerts=failed;
  if(quick){
    const enabled=quick.automation?.enabled===true&&quick.gate?.enabled===true;
    const due=quick.oldest_due?now.getTime()-Date.parse(quick.oldest_due):0;
    if(enabled){
      edge=!Number.isFinite(due)||due<LATE_WARN_MS?'healthy':due<LATE_CRIT_MS?'warning':'critical';
      if(edge!=='healthy')alerts++;
    }
    if(num(quick.unmatched_running)>0)alerts++;
  }
  return {database,edge,alerts};
}

export function buildOpsHq({analytics,quick,extended,registrations,payments},now=new Date(),since=null,meta={}){
  const today=dayKey(now), yesterday=dayKey(new Date(now.getTime()-86400000));
  const daily=Array.isArray(analytics?.daily)?analytics.daily:[];
  const dayRow=(k)=>daily.find((x)=>String(x.day).slice(0,10)===k)||null;
  const t=dayRow(today), y=dayRow(yesterday);
  const newM=t?num(t.members):null, prevM=y?num(y.members):null;
  const growth=newM!==null&&prevM?Math.round(((newM-prevM)/prevM)*1000)/10:null;
  const counts=quick?.counts||null, reads=quick?.all_reads||null;
  const upgradesToday=payments?.available&&Array.isArray(payments.events)
    ? payments.events.filter((e)=>Number.isFinite(Date.parse(e.confirmed_at))&&dayKey(new Date(e.confirmed_at))===today).length : null;
  const all={analytics,quick,extended,registrations,payments};
  const failed=meta.failed??Object.values(all).filter((v)=>!v).length;
  const health=healthFrom({failed,total:Object.keys(all).length,quick,now});
  const metrics={
    intake:{new_today:newM,total:num(analytics?.members),growth_pct:growth},
    jobs:{active:num(analytics?.live_jobs),new_today:t?num(t.jobs):null,processing:null},
    reads:{queued:counts?num(counts.queued):null,running:counts?num(counts.processing):null,
      ready_total:reads?num(reads.ready):null,failed:reads?num(reads.failed):null,
      // queue rows in state 'stopped' whose Quick Read is not 'failed' (e.g. previously attempted). Disjoint from counts.failed.
      stopped:counts?num(counts.stopped_other):null},
    pro:{active:num(analytics?.pro_access),upgrades_today:upgradesToday,
      expiring_7d:extended?.available?num(extended.members?.expiring_7d):null},
    // No referral tables exist in this repo (veeays_referral: NOT FOUND); stay null until a source exists.
    refer:{verified_signups:null,eligible_conversions:null,on_hold:null},
    // accepted_today = digests + strong-match batches accepted by the provider today (NOT delivery).
    // Delivered/bounced are only logged, never stored, so they stay null.
    comms:{accepted_today:extended?.available&&extended.email?num(extended.email.accepted_in_period):null,
      delivered_today:null,suppressed_or_bounced_today:null},
    health:{database:health.database,edge:health.edge,queue_depth:counts?num(counts.queued):null,alerts:health.alerts},
    chief:{open:null,done:null}
  };
  // Events: Map keyed by event_id guarantees one entry per id even if an RPC repeats a row.
  const map=new Map();
  const add=(e)=>{if(e.event_id&&e.occurred_at&&!map.has(e.event_id))map.set(e.event_id,e);};
  if(registrations?.available&&Array.isArray(registrations.events))for(const e of registrations.events){
    if(typeof e.event_id==='string')add({event_id:'reg:'+e.event_id,desk:'intake',kind:'good',type:'member_registered',occurred_at:iso(e.registered_at),count:1});}
  if(payments?.available&&Array.isArray(payments.events))for(const e of payments.events){
    if(typeof e.event_id==='string')add({event_id:'pay:'+e.event_id,desk:'pro',kind:'good',type:'pro_upgrade',occurred_at:iso(e.confirmed_at),count:1});}
  if(quick&&Array.isArray(quick.recent))for(const e of quick.recent){
    if(!['completed','failed'].includes(e.event)||!Number.isInteger(Number(e.job_id)))continue;
    const at=iso(e.at);
    add({event_id:'qr:'+e.event+':'+Number(e.job_id)+':'+at,desk:'reads',kind:e.event==='completed'?'good':'alert',
      type:e.event==='completed'?'quick_read_completed':'quick_read_failed',occurred_at:at,count:1});}
  const floor=iso(since);
  const sorted=[...map.values()].filter((e)=>!floor||e.occurred_at>=floor)    // inclusive: the client dedupes by id
    .sort((a,b)=>a.occurred_at<b.occurred_at?-1:a.occurred_at>b.occurred_at?1:a.event_id<b.event_id?-1:1);
  // Oldest first: a page never skips ahead, so the client can page forward with `since` and lose nothing.
  // A page ends on a timestamp boundary (up to HARD_MAX) so events sharing a timestamp are never split.
  let events=sorted,has_more=false;
  if(sorted.length>MAX_EVENTS){
    const cut=sorted[MAX_EVENTS-1].occurred_at;let end=MAX_EVENTS;
    while(end<sorted.length&&end<HARD_MAX&&sorted[end].occurred_at===cut)end++;
    events=sorted.slice(0,end);has_more=end<sorted.length;
  }
  // `incomplete`: some event source was unavailable or hit its own row cap, so events may be missing (metrics are unaffected).
  const incomplete=!registrations?.available||!payments?.available||!quick||
    (registrations.events?.length||0)>=200||(payments.events?.length||0)>=200||(quick.recent?.length||0)>=12;
  return {generated_at:meta.generatedAt||now.toISOString(),stale:!!meta.stale,metrics,events,has_more,incomplete};
}

// Admin-only data is identical for every admin, so one shared cache (per Worker isolate) serves all
// admins, tabs and devices: Supabase load is bounded by the tier intervals, not by viewer count.
// Concurrent callers share one in-flight refresh per tier.
const TIERS={
  fast:{ms:FAST_MS,jobs:{quick:['veeays_admin_quick_reads',()=>({})],registrations:['veeays_admin_registration_snapshot',()=>({})],payments:['veeays_admin_payment_snapshot',()=>({})]}},
  mid:{ms:MID_MS,jobs:{analytics:['veeays_admin_analytics',(d,y)=>({p_start:y,p_end:d})]}},
  slow:{ms:SLOW_MS,jobs:{extended:['veeays_admin_extended',(d)=>({p_start:d,p_end:d})]}}
};
export async function opsHqPayload(env,token,call,since=null,now=new Date()){
  const clock=now.getTime();
  const d=dayKey(now), y=dayKey(new Date(clock-86400000));
  const refresh=(tier)=>{
    const t=TIERS[tier],c=cache[tier];
    if(c.data&&clock-c.at<t.ms)return c.data;
    if(c.inflight)return c.inflight;
    const names=Object.keys(t.jobs);
    c.inflight=Promise.allSettled(names.map((n)=>Promise.resolve().then(()=>call(env,token,t.jobs[n][0],t.jobs[n][1](d,y))))).then((res)=>{
      for(const r of res)if(r.status==='rejected'&&[401,403].includes(r.reason?.status))throw r.reason;
      const out={};names.forEach((n,i)=>{const v=obj(res[i]);if(v)cache.last[n]={at:clock,data:v};out[n]=v;});
      c.at=clock;c.data=out;return out;
    }).finally(()=>{c.inflight=null;});
    return c.inflight;
  };
  const [fast,mid,slow]=await Promise.all([refresh('fast'),refresh('mid'),refresh('slow')]);
  const fresh={...fast,...mid,...slow};
  let stale=false,oldest=clock,failed=0;
  const sources={};
  for(const n of Object.keys(fresh)){
    const tier=TIERS.fast.jobs[n]?'fast':TIERS.mid.jobs[n]?'mid':'slow';
    if(fresh[n]){sources[n]=fresh[n];oldest=Math.min(oldest,cache[tier].at);continue;}
    failed++;
    const l=cache.last[n];
    if(l&&clock-l.at<=GRACE_MS){sources[n]=l.data;oldest=Math.min(oldest,l.at);if(clock-l.at>FRESH_MS)stale=true;}
    else{sources[n]=null;if(tier!=='slow')stale=true;}
  }
  if(!sources.analytics&&!sources.quick)throw Object.assign(new Error('Ops HQ unavailable'),{status:503});
  // `failed` counts sources whose latest refresh failed even if a last-good copy is being reused.
  return buildOpsHq(sources,now,since,{stale,failed,generatedAt:new Date(oldest).toISOString()});
}
export function _resetOpsHqCache(){cache.fast={};cache.mid={};cache.slow={};cache.last={};}
