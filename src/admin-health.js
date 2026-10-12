// Provider access is server-only. Never reuse a sending key for browser requests.
export function quotaLevel(used,limit){
  if(limit===null)return 'uncapped';
  if(!Number.isFinite(used)||used<0||!Number.isFinite(limit)||limit<=0)return 'unknown';
  const fraction=used/limit;
  return fraction>=1?'critical':fraction>=.9?'high':fraction>=.7?'warning':'normal';
}
export async function emailUsage(env,{request=fetch,now=Date.now}={}){
  const checked_at=new Date(now()).toISOString();
  const fail=(reason,extra={})=>({available:false,reason,checked_at,...extra});
  if(!env.RESEND_USAGE_KEY)return fail('not_connected');
  try{
    const r=await request('https://api.resend.com/usage',{redirect:'manual',headers:{Authorization:'Bearer '+env.RESEND_USAGE_KEY},signal:AbortSignal.timeout(5000)});
    if(!r.ok){
      const retry=Number(r.headers.get('retry-after'));
      return fail([401,403].includes(r.status)?'access_denied':r.status===429?'rate_limited':r.status===404?'endpoint_unavailable':'provider_error',{provider_status:r.status,...(r.status===429?{retry_after_seconds:Number.isFinite(retry)?Math.min(3600,Math.max(300,retry)):300}:{})});
    }
    const data=await r.json(),result={available:true,source:'Resend Usage API',scope:'account-wide',checked_at,fetched_at:checked_at};
    for(const window of ['daily','monthly']){
      const q=data.emails?.[window];
      if(!q||!Number.isSafeInteger(q.used)||q.used<0||!(q.limit===null||Number.isSafeInteger(q.limit)&&q.limit>0)||!Number.isFinite(Date.parse(q.resets_at))||Date.parse(q.resets_at)<=now())return fail('invalid_response');
      result[window]={used:q.used,limit:q.limit,resets_at:q.resets_at,level:quotaLevel(q.used,q.limit)};
      for(const metric of ['sent','received'])if(Number.isSafeInteger(q[metric])&&q[metric]>=0)result[window][metric]=q[metric];
    }
    return result;
  }catch(error){return fail(error?.name==='TimeoutError'||error?.name==='AbortError'?'timeout':'provider_error');}
}
export function actionCenter(data,now=Date.now()){
  const issues=new Map();
  const add=(key,severity,title,href)=>issues.set(key,{key,severity,title,href});
  for(const window of ['daily','monthly']){
    const q=data.email_health?.usage?.[window];
    if(q&&['warning','high','critical'].includes(q.level))add('resend-'+window,q.level,'Resend '+window+' quota: '+q.used+' / '+q.limit,'#email-health');
  }
  if(data.email_health?.usage?.available===false)add('resend-unavailable','warning','Resend quota monitoring unavailable','#email-health');
  for(const source of data.imports||[]){
    if(!source.last_collected_at||now-Date.parse(source.last_collected_at)>86400000)add('source-'+source.source,'warning',(source.source||'Unknown')+': collection freshness needs review','#imports');
  }
  if(Number(data.quick_period?.errors)>0)add('quick-errors','high',data.quick_period.errors+' current Quick Read failures in selected period','#operations');
  if(Number(data.extended?.email?.retrying)>0)add('email-retries','high',data.extended.email.retrying+' email batches awaiting retry','#email-health');
  if(data.visitors?.available===false)add('visits-unavailable','warning','Site visits integration unavailable','#marketing');
  if(data.extended?.available===false)add('data-unavailable','high','Extended analytics are unavailable','#system-health');
  const ranks={critical:0,high:1,warning:2};
  return [...issues.values()].sort((a,b)=>ranks[a.severity]-ranks[b.severity]||a.key.localeCompare(b.key));
}

// This cache stores only provider aggregates. Authorization is checked before use.
export function createUsageCache(){
  let key,entry,lastGood,inflight;
  return async function(env,options={}){
    const now=options.now||Date.now,at=now();
    if(key!==env.RESEND_USAGE_KEY){key=env.RESEND_USAGE_KEY;entry=lastGood=inflight=undefined;}
    if(entry&&entry.expires>at)return structuredClone(entry.data);
    if(inflight)return structuredClone(await inflight);
    const activeKey=key;
    const pending=(async()=>{
      const data=await emailUsage(env,{...options,now});
      let expires=now()+Math.max(300,data.retry_after_seconds||0)*1000;
      if(data.available){
        expires=Math.min(expires,...['daily','monthly'].map(w=>Date.parse(data[w].resets_at)));
      }else if(lastGood&&now()-Date.parse(lastGood.fetched_at)<1800000){
        data.last_known=structuredClone(lastGood);data.stale=true;
      }
      data.next_refresh_at=new Date(expires).toISOString();
      data.cache_scope='worker-isolate';
      if(activeKey===key){if(data.available)lastGood=structuredClone(data);entry={expires,data};}
      return data;
    })();
    inflight=pending;
    try{return structuredClone(await pending);}finally{if(inflight===pending)inflight=undefined;}
  };
}
export const cachedEmailUsage=createUsageCache();
