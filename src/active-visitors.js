import {completionObjectRequest,completionAlarm} from './tool-completions.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
export const publicActivityPath=path=>!/^\/(?:admin|api|webhooks|traffic|activity|auth|logout|account\/delete)(?:\/|$)/.test(path);
export async function activityEndpoint(request,env){
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const url=new URL(request.url);
 if(request.headers.get('origin')!==url.origin||request.headers.get('content-type')!=='application/json')return json({error:'Forbidden'},403);
 if(!env.ACTIVE_VISITORS)return json({available:false,reason:'not_connected'},503);
 if(Number(request.headers.get('content-length'))>200)return json({error:'Too large'},413);
 let b;try{const raw=await request.text();if(raw.length>200)return json({error:'Too large'},413);b=JSON.parse(raw);}catch{return json({error:'Invalid request'},400);}
 if(!UUID.test(b?.id||''))return json({error:'Invalid session'},400);
 const stub=env.ACTIVE_VISITORS.getByName('public');
 // Withdrawals are allowed even after a browser privacy preference changes.
 if(b.remove===true){const r=await stub.fetch('https://internal/remove',{method:'POST',body:JSON.stringify({id:b.id})});const h=new Headers(r.headers);h.append('Set-Cookie','veeays_ga4_consent=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');return new Response(r.body,{status:r.status,headers:h});}
 let ref;try{ref=new URL(request.headers.get('referer'));}catch{return json({error:'Public page required'},400);}
 if(ref.origin!==url.origin||!publicActivityPath(ref.pathname))return json({error:'Public page required'},400);
 if(b.consent!==true||request.headers.get('sec-gpc')==='1'||request.headers.get('dnt')==='1')return json({recorded:false},403);
 const ua=request.headers.get('user-agent')||'';
 if(!ua||/bot|crawler|spider|headless|health|uptime|monitor|curl|wget|python|checkly/i.test(ua)||request.cf?.botManagement?.verifiedBot||request.cf?.botManagement?.score<30)return json({recorded:false});
 try{const r=await stub.fetch('https://internal/ping',{method:'POST',body:JSON.stringify({id:b.id})});const h=new Headers(r.headers);if(r.ok)h.append('Set-Cookie','veeays_ga4_consent=yes; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=1800');return new Response(r.body,{status:r.status,headers:h});}catch{return json({available:false,reason:'provider_error'},503);}
}
export async function activeVisitorCount(env){
 if(!env.ACTIVE_VISITORS)return {available:false,reason:'not_connected'};
 try{const r=await env.ACTIVE_VISITORS.getByName('public').fetch('https://internal/count');const b=await r.json();if(!r.ok||!Number.isSafeInteger(b.visits)||b.visits<0)throw Error();return {...b,available:true,source:'First-party activity',window_minutes:5,consent_required:true};}catch{return {available:false,reason:'provider_error'};}
}
// One strongly consistent object, shared across Worker isolates. No IP, UA, path,
// account ID, payment data or GA client ID is stored. Idle IDs expire in 5 minutes.
export class ActiveVisitors{
 constructor(ctx){this.ctx=ctx;this.sql=ctx.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS active (id TEXT PRIMARY KEY, seen INTEGER NOT NULL)');this.sql.exec('CREATE INDEX IF NOT EXISTS active_seen ON active(seen)');}
 async fetch(request){
  const now=Date.now(),path=new URL(request.url).pathname;
  if(path.startsWith('/tool-completions/'))return completionObjectRequest(this.ctx,request);
  this.sql.exec('DELETE FROM active WHERE seen <= ?',now-300000);
  if(path==='/count')return json({visits:this.sql.exec('SELECT count(*) AS n FROM active').one().n,fetched_at:new Date(now).toISOString()});
  const b=await request.json();if(!UUID.test(b.id||''))return json({error:'Invalid session'},400);
  if(path==='/remove'){this.sql.exec('DELETE FROM active WHERE id = ?',b.id);return json({recorded:false});}
  if(path!=='/ping')return json({error:'Not found'},404);
  if(this.sql.exec('SELECT count(*) AS n FROM active').one().n>=100000&&!this.sql.exec('SELECT id FROM active WHERE id = ?',b.id).toArray().length)return json({available:false,reason:'capacity'},503);
  this.sql.exec('INSERT INTO active (id,seen) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET seen=excluded.seen WHERE active.seen < ?',b.id,now,now-20000);
  if(await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(now+300000);
  return json({recorded:true});
 }
 async alarm(){const now=Date.now();this.sql.exec('DELETE FROM active WHERE seen <= ?',now-300000);let next=this.sql.exec('SELECT count(*) AS n FROM active').one().n?now+300000:null;const completionNext=completionAlarm(this.sql,now);if(completionNext!==null)next=next===null?completionNext:Math.min(next,completionNext);if(next!==null)await this.ctx.storage.setAlarm(next);}
}
