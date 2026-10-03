import { configuration, rest, one, recipient } from './notifications.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const WINDOW = 23 * 3600000;
class Review extends Error {}
const rpc = (config, name, body) => rest(config, `rpc/${name}`, {}, { method:'POST', body:JSON.stringify(body) });

export function batchMessage(config, matches, person) {
  const preferences = `${config.site}/email-preferences`;
  const cards = matches.map(({ notification:n, job:j }) => {
    const title = String(j.title || 'Job opportunity').replace(/[\r\n]/g,' ').slice(0,200);
    const types = {'full time':'Full-time','part time':'Part-time','contract':'Contract','freelance':'Freelance','internship':'Internship'};
    const rawType = String(j.employment_type || '').replace(/[_-]/g,' ').toLowerCase().trim();
    const type = types[rawType] || (rawType ? rawType[0].toUpperCase()+rawType.slice(1) : '');
    const amount = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x.toLocaleString('en-US') : '';
    const min=amount(j.salary_min_usd), max=amount(j.salary_max_usd);
    const period={monthly:'month',yearly:'year',annually:'year',hourly:'hour',weekly:'week'}[j.salary_period];
    const salary = period && (min || max) ? `${min ? '$'+min : 'Up to $'+max}${min && max && min!==max ? '–$'+max : ''}/${period}` : '';
    const meta=[j.location,type,salary,j.schedule_region].filter(x=>typeof x==='string' && x.trim()).join(' · ');
    const score=typeof n.match_score==='number' && Number.isFinite(n.match_score) && n.match_score>=0 && n.match_score<=100 ? `${n.match_score}% match` : '';
    const link=`${config.site}/jobs/${encodeURIComponent(j.id)}`;
    return {title,text:[score,title,j.company,meta,`View job: ${link}`].filter(Boolean).join('\n'),
      html:`<tr><td style="padding:18px 0"><table role="presentation" width="100%" cellpadding="20" style="background:#f1f6f0;border:1px solid #d6e2d4;border-radius:12px"><tr><td>${score ? `<span style="background:#d6ebcc;color:#20452d;border-radius:20px;padding:6px 12px;font-size:13px;font-weight:bold">${esc(score)}</span>` : ''}<h2 style="font-size:22px;margin:16px 0 8px">${esc(title)}</h2>${j.company ? `<p style="margin:8px 0;font-weight:bold">${esc(j.company)}</p>` : ''}<p style="color:#506354;font-size:14px;line-height:1.7">${esc(meta)}</p><p style="margin:24px 0 10px"><a href="${esc(link)}" style="background:#163f2c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">View job →</a></p></td></tr></table></td></tr>`};
  });
  const greeting=person.profile.full_name ? `Hi ${person.profile.full_name},` : 'Hello,';
  return {from:'VeeAys Jobs <jobs@veeays.com>',to:[person.email],
    subject:cards.length===1 ? `Your VeeAys strong match: ${cards[0].title}` : `${cards.length} new strong matches on VeeAys`,
    text:[greeting,'Your new strong matches on VeeAys.',...cards.map(c=>c.text),`My Matches: ${config.site}/matches`,
      'You received this because Strong Match Alerts are enabled for your VeeAys Pro account.',`Manage email preferences: ${preferences}`].join('\n\n'),
    html:`<!doctype html><html><body style="margin:0;background:#f6f4ef;color:#162c24;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0"><tr><td style="padding:24px 12px"><table role="presentation" align="center" width="100%" cellpadding="24" style="max-width:580px;background:#fff;border-radius:16px"><tr><td><a href="${esc(config.site)}"><img src="${esc(config.site)}/veeays-logo.png" alt="VeeAys" width="150" style="max-width:150px;height:auto;border:0"></a><p style="font-size:12px;letter-spacing:2px;color:#58705c">STRONG MATCH ALERT</p><p>${esc(greeting)}</p><p>Here are your new strong matches.</p><table role="presentation" width="100%" cellpadding="0">${cards.map(c=>c.html).join('')}</table><p><a href="${esc(config.site)}/matches" style="color:#24704b">View My Matches</a></p><p style="font-size:12px;color:#647469;line-height:1.7">You received this because Strong Match Alerts are enabled for your VeeAys Pro account.<br><a href="${esc(preferences)}" style="color:#24704b">Manage email preferences</a></p></td></tr></table></td></tr></table></body></html>`};
}

async function checkedMatches(config, batch, items) {
  if (!items.length || items.length>5) throw new Review('invalid_batch_items');
  const matches=[];
  for (const item of items) {
    if (!/^\d+$/.test(item.notification_id) || !/^\d+$/.test(item.job_id)) throw new Review('invalid_item_id');
    const n=await one(config,'job_match_notifications',{id:`eq.${item.notification_id}`});
    if (!n || n.user_id!==batch.user_id || String(n.job_id)!==item.job_id ||
      n.notification_type!=='strong_match' || n.notified_at || n.match_score!==item.match_score)
      throw new Review('notification_changed');
    // Use the publishable key for the public view as the board does, preventing service-role bypass.
    const j=await one({...config,key:config.publicKey,modernKey:true},'public_jobs',{id:`eq.${item.job_id}`});
    if (!j) throw new Review('job_no_longer_public');
    const detail=await one(config,'jobs',{id:`eq.${item.job_id}`});
    if (!detail) throw new Review('job_data_missing');
    // Public view is the existing board's availability contract. Explicit inactive flags fail closed too.
    if (detail.is_active===false || detail.active===false ||
      (detail.status && !['active','published','open'].includes(detail.status))) throw new Review('job_inactive');
    matches.push({notification:n,job:{...detail,...j}});
  }
  return matches;
}

export async function processBatch(env, config, batch, token) {
  const args={p_id:batch.id,p_token:token};
  try {
    if (batch.first_attempt_at && (!Number.isFinite(Date.parse(batch.first_attempt_at)) ||
      Date.now()-Date.parse(batch.first_attempt_at)>=WINDOW)) throw new Review('idempotency_window_expired');
    const items=await rest(config,'strong_match_batch_items',{batch_id:`eq.${batch.id}`,select:'*',order:'notification_id.asc'});
    let person=await recipient(config,batch.user_id);
    let matches=await checkedMatches(config,batch,items);
    const payload=batch.payload || await rpc(config,'freeze_strong_match_batch',{
      ...args,p_payload:batchMessage(config,matches,person)});
    if (payload.to?.length!==1 || payload.to[0]!==person.email) throw new Review('recipient_changed');
    // Recheck after the durable freeze, immediately before the attempt boundary.
    matches=await checkedMatches(config,batch,items);
    person=await recipient(config,batch.user_id);
    if (person.email!==payload.to[0]) throw new Review('recipient_changed');
    const started=await rpc(config,'start_strong_match_attempt',args);
    if (!Number.isFinite(Date.parse(started)) || Date.now()-Date.parse(started)>=WINDOW) throw new Review('idempotency_window_expired');
    // Keep the in-memory attempt state aligned with the durable boundary for error handling.
    batch.first_attempt_at=started;
    batch.payload=payload;
    const response=await fetch('https://api.resend.com/emails',{method:'POST',
      headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json',
        'Idempotency-Key':`veeays-strong-batch-${config.url.hostname}-${batch.id}`},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
    // Rate limits, server errors and network/invalid-response outcomes retry the same frozen request.
    if (!response.ok) {
      if (response.status===429 || response.status>=500 || response.status===409) throw new Error('provider_retry');
      throw new Review(`provider_rejected_${response.status}`);
    }
    const result=await response.json();
    if (typeof result?.id!=='string' || !result.id) throw new Error('unknown_provider_result');
    if (await rpc(config,'accept_strong_match_batch',{...args,p_resend_id:result.id})!==true) throw new Error('receipt_not_committed');
    return 'accepted';
  } catch (error) {
    const eligibilityFailure=['recipient_not_eligible','recipient_not_confirmed_test_address','email_preference_schema_unverified'].includes(error.message);
    const status=error instanceof Review || eligibilityFailure ? (batch.first_attempt_at || batch.payload ? 'held' : 'skipped') : 'retry';
    // Do not include upstream bodies, addresses, tokens or raw exceptions in logs/ledger.
    const code=error instanceof Review || eligibilityFailure ? error.message : 'transient_or_unknown_outcome';
    await rpc(config,'defer_strong_match_batch',{...args,p_status:status,p_error:code});
    return status;
  }
}

export async function runStrongMatches(env) {
  // No HTTP send endpoint. Both explicit mode and reviewed backlog cutoff are required.
  if (env.STRONG_MATCH_MODE!=='enabled') return {status:'disabled'};
  if (!env.STRONG_MATCH_START_AT || !Number.isFinite(Date.parse(env.STRONG_MATCH_START_AT))) throw new Error('Strong Match cutoff required');
  const config=configuration(env,true);
  if (!env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) throw new Error('Publishable key required');
  config.publicKey=env.SUPABASE_PUBLISHABLE_KEY;
  const summary={accepted:0,retry:0,held:0,skipped:0};
  // Default one batch stays below the Free plan's 50 external subrequests.
  // Operators on a suitable paid plan can explicitly increase to at most three.
  const maxBatches=/^[1-3]$/.test(String(env.STRONG_MATCH_MAX_BATCHES || '')) ? Number(env.STRONG_MATCH_MAX_BATCHES) : 1;
  const deadline=Date.now()+240000;
  for (let i=0;i<maxBatches && Date.now()<deadline;i++) {
    const token=crypto.randomUUID();
    // The SQL claim filters/orders notification discovered_at; batch timestamps govern retries/cooldown.
    const rows=await rpc(config,'claim_strong_match_batch',{p_token:token,p_cutoff:new Date(env.STRONG_MATCH_START_AT).toISOString()});
    if (!Array.isArray(rows) || rows.length>1) throw new Error('Invalid claim result');
    if (!rows.length) break;
    summary[await processBatch(env,config,rows[0],token)]++;
  }
  return summary;
}

export async function scheduledStrongMatches(controller,env) {
  if (controller.cron!=='*/15 * * * *') return;
  const summary=await runStrongMatches(env);
  console.log('strong_match_run',JSON.stringify(summary));
}
