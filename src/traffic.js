import {safeLanding,referrerSource} from './admin-visitors.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let intake={end:0,count:0};
const cookie=(name,value,age)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
function cookies(request){return Object.fromEntries((request.headers.get('cookie')||'').split(';').map(p=>p.trim().split('=')));}
function optedOut(request){return request.headers.get('sec-gpc')==='1'||request.headers.get('dnt')==='1';}
export function normalizeAttribution(body){
 const landing=safeLanding(body.landing);if(!landing)return null;
 // Slugs only; never store raw URLs, free text, emails, click IDs or query strings.
 const slug=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(v)?v.toLowerCase():null;
 const source=slug(body.utm_source),medium=slug(body.utm_medium),campaign=slug(body.utm_campaign);
 let host='';try{const u=new URL(body.referrer);if(['https:','http:'].includes(u.protocol))host=u.hostname;}catch{}
 let channel=referrerSource(host);
 if(source){
  channel=/^(facebook|fb|meta|instagram)$/.test(source)?'Facebook':/^(linkedin|lnkd)$/.test(source)?'LinkedIn':source==='google'&&medium==='organic'?'Google organic': 'Campaign / other';
 }
 if(/^(cpc|ppc|paid|paid_social|paid-social|display|cpm)$/.test(medium||''))channel='Paid campaigns';
 return {landing,source,medium,campaign,channel};
}
export async function trafficRpc(env,name,body,{request=fetch}={}){
 if(!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Tracking not configured');
 const r=await request(new URL('/rest/v1/rpc/'+name,env.SUPABASE_URL),{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(2500)});
 if(!r.ok)throw Error('Tracking unavailable');return r.json();
}
export async function trafficEndpoint(request,env,{call=trafficRpc}={}){
 const h=new Headers({'Cache-Control':'no-store','Content-Type':'application/json','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff'});
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:h});
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 const url=new URL(request.url);
 if(request.headers.get('origin')!==url.origin||request.headers.get('content-type')!=='application/json')return reply({error:'Forbidden'},403);
 if(intake.end<Date.now())intake={end:Date.now()+60000,count:0};
 if(++intake.count>300||(request.cf?.botManagement?.score!==undefined&&request.cf.botManagement.score<30))return reply({error:'Please wait'},429);
 if(Number(request.headers.get('content-length'))>2048)return reply({error:'Too large'},413);
 let b;try{const raw=await request.text();if(raw.length>2048)return reply({error:'Too large'},413);b=JSON.parse(raw);}catch{return reply({error:'Invalid request'},400);}
 const c=cookies(request);
 if(b?.consent===false||optedOut(request)){
  h.append('Set-Cookie',cookie('veeays_traffic','',0));h.append('Set-Cookie',cookie('veeays_analytics','',0));
  if(UUID.test(c.veeays_traffic||''))try{await call(env,'veeays_traffic_forget',{p_id:c.veeays_traffic});}catch{}
  return reply({recorded:false});
 }
 if(b?.consent!==true||!UUID.test(b.id||''))return reply({error:'Consent required'},400);
 let landing;try{const referer=new URL(request.headers.get('referer'));if(referer.origin!==url.origin||!safeLanding(referer.pathname))return reply({error:'Public page required'},400);landing=referer.pathname;}catch{return reply({error:'Public page required'},400);}
 const a=normalizeAttribution(b);if(!a)return reply({error:'Invalid landing'},400);
 // Isolate-local abuse bound; no IP or fingerprint. Database PK deduplicates tabs/retries.
 if(env.TRAFFIC_API_LIMITER){const l=await env.TRAFFIC_API_LIMITER.limit({key:b.id});if(!l.success)return reply({error:'Please wait'},429);}
 try{
  const result=await call(env,'veeays_traffic_record',{p_id:b.id,p_landing:a.landing,p_source:a.source,p_medium:a.medium,p_campaign:a.campaign,p_channel:a.channel});
  if(result!==true)return reply({recorded:false,reason:'expired_session'},409);
  h.append('Set-Cookie',cookie('veeays_traffic',b.id,1800));h.append('Set-Cookie',cookie('veeays_analytics','yes',1800));
  return reply({recorded:true});
 }catch{return reply({recorded:false,reason:'unavailable'},503);}
}
export async function linkTrafficRegistration(request,env,user,{call=trafficRpc}={}){
 const c=cookies(request);
 if(optedOut(request)||c.veeays_analytics!=='yes'||!UUID.test(c.veeays_traffic||'')||!UUID.test(user?.id||'')||!Array.isArray(user.identities)||!user.identities.length)return;
 try{await call(env,'veeays_traffic_register',{p_id:c.veeays_traffic,p_user:user.id});}catch{/* Attribution must never fail signup. */}
}
