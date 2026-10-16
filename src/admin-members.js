import {sessionForRequest,setSessionCookies,clearSessionCookies,signIn,authFetch} from './auth.js';
import {config} from './data.js';
import {closeDeletionCheckout} from './account-deletion.js';

async function rpc(env,token,name,body,service=false){
 const {url,key}=config(env),secret=service?env.SUPABASE_SERVICE_ROLE_KEY:token;
 if(!secret)throw Error('Unavailable');
 const response=await fetch(new URL('/rest/v1/rpc/'+name,url),{method:'POST',headers:{apikey:service?secret:key,...(!service||secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Object.assign(Error('Unavailable'),{status:response.status});
 return response.json();
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const attempts=new Map();
export async function adminMembersEndpoint(request,env,{session=sessionForRequest,call=rpc,verify=signIn,close=closeDeletionCheckout,logout=authFetch}={}){
 const headers=new Headers({'cache-control':'private, no-store','vary':'Cookie','content-type':'application/json','x-content-type-options':'nosniff'});
 const reply=(body,status=200)=>Response.json(body,{status,headers});
 if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed'},405);
 let freshToken;
 try{
  const state=await session(request,env);
  if(state.refreshed&&typeof state.refreshed==='object')setSessionCookies(headers,state.refreshed);
  else if(state.refreshed===false)clearSessionCookies(headers);
  if(!state.user||!state.accessToken)return reply({error:'Please sign in again.'},401);
  if(await call(env,state.accessToken,'veeays_admin_access',{})!==true)return reply({error:'Admin access required.'},403);
  const url=new URL(request.url);
  if(request.method==='GET'){
   const id=url.searchParams.get('id');
   if(id&&!uuid.test(id))return reply({error:'Invalid member'},400);
   const result=await call(env,state.accessToken,'veeays_admin_members',{p_query:(url.searchParams.get('q')||'').slice(0,100),p_filter:url.searchParams.get('filter')||'all',p_offset:Math.floor(Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0))),p_id:id||null});
   if(id){const token=crypto.randomUUID();headers.append('set-cookie',`__Host-veeays_member=${state.user.id}.${id}.${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=300`);result.token=token;}
   result.actions_enabled=env.ADMIN_MEMBER_ACTIONS_ENABLED==='true';
   return reply(result);
  }
  // Disabled by default; deployment approval must explicitly enable actions.
  if(env.ADMIN_MEMBER_ACTIONS_ENABLED!=='true')return reply({error:'Member actions await activation approval.'},409);
  if(request.headers.get('origin')!==url.origin||url.origin!==new URL(env.SITE_URL).origin)return reply({error:'Forbidden'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Invalid request'},400);
  const raw=await request.text();if(raw.length>4096)return reply({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw);}catch{return reply({error:'Invalid request'},400);}
  const {id,action,token,password,confirm,reason}=body;
  const cookie=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-veeays_member='))?.slice('__Host-veeays_member='.length);
  if(!uuid.test(id||'')||!uuid.test(token||'')||cookie!==`${state.user.id}.${id}.${token}`||!['suspend','reactivate','delete'].includes(action)||confirm!==`${action.toUpperCase()} ${id}`||typeof reason!=='string'||reason.trim().length<5||reason.length>500||typeof password!=='string'||!password||password.length>128)return reply({error:'Reopen member details and complete the confirmation.'},400);
  if(id===state.user.id||state.user.factors?.some(f=>f.status==='verified'))return reply({error:'Protected account or additional verification required.'},409);
  for(const [key,value] of attempts)if(value.until<Date.now())attempts.delete(key);
  const limit=attempts.get(state.user.id)||{count:0,until:Date.now()+60000};
  if(++limit.count>5||attempts.size>500)return reply({error:'Please wait before retrying.'},429);attempts.set(state.user.id,limit);
  if(env.ADMIN_API_LIMITER&&!(await env.ADMIN_API_LIMITER.limit({key:'member-actions:'+state.user.id})).success)return reply({error:'Please wait before retrying.'},429);
  const fresh=await verify(env,{email:state.user.email,password});freshToken=fresh.data?.access_token;
  if(!fresh.response.ok||fresh.data?.user?.id!==state.user.id||!freshToken)return reply({error:'Password could not be verified.'},403);
  if(await call(env,freshToken,'veeays_admin_access',{})!==true)return reply({error:'Admin access required.'},403);
  const args={p_actor:state.user.id,p_target:id,p_action:action,p_reason:reason.trim(),p_request:token};
  const prepared=await call(env,null,'veeays_admin_member_action',args,true);
  if(action==='delete'&&prepared.deleted!==true){
   for(const record of prepared.checkouts||[])await close(env,record);
   await call(env,null,'veeays_admin_member_action',{...args,p_action:'finish_delete'},true);
  }
  headers.append('set-cookie','__Host-veeays_member=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');
  return reply({ok:true});
 }catch(error){return reply({error:'Action not confirmed. Refresh member details before retrying; contact support if processing remains blocked.'},[401,403].includes(error.status)?error.status:503);}
 finally{if(freshToken)try{await logout(env,'/auth/v1/logout?scope=local',{method:'POST',headers:{Authorization:'Bearer '+freshToken}});}catch{}}
}
