import {rpc} from './quick-read-service.js';
import {sourceReader,verifyListing} from './job-verification.js';
export const JOB_HEALTH_CRON='12,42 * * * *';
// Not registered in wrangler config. Opt-in evidence collection, never hiding.
export async function scheduledJobHealth(controller,env,{call=rpc,read=sourceReader(),log=console.log}={}) {
 if(controller.cron!==JOB_HEALTH_CRON||env.JOB_HEALTH_VERIFY_ENABLED!=='true')return;
 try {
  const candidates=await call(env,'veeays_job_health_candidates',{});
  if(!Array.isArray(candidates)||candidates.length>8)throw Error('Invalid candidate batch');
  for(const job of candidates){
   const result=await verifyListing(job,read),e=result.evidence;
   await call(env,'veeays_job_health_observation',{p_job_id:job.id,p_source:job.source,p_source_job_id:job.source_job_id,p_job_url:job.job_url,p_checked_at:result.checked_at,p_status:e.status,p_reason:e.reason,p_evidence_url:result.source_evidence_url,p_original_posted_at:e.original_posted_at,p_date_provenance:e.date_provenance,p_source_published_at:e.source_published_at||null});
  }
  log(JSON.stringify({event:'job_health_verification',checked:candidates.length,visibility_changes:0}));
 }catch{log(JSON.stringify({event:'job_health_verification',status:'unavailable',visibility_changes:0}));}
}
