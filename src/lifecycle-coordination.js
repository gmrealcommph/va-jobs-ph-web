// Shared per-member reservation, used immediately before each existing sender's attempt boundary.
// Absent flag leaves current production behavior unchanged.
export async function reserveMemberEmailGap(env,userId,source,deliveryId,{request=fetch}={}) {
 if(env.LIFECYCLE_COORDINATION_ENABLED!=='true')return true;
 if(!['daily_digest','strong_match','job_alert','manual'].includes(source)||typeof userId!=='string'||!userId||typeof deliveryId!=='string'||!deliveryId)throw Error('email_gap_invalid');
 const db=new URL(env.SUPABASE_URL),key=env.SUPABASE_SERVICE_ROLE_KEY;
 if(db.protocol!=='https:'||db.username||db.password||db.port||db.pathname!=='/'||db.search||db.hash||!db.hostname.endsWith('.supabase.co')||!/^(sb_secret_|eyJ)/.test(key||''))throw Error('email_gap_configuration');
 const r=await request.call(globalThis,new URL('/rest/v1/rpc/reserve_member_email_gap',db),{method:'POST',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{apikey:key,...(key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key}),'content-type':'application/json'},body:JSON.stringify({p_user:userId,p_key:source+':'+deliveryId,p_kind:'legacy'})});
 if(!r.ok||await r.json()!==true)throw Error('email_gap_deferred');
 return true;
}
