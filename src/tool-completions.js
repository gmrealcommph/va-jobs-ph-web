// Anonymous completion totals only. No account IDs, IPs, answers or résumé text.
export const completionId=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tools=new Set(['niche_finder','resume_studio']);
const TTL=86400000;
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
function schema(sql,now){
 sql.exec('CREATE TABLE IF NOT EXISTS tool_receipts (tool TEXT NOT NULL, id TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(tool,id))');
 sql.exec('CREATE INDEX IF NOT EXISTS tool_receipts_created ON tool_receipts(created)');
 sql.exec('CREATE TABLE IF NOT EXISTS tool_totals (tool TEXT PRIMARY KEY, total INTEGER NOT NULL)');
 sql.exec('CREATE TABLE IF NOT EXISTS tool_meta (id INTEGER PRIMARY KEY CHECK(id=1), started INTEGER NOT NULL)');
 sql.exec('INSERT OR IGNORE INTO tool_meta (id,started) VALUES (1,?)',now);
 sql.exec('DELETE FROM tool_receipts WHERE created <= ?',now-TTL);
}
export function completionAlarm(sql,now){
 if(!sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='tool_receipts'").toArray().length)return null;
 sql.exec('DELETE FROM tool_receipts WHERE created <= ?',now-TTL);
 const next=sql.exec('SELECT MIN(created) AS oldest FROM tool_receipts').one().oldest;
 return next===null?null:next+TTL;
}
export async function completionObjectRequest(ctx,request){
 const now=Date.now(),sql=ctx.storage.sql,path=new URL(request.url).pathname;schema(sql,now);
 if(path==='/tool-completions/count'&&request.method==='GET'){
  const rows=sql.exec('SELECT tool,total FROM tool_totals').toArray(),counts=Object.fromEntries(rows.map(r=>[r.tool,r.total]));
  return json({available:true,niche_finder:counts.niche_finder||0,resume_studio:counts.resume_studio||0,started_at:new Date(sql.exec('SELECT started FROM tool_meta WHERE id=1').one().started).toISOString(),count_type:'completed_forms'});
 }
 if(path!=='/tool-completions/record'||request.method!=='POST')return json({error:'Not found'},404);
 let body;try{const raw=await request.text();if(raw.length>160)return json({error:'Too large'},413);body=JSON.parse(raw);}catch{return json({error:'Invalid request'},400);}
 if(!tools.has(body?.tool)||!completionId.test(body?.id||''))return json({error:'Invalid completion'},400);
 const counted=ctx.storage.transactionSync(()=>{
  if(sql.exec('SELECT id FROM tool_receipts WHERE tool=? AND id=?',body.tool,body.id).toArray().length)return false;
  sql.exec('INSERT INTO tool_receipts (tool,id,created) VALUES (?,?,?)',body.tool,body.id,now);
  sql.exec('INSERT INTO tool_totals (tool,total) VALUES (?,1) ON CONFLICT(tool) DO UPDATE SET total=tool_totals.total+1',body.tool);
  return true;
 });
 const alarm=await ctx.storage.getAlarm();if(alarm===null||alarm>now+TTL)await ctx.storage.setAlarm(now+TTL);
 return json({recorded:true,counted});
}
const stub=env=>env.ACTIVE_VISITORS?.getByName('tool-completions-v1');
export async function recordCompletion(env,tool,id){
 if(!tools.has(tool)||!completionId.test(id||''))return false;
 try{const object=stub(env);if(!object)return false;const r=await object.fetch('https://internal/tool-completions/record',{method:'POST',body:JSON.stringify({tool,id}),signal:AbortSignal.timeout(1500)});return r.ok;}catch{return false;}
}
export async function toolCompletionCounts(env){
 try{const object=stub(env);if(!object)return {available:false};const r=await object.fetch('https://internal/tool-completions/count',{signal:AbortSignal.timeout(2000)}),data=await r.json();if(!r.ok||!['niche_finder','resume_studio'].every(k=>Number.isSafeInteger(data[k])&&data[k]>=0))throw Error();return {...data,available:true};}catch{return {available:false};}
}
export async function resumeCompletionEndpoint(request,env){
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('content-type')!=='application/json')return json({error:'Forbidden'},403);
 if(request.headers.get('sec-gpc')==='1'||request.headers.get('dnt')==='1')return json({recorded:false});
 const ua=request.headers.get('user-agent')||'';
 if(!ua||/bot|crawler|spider|headless|uptime|monitor|curl|wget|python/i.test(ua)||request.cf?.botManagement?.verifiedBot||request.cf?.botManagement?.score<30)return json({recorded:false});
 if(Number(request.headers.get('content-length'))>100)return json({error:'Too large'},413);
 let b;try{const raw=await request.text();if(raw.length>100)return json({error:'Too large'},413);b=JSON.parse(raw);}catch{return json({error:'Invalid completion'},400);}
 // The public endpoint accepts no tool name or content. Niche Finder is server-only.
 if(!b||Object.keys(b).length!==1||!completionId.test(b.id||''))return json({error:'Invalid completion'},400);
 const recorded=await recordCompletion(env,'resume_studio',b.id);return json({recorded},recorded?200:503);
}
