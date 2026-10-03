import { rest } from './notifications.js';
import { FORMATTER_VERSION, SCHEMA_VERSION, sourceFingerprint, sourceUnits, validateStored, generateWithProvider } from './quick-read-generation.js';

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
  const claim=await call(env,'claim_job_quick_read',{p_job_id:String(id),p_formatter:FORMATTER_VERSION,p_token:token});
  if(claim.status!=='claimed') return {job_id:String(id),status:claim.status};
  try {
    sourceUnits(claim.description);
    const hash=await sourceFingerprint(claim.description);
    if(hash!==claim.source_hash) throw new Error('source_hash_mismatch');
    const generated=await generate(env,claim.description);
    const payload=validateStored(generated,claim.description);
    if(!payload) throw new Error('invalid_generated_output');
    const result=await call(env,'finish_job_quick_read',{p_job_id:String(id),p_token:token,p_payload:payload,p_model:env.QUICK_READ_MODEL,p_schema:SCHEMA_VERSION,p_error:null});
    return {job_id:String(id),status:result.status};
  } catch(error) {
    // Only known error codes enter storage; never API responses, credentials or source text.
    const allowed=/^(unsupported_source|unsafe_source|source_hash_mismatch|invalid_generated_output|invalid_schema|invalid_source_reference|unsupported_requirement|preference_upgraded|mixed_obligation|application_condition_misplaced|material_condition_misplaced|source_omitted|provider_(not_configured|http_\d{3}|incomplete|refusal|invalid_output|invalid_json))$/;
    const code=allowed.test(error.message)?error.message:'generation_failed';
    await call(env,'finish_job_quick_read',{p_job_id:String(id),p_token:token,p_payload:null,p_model:env.QUICK_READ_MODEL,p_schema:SCHEMA_VERSION,p_error:code});
    return {job_id:String(id),status:'failed',error:code};
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
    if(!args || Object.keys(args).some(k=>!['limit','after_id'].includes(k)) || !Number.isInteger(args.limit) || args.limit<1 || args.limit>5 || !/^\d{1,19}$/.test(String(args.after_id ?? '0'))) return json({error:'invalid_batch'},400);
    const jobs=await call(env,'quick_read_candidates',{p_after_id:String(args.after_id || '0'),p_limit:args.limit,p_formatter:FORMATTER_VERSION});
    const results=[];
    for(const job of jobs) {
      const result=await generateJob(env,job.id,deps); results.push(result);
      if(result.status==='rate_limited' || result.status==='busy') break;
    }
    const completed=results.filter(r=>!['rate_limited','busy'].includes(r.status));
    return json({results,next_after_id:completed.at(-1)?.job_id || String(args.after_id || '0')});
  } catch { return json({error:'quick_read_service_unavailable'},503); }
}
