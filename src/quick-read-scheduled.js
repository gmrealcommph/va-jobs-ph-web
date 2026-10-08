import {generateJob, rpc} from './quick-read-service.js';

export const QUICK_READ_CRON = '2-59/5 * * * *';
// One provider request per tick: bounded subrequests, no sleeping or backfill.
export async function scheduledQuickReads(controller, env, {call=rpc, run=generateJob, log=console.log}={}) {
  if(controller.cron!==QUICK_READ_CRON || env.QUICK_READ_AUTO_ENABLED!=='true') return;
  if(!env.OPENAI_API_KEY || env.QUICK_READ_MODEL!=='gpt-5-mini' || (env.QUICK_READ_PROVIDER || 'openai')!=='openai') {
    log(JSON.stringify({event:'quick_read_auto',status:'provider_not_configured'})); return;
  }
  try {
    const jobs=await call(env,'quick_read_auto_candidates',{});
    if(!jobs.length) return;
    const job=jobs[0];
    const result=await run(env,job.id,{call});
    log(JSON.stringify({event:'quick_read_auto',job_id:job.id,status:result.status,error:result.error || null}));
  } catch {
    // No source, provider response, credentials, or raw exception in logs.
    log(JSON.stringify({event:'quick_read_auto',status:'service_unavailable'}));
  }
}
