import { rest } from './notifications.js';
import { FORMATTER_VERSION, SCHEMA_VERSION, SOURCE_RULES_VERSION, sourceFingerprint, sourceUnits, validateStored, generateWithProvider } from './quick-read-generation.js';
import {failureDiagnostics,storedSelection} from './quick-read-diagnostics.js';

function serverConfig(env) {
  const url=new URL(env.SUPABASE_URL);
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  if(url.protocol!=='https:' || !key || !(key.startsWith('sb_secret_') || key.startsWith('eyJ'))) throw new Error('server_not_configured');
  return {url,key,modernKey:key.startsWith('sb_secret_')};
}
export async function rpc(env, name, args) {
  return rest(serverConfig(env),`rpc/${name}`,{}, {method:'POST',body:JSON.stringify(args)});
}
export async function generateJob(env, id, {call=rpc,generate=generateWithProvider}={}) {
  const token=crypto.randomUUID();
  const claim=await call(env,'claim_job_quick_read_recovery',{p_job_id:String(id),p_formatter:FORMATTER_VERSION,p_token:token,p_source_rules:SOURCE_RULES_VERSION});
  if(claim.status!=='claimed') return {job_id:String(id),status:claim.status};
  let generated;
  try {
    sourceUnits(claim.description);
    const hash=await sourceFingerprint(claim.description);
    if(hash!==claim.source_hash) throw new Error('source_hash_mismatch');
    generated=await generate(env,claim.description);
    const payload=validateStored(generated,claim.description);
    if(!payload) throw new Error('invalid_generated_output');
    const result=await call(env,'finish_job_quick_read_with_diagnostics',{p_job_id:String(id),p_token:token,p_payload:payload,p_model:env.QUICK_READ_MODEL,p_schema:SCHEMA_VERSION,p_error:null,p_diagnostics:null,p_source_rules:SOURCE_RULES_VERSION});
    return {job_id:String(id),status:result.status};
  } catch(error) {
    // Only known error codes enter storage; never API responses, credentials or source text.
    const allowed=/^(unsupported_source|unsafe_source|source_hash_mismatch|invalid_generated_output|invalid_schema|invalid_source_reference|unsupported_requirement|preference_upgraded|mixed_obligation|application_condition_misplaced|material_condition_misplaced|source_omitted|provider_(not_configured|http_\d{3}|incomplete|refusal|invalid_output|invalid_json))$/;
    const code=allowed.test(error.message)?error.message:'generation_failed';
    const selection=error.quickReadSelection ?? (generated ? storedSelection(generated,claim.description) : null);
    const diagnosticCodes=/^(invalid_schema|invalid_generated_output|invalid_source_reference|unsupported_requirement|preference_upgraded|mixed_obligation|application_condition_misplaced|material_condition_misplaced|source_omitted)$/;
    const diagnostics=code==='provider_incomplete'?(error.quickReadProviderDiagnostics ?? null):
      diagnosticCodes.test(code)?failureDiagnostics(selection,claim.description,code):null;
    const result=await call(env,'finish_job_quick_read_with_diagnostics',{p_job_id:String(id),p_token:token,p_payload:null,p_model:env.QUICK_READ_MODEL,p_schema:SCHEMA_VERSION,p_error:code,p_diagnostics:diagnostics,p_source_rules:SOURCE_RULES_VERSION});
    return result.status==='failed' ? {job_id:String(id),status:'failed',error:code} : {job_id:String(id),status:result.status};
  }
}
async function tokenMatches(actual, expected) {
  const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const [a,b]=await Promise.all([digest(actual),digest(expected)]);
  return a.reduce((n,v,i)=>n|(v^b[i]),0)===0;
}
export async function quickReadEndpoint(request, env, id, deps={}) {
  const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(request.method!=='POST') return json({error:'method_not_allowed'},405);
  if(env.QUICK_READ_MODE!=='manual') return json({error:'generation_disabled'},503);
  const expected=env.QUICK_READ_ADMIN_TOKEN;
  const actual=(request.headers.get('authorization') || '').replace(/^Bearer /,'');
  if(!expected || expected.length<32 || !actual || actual.length>512 || !await tokenMatches(actual,expected)) return json({error:'unauthorized'},401);
  if(!env.OPENAI_API_KEY || !env.QUICK_READ_MODEL || (env.QUICK_READ_PROVIDER || 'openai')!=='openai') return json({error:'provider_not_configured'},503);
  const call=deps.call || rpc;
  try {
    if(id) return json(await generateJob(env,id,deps));
    if(env.QUICK_READ_BATCH_ENABLED!=='true') return json({error:'batch_disabled'},403);
    if(Number(request.headers.get('content-length') || 0)>2048) return json({error:'invalid_batch'},400);
    const body=await request.text();
    if(body.length>2048) return json({error:'invalid_batch'},400);
    let args;
    try {args=JSON.parse(body);} catch {return json({error:'invalid_batch'},400);}
    const started=args?.run_started_at;
    if(started!==undefined && (typeof started!=='string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{1,7}Z$/.test(started) || !Number.isFinite(Date.parse(started)) || Date.parse(started)>Date.now() || Date.parse(started)<Date.now()-86400000)) return json({error:'invalid_batch'},400);
    if(args?.mode==='recovery') {
      if(Object.keys(args).some(k=>!['mode','run_started_at'].includes(k)) || !started) return json({error:'invalid_batch'},400);
      const recovery=await call(env,'quick_read_recovery_state',{p_formatter:FORMATTER_VERSION,p_source_rules:SOURCE_RULES_VERSION,p_run_started_at:started});
      return json({recovery});
    }
    if(!args || Object.keys(args).some(k=>!['limit','after_id','run_started_at'].includes(k)) || !Number.isInteger(args.limit) || args.limit<1 || args.limit>5 || !/^\d{1,19}$/.test(String(args.after_id ?? '0'))) return json({error:'invalid_batch'},400);
    const jobs=await call(env,'quick_read_candidates_recovery',{p_after_id:String(args.after_id || '0'),p_limit:args.limit,p_formatter:FORMATTER_VERSION,p_source_rules:SOURCE_RULES_VERSION,p_run_started_at:started || null});
    const results=[];
    for(const job of jobs) {
      const result=await generateJob(env,job.id,deps); results.push(result);
      if(result.status==='rate_limited' || result.status==='busy') break;
    }
    const completed=results.filter(r=>!['rate_limited','busy'].includes(r.status));
    return json({results,next_after_id:completed.at(-1)?.job_id || String(args.after_id || '0')});
  } catch { return json({error:'quick_read_service_unavailable'},503); }
}
