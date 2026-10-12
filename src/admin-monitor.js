import {cachedEmailUsage} from './admin-health.js';
async function monitorRpc(env,name,body){
  if(!env.SUPABASE_SERVICE_ROLE_KEY||!env.SUPABASE_URL)throw new Error('monitor_not_configured');
  const r=await fetch(new URL('/rest/v1/rpc/'+name,env.SUPABASE_URL),{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
  if(!r.ok)throw new Error('monitor_store_unavailable');
  return r.json();
}
// Opt-in background observer. It never sends through Resend or mutates operations.
export async function scheduledAdminHealth(controller,env,{usage=cachedEmailUsage,call=monitorRpc,request=fetch,log=console.log}={}){
  if(controller.cron!=='*/15 * * * *'||env.ADMIN_HEALTH_MONITOR_ENABLED!=='true')return;
  try{
    const destination=new URL(env.ADMIN_ALERT_WEBHOOK_URL||'');
    if(destination.protocol!=='https:'||destination.username||destination.password||!env.ADMIN_ALERT_WEBHOOK_TOKEN)throw new Error('destination_not_configured');
    const data=await usage(env),alerts=[];
    if(!data.available){
      alerts.push({key:'resend-monitor-unavailable:'+new Date().toISOString().slice(0,10),severity:'high',title:'Resend quota monitoring unavailable',href:'/admin#email-health'});
    }else for(const window of ['daily','monthly']){
      const q=data[window];
      if(['warning','high','critical'].includes(q.level))alerts.push({key:'resend:'+window+':'+q.resets_at+':'+q.level,severity:q.level,title:'Resend '+window+' quota '+q.used+' / '+q.limit,href:'/admin#email-health'});
    }
    for(const alert of alerts){
      const claim=await call(env,'veeays_admin_claim_alert',{p_key:alert.key,p_payload:alert});
      if(!claim)continue;
      const response=await request(destination.href,{method:'POST',redirect:'error',headers:{'content-type':'application/json',Authorization:'Bearer '+env.ADMIN_ALERT_WEBHOOK_TOKEN,'idempotency-key':alert.key},body:JSON.stringify({event:'veeays_health',...alert}),signal:AbortSignal.timeout(5000)});
      if(response.ok)await call(env,'veeays_admin_ack_alert',{p_key:alert.key,p_token:claim});
    }
    log(JSON.stringify({event:'admin_health_monitor',status:'checked'}));
  }catch{log(JSON.stringify({event:'admin_health_monitor',status:'unavailable'}));}
}
