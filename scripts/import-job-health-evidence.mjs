import {readFile} from 'node:fs/promises';
// Default is a local dry run. Explicit write is for an approved staged rollout.
const input=process.argv[2];if(!input)throw Error('Provide verification snapshot path.');
const snapshot=JSON.parse(await readFile(input,'utf8'));
if(!snapshot.dry_run||snapshot.visibility_changes!==0||!Array.isArray(snapshot.rows)||snapshot.rows.length>1000)throw Error('Invalid verification snapshot');
if(!process.argv.includes('--write')){console.log(JSON.stringify({dry_run:true,observations:snapshot.rows.length,visibility_changes:0}));process.exit(0);}
const target=process.env.JOB_HEALTH_TARGET_PROJECT,base=new URL(process.env.SUPABASE_URL),key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!target||base.hostname!==target+'.supabase.co'||base.protocol!=='https:'||!key)throw Error('Explicit matching target project and service configuration required.');
if(Date.now()-Date.parse(snapshot.checked_at)>7*86400000)throw Error('Evidence is stale. Rerun source verification.');
let written=0;for(const r of snapshot.rows){const e=r.evidence;
 const result=await fetch(new URL('/rest/v1/rpc/veeays_job_health_observation',base),{method:'POST',headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),'content-type':'application/json'},body:JSON.stringify({p_job_id:r.id,p_source:r.source,p_source_job_id:r.source_job_id,p_job_url:r.job_url,p_checked_at:r.checked_at,p_status:e.status,p_reason:e.reason,p_evidence_url:r.source_evidence_url,p_original_posted_at:e.original_posted_at,p_date_provenance:e.date_provenance,p_source_published_at:e.source_published_at||null}),signal:AbortSignal.timeout(12000)});
 if(!result.ok)throw Error('Observation import stopped at job '+r.id+' (HTTP '+result.status+'). No visibility changes were requested.');written++;
}
console.log(JSON.stringify({observations:written,visibility_changes:0}));
