// Read-only data feed for the Operations HQ scene (GET /admin/api/ops-hq).
// Composes EXISTING admin RPC snapshots only. Any metric with no verified source is null,
// never a guess. Events carry hashed ids, timestamps and counts only: no personal data.
const TZ='Asia/Manila';
const MAX_EVENTS=60;
const FAST_MS=15000;        // analytics, quick reads, registration and payment snapshots
const SLOW_MS=120000;       // veeays_admin_extended is the heaviest RPC; refresh at most every 2 minutes
const GRACE_MS=300000;      // reuse a last-good snapshot for at most 5 minutes when its RPC fails
const FRESH_MS=90000;       // beyond this a reused snapshot makes the payload "stale"
const LATE_WARN_MS=10*60000, LATE_CRIT_MS=30*60000;
const state=new Map();      // userId -> {fast:{at,data}, slow:{at,data}, last:{name:{at,data}}}
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
      ready_total:reads?num(reads.ready):null,failed:reads?num(reads.failed):null},
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
  const events=[...map.values()].filter((e)=>!floor||e.occurred_at>=floor)    // inclusive: the client dedupes by id
    .sort((a,b)=>a.occurred_at<b.occurred_at?-1:a.occurred_at>b.occurred_at?1:a.event_id<b.event_id?-1:1).slice(-MAX_EVENTS);
  return {generated_at:meta.generatedAt||now.toISOString(),stale:!!meta.stale,metrics,events};
}

export async function opsHqPayload(env,token,userId,call,since=null,now=new Date()){
  const clock=now.getTime();
  let s=state.get(userId);
  if(!s){
    if(state.size>=200)for(const [k,v] of state)if(clock-Math.max(v.fast?.at||0,v.slow?.at||0)>GRACE_MS)state.delete(k);
    s={fast:null,slow:null,last:{}};if(state.size<200)state.set(userId,s);
  }
  const d=dayKey(now), y=dayKey(new Date(clock-86400000));
  const fastJobs={analytics:['veeays_admin_analytics',{p_start:y,p_end:d}],quick:['veeays_admin_quick_reads',{}],
    registrations:['veeays_admin_registration_snapshot',{}],payments:['veeays_admin_payment_snapshot',{}]};
  const slowJobs={extended:['veeays_admin_extended',{p_start:d,p_end:d}]};
  const refresh=async(jobs)=>{
    const names=Object.keys(jobs);
    const res=await Promise.allSettled(names.map((n)=>Promise.resolve().then(()=>call(env,token,jobs[n][0],jobs[n][1]))));
    for(const r of res)if(r.status==='rejected'&&[401,403].includes(r.reason?.status))throw r.reason;
    const out={};names.forEach((n,i)=>{const v=obj(res[i]);if(v)s.last[n]={at:clock,data:v};out[n]=v;});
    return out;
  };
  if(!s.fast||clock-s.fast.at>=FAST_MS)s.fast={at:clock,data:await refresh(fastJobs)};
  if(!s.slow||clock-s.slow.at>=SLOW_MS)s.slow={at:clock,data:await refresh(slowJobs)};
  // Failed sources fall back to their last good snapshot for up to GRACE_MS; otherwise stay null.
  let stale=false,oldest=clock,failed=0;
  const sources={};
  for(const n of [...Object.keys(fastJobs),...Object.keys(slowJobs)]){
    const fresh=(s.fast.data[n]??s.slow.data[n])||null;
    if(!fresh)failed++;
    if(fresh){sources[n]=fresh;oldest=Math.min(oldest,(fastJobs[n]?s.fast:s.slow).at);continue;}
    const l=s.last[n];
    if(l&&clock-l.at<=GRACE_MS){sources[n]=l.data;oldest=Math.min(oldest,l.at);if(clock-l.at>FRESH_MS)stale=true;}
    else{sources[n]=null;if(fastJobs[n])stale=true;}
  }
  if(!sources.analytics&&!sources.quick)throw Object.assign(new Error('Ops HQ unavailable'),{status:503});
  // `failed` counts sources whose latest refresh failed even if a last-good copy is being reused.
  return buildOpsHq(sources,now,since,{stale,failed,generatedAt:new Date(oldest).toISOString()});
}
export function _resetOpsHqCache(){state.clear();}
