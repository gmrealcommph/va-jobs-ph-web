import {generateJob, rpc} from './quick-read-service.js';

export const QUICK_READ_CRON = '* * * * *';
// Bounded invocation work; the database serializes claims and provider cooldowns.
export async function scheduledQuickReads(controller, env, {call=rpc, run=generateJob, log=console.log}={}) {
  if(controller.cron!==QUICK_READ_CRON || env.QUICK_READ_AUTO_ENABLED!=='true') return;
  if(!env.OPENAI_QUICKREADS || !env.OPENAI_QUICKREADS_ADMIN || !env.OPENAI_QUICK_READS_API_KEY_ID || env.QUICK_READ_MODEL!=='gpt-5-mini' || (env.QUICK_READ_PROVIDER || 'openai')!=='openai') {
    log(JSON.stringify({event:'quick_read_auto',status:'provider_not_configured'})); return;
  }
  try {
    await call(env,'quick_read_enqueue_missing',{});
    for(let attempt=0;attempt<5;attempt++) {
      const jobs=await call(env,'quick_read_auto_candidates',{});
      if(!jobs.length) return;
      const job=jobs[0];
      const result=await run(env,job.id,{call});
      log(JSON.stringify({event:'quick_read_auto',status:result.status,error:result.error || null}));
      if(['rate_limited','busy','rollout_disabled','credit_paused','spending_stopped','spend_unavailable','rollout_exhausted'].includes(result.status) || ['provider_insufficient_credit','provider_http_429','provider_http_401','provider_http_403'].includes(result.error)) break;
    }
  }catch(error){
    const code=/^(server_not_configured|supabase_rpc\/[a-z_]+_\d{3}|invalid_rpc\/[a-z_]+_response)$/.test(error?.message||'')?error.message:'unexpected_'+(error instanceof TypeError?'type_error':'error');
    log(JSON.stringify({event:'quick_read_auto',status:'service_unavailable',code}));
  }
}
