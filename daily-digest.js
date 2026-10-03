import { configuration, rest, one } from './notifications.js';

export const DIGEST_CRON='* * * * *';
const DAY=86400000, RETRY_WINDOW=23*3600000;
class Review extends Error {}
const rpc=(config,name,body)=>rest(config,`rpc/${name}`,{}, {method:'POST',body:JSON.stringify(body)});
const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function digestWindow(scheduledTime) {
  if (!Number.isFinite(scheduledTime)) throw new Error('Invalid scheduled time');
  const end=new Date(Math.floor(scheduledTime/DAY)*DAY);
  return {end:end.toISOString(),day:new Date(end.getTime()+8*3600000).toISOString().slice(0,10)};
}

export function digestMessage(config,items,person,day) {
  const greeting=person.profile.full_name ? `Hi ${person.profile.full_name},` : 'Hello,';
  const cards=items.map(j=>{
    const title=String(j.title || 'Job opportunity').replace(/[\r\n]/g,' ').slice(0,200);
    const link=`${config.site}/jobs/${encodeURIComponent(j.job_id)}`;
    const score=Number.isInteger(j.match_score) && j.match_score>=0 && j.match_score<=100 ? `${j.match_score}% match` : '';
    const amount=v=>Number.isFinite(v) && v>=0 ? v.toLocaleString('en-US') : '';
    const min=amount(j.salary_min_usd),max=amount(j.salary_max_usd);
    const period={monthly:'month',yearly:'year',annually:'year',hourly:'hour',weekly:'week'}[j.salary_period];
    const salary=period && (min || max) ? `${min ? '$'+min : 'Up to $'+max}${min && max && min!==max ? '–$'+max : ''}/${period}` : '';
    const types={full_time:'Full-time',part_time:'Part-time',contract:'Contract',freelance:'Freelance',internship:'Internship'};
    const meta=[j.location,types[j.employment_type] || j.employment_type?.replaceAll('_',' '),salary,j.schedule_region].filter(Boolean).join(' · ');
    return {text:[score,title,j.company,meta,`View job: ${link}`].filter(Boolean).join('\n'),
      html:`<tr><td style="padding:18px 0"><table role="presentation" width="100%" cellpadding="20" style="background:#f1f6f0;border:1px solid #d6e2d4;border-radius:12px"><tr><td><span style="background:#d6ebcc;color:#20452d;border-radius:20px;padding:6px 12px;font-size:13px;font-weight:bold">${esc(score)}</span><h2 style="font-size:22px;margin:16px 0 8px">${esc(title)}</h2><p style="margin:8px 0;font-weight:bold">${esc(j.company)}</p><p style="color:#506354;font-size:14px;line-height:1.7">${esc(meta)}</p><p style="margin:24px 0 10px"><a href="${esc(link)}" style="background:#163f2c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">View job →</a></p></td></tr></table></td></tr>`};
  });
  const explanation='You received this because Daily Job Digest is enabled for your VeeAys Pro account.';
  const preferences=`${config.site}/email-preferences`;
  return {from:'VeeAys Jobs <jobs@veeays.com>',to:[person.email],
    subject:`Your VeeAys daily digest: ${items.length} new ${items.length===1 ? 'match' : 'matches'} — ${day}`,
    text:[greeting,'Your best new matches from the previous 24 hours.',...cards.map(c=>c.text),
      `My Matches: ${config.site}/matches`,explanation,`Manage email preferences: ${preferences}`].join('\n\n'),
    html:`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f6f4ef;color:#162c24;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0"><tr><td style="padding:24px 12px"><table role="presentation" align="center" width="100%" cellpadding="24" style="max-width:580px;background:#fff;border-radius:16px"><tr><td><a href="${esc(config.site)}"><img src="${esc(config.site)}/veeays-logo.png" alt="VeeAys" width="150" style="max-width:150px;height:auto;border:0"></a><p style="font-size:12px;letter-spacing:2px;color:#58705c">DAILY JOB DIGEST</p><p>${esc(greeting)}</p><p>Here are your best new matches from the previous 24 hours.</p><table role="presentation" width="100%" cellpadding="0">${cards.map(c=>c.html).join('')}</table><p><a href="${esc(config.site)}/matches" style="color:#24704b">View My Matches</a></p><p style="font-size:12px;color:#647469;line-height:1.7">${explanation}<br><a href="${esc(preferences)}" style="color:#24704b">Manage email preferences</a></p></td></tr></table></td></tr></table></body></html>`};
}

async function verifyPersonAndPublicJobs(config,userId,person) {
  if (!person || !Array.isArray(person.items) || !person.items.length || person.items.length>10)
    throw new Review('invalid_digest_items');
  const ids=person.items.map(j=>j.job_id);
  if (ids.some(id=>typeof id!=='string' || !/^[1-9]\d{0,18}$/.test(id)) || new Set(ids).size!==ids.length)
    throw new Review('invalid_job_ids');
  if (typeof person.email!=='string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email))
    throw new Review('invalid_auth_email');
  // The public board is read with the publishable key, preventing service-role visibility bypass.
  const jobs=await rest({...config,key:config.publicKey,modernKey:true},'public_jobs',{
    id:`in.(${ids.join(',')})`,select:'id',limit:'10'});
  if (!Array.isArray(jobs) || jobs.length!==ids.length ||
    ids.some(id=>!jobs.some(j=>String(j.id)===id))) throw new Review('job_no_longer_public');
  const response=await fetch(new URL(`/auth/v1/admin/users/${userId}`,config.url),{
    headers:{apikey:config.key,...(!config.modernKey ? {Authorization:`Bearer ${config.key}`} : {})},
    signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('auth_read_failed');
  const user=await response.json();
  if (user?.id!==userId || !user.email_confirmed_at || user.deleted_at ||
    (user.banned_until && (!Number.isFinite(Date.parse(user.banned_until)) || Date.parse(user.banned_until)>Date.now())) ||
    typeof user.email!=='string' || user.email.trim().toLowerCase()!==person.email)
    throw new Review('auth_recipient_changed');
  return person;
}

async function checked(config,delivery,args) {
  const person=await rpc(config,'check_daily_digest',args);
  if (person?.error) throw new Review(person.error);
  return verifyPersonAndPublicJobs(config,delivery.user_id,person);
}

// Read-only live preflight. No ledger, freezing, attempt, acknowledgement, or provider calls.
export async function previewDailyDigest(env,userId,scheduledTime) {
  if (env.DAILY_DIGEST_MODE==='enabled') throw new Error('Disable digest for preflight');
  if (typeof userId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))
    throw new Review('invalid_user_id');
  const config=configuration(env,true);
  if (!env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) throw new Error('Publishable key required');
  config.publicKey=env.SUPABASE_PUBLISHABLE_KEY;
  const window=digestWindow(scheduledTime);
  const profile=await one(config,'profiles',{id:`eq.${userId}`});
  const preferences=await one(config,'job_preferences',{user_id:`eq.${userId}`});
  const expiry=profile?.pro_expires_at===null ? Infinity : Date.parse(profile?.pro_expires_at);
  if (profile?.plan!=='pro' || profile.plan_status!=='active' || !(expiry>Date.now()) || preferences?.daily_digest!==true)
    return {status:'recipient_not_eligible',window_end:window.end,count:0};
  const items=await rpc(config,'daily_digest_matches',{p_user_id:userId,p_window_end:window.end});
  if (!Array.isArray(items)) throw new Error('Invalid matching response');
  // Check Auth even if the window has no matches; public-board access is verified by an empty query.
  const response=await fetch(new URL(`/auth/v1/admin/users/${userId}`,config.url),{
    headers:{apikey:config.key,...(!config.modernKey ? {Authorization:`Bearer ${config.key}`} : {})},signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('auth_read_failed');
  const user=await response.json();
  if (!items.length) {
    if (user.id!==userId || !user.email_confirmed_at || user.deleted_at ||
      (user.banned_until && (!Number.isFinite(Date.parse(user.banned_until)) || Date.parse(user.banned_until)>Date.now())) ||
      typeof user.email!=='string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email.trim())) throw new Review('invalid_auth_email');
    await rest({...config,key:config.publicKey,modernKey:true},'public_jobs',{select:'id',limit:'1'});
    return {status:'no_new_matches',window_end:window.end,count:0};
  }
  await verifyPersonAndPublicJobs(config,userId,{profile,email:String(user.email || '').trim().toLowerCase(),items});
  return {status:'ready',window_end:window.end,count:items.length};
}

export async function processDigest(env,config,delivery,token) {
  const args={p_id:delivery.id,p_token:token};
  try {
    if (delivery.first_attempt_at && (!Number.isFinite(Date.parse(delivery.first_attempt_at)) ||
      Date.now()-Date.parse(delivery.first_attempt_at)>=RETRY_WINDOW)) throw new Review('idempotency_window_expired');
    let person=await checked(config,delivery,args);
    const payload=delivery.payload || await rpc(config,'freeze_daily_digest',{
      ...args,p_payload:digestMessage(config,person.items,person,delivery.digest_day)});
    // Track the frozen state immediately so failures after freezing are held, never skipped.
    delivery.payload=payload;
    person=await checked(config,delivery,args);
    if (payload.to?.length!==1 || payload.to[0]!==person.email) throw new Review('recipient_changed');
    const started=await rpc(config,'start_daily_digest_attempt',args);
    if (!Number.isFinite(Date.parse(started)) || Date.now()-Date.parse(started)>=RETRY_WINDOW)
      throw new Review('idempotency_window_expired');
    delivery.first_attempt_at=started;
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{
      Authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json',
      'Idempotency-Key':`veeays-digest-${config.url.hostname}-${delivery.user_id}-${delivery.digest_day}`},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
    if (!response.ok) {
      if (response.status===429 || response.status>=500 || response.status===409) throw new Error('provider_retry');
      throw new Review(`provider_rejected_${response.status}`);
    }
    const result=await response.json();
    if (typeof result?.id!=='string' || !result.id) throw new Error('unknown_provider_result');
    if (await rpc(config,'accept_daily_digest',{...args,p_resend_id:result.id})!==true)
      throw new Error('receipt_not_committed');
    return 'accepted';
  } catch (error) {
    const status=error instanceof Review ? (delivery.first_attempt_at || delivery.payload ? 'held' : 'skipped') : 'retry';
    await rpc(config,'defer_daily_digest',{...args,p_status:status,
      p_error:error instanceof Review ? error.message : 'transient_or_unknown_outcome'});
    return status;
  }
}

export async function runDailyDigest(env,scheduledTime) {
  if (env.DAILY_DIGEST_MODE!=='enabled') return {status:'disabled'};
  const start=Date.parse(env.DAILY_DIGEST_START_AT);
  if (!Number.isFinite(start) || start%DAY!==0) throw new Error('Digest start must be a UTC midnight');
  const window=digestWindow(scheduledTime);
  if (Date.parse(window.end)<start) return {status:'before_activation'};
  const config=configuration(env,true);
  if (!env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) throw new Error('Publishable key required');
  config.publicKey=env.SUPABASE_PUBLISHABLE_KEY;
  const summary={accepted:0,retry:0,held:0,skipped:0};
  const max=/^[1-3]$/.test(String(env.DAILY_DIGEST_MAX_USERS || '')) ? Number(env.DAILY_DIGEST_MAX_USERS) : 3;
  for (let i=0;i<max;i++) {
    const token=crypto.randomUUID();
    const rows=await rpc(config,'claim_daily_digest',{
      p_token:token,p_window_end:window.end,p_start_at:new Date(start).toISOString()});
    if (!Array.isArray(rows) || rows.length>1) throw new Error('Invalid digest claim');
    if (!rows.length) break;
    summary[await processDigest(env,config,rows[0],token)]++;
  }
  return summary;
}

export async function scheduledDailyDigest(controller,env) {
  if (controller.cron!==DIGEST_CRON) return;
  console.log('daily_digest_run',JSON.stringify(await runDailyDigest(env,controller.scheduledTime)));
}
