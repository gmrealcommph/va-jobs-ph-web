// Evidence only. This module cannot change visibility or write to the database.
const hosts = new Set(['api.ashbyhq.com','jobs.ashbyhq.com','boards-api.greenhouse.io','job-boards.greenhouse.io','boards.greenhouse.io','api.lever.co','jobs.lever.co','www.workable.com','apply.workable.com','himalayas.app']);
export function allowedURL(value) {
  try { const u=new URL(value); return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hosts.has(u.hostname) ? u : null; } catch { return null; }
}
export async function readSource(value, fetcher=fetch) {
  let url=allowedURL(value);
  if(!url) return {ok:false,reason:'unsupported_url'};
  try {
    for(let redirects=0;redirects<4;redirects++) {
      const r=await fetcher(url.href,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json,text/html','User-Agent':'VeeAys-JobHealth/1.0'}});
      if([301,302,303,307,308].includes(r.status)) { url=allowedURL(new URL(r.headers.get('location'),url).href); if(!url)return {ok:false,reason:'unsupported_redirect'}; continue; }
      if(!r.ok)return {ok:false,status:r.status,reason:[404,410].includes(r.status)?'link_unavailable':'source_unavailable'};
      const reader=r.body.getReader(); let bytes=0,parts=[];
      while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>4000000){await reader.cancel();return {ok:false,reason:'response_too_large'};}parts.push(value);}
      const data=new Uint8Array(bytes);let at=0;for(const p of parts){data.set(p,at);at+=p.length;}
      const text=new TextDecoder().decode(data);
      if(/cf-chl-|<title>\s*(?:Just a moment|Attention Required)|<h1>\s*Verify you are human/i.test(text))return {ok:false,status:r.status,reason:'source_challenge'};
      return {ok:true,status:r.status,url:url.href,text};
    }
    return {ok:false,reason:'redirect_limit'};
  }catch{return {ok:false,reason:'source_unavailable'};}
}
export function boardURL(job) {
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(job.source_board||'')) return null;
  const b=job.source_board;
  if(job.source==='lever')return /^[a-f0-9-]{36}$/i.test(job.source_job_id)?`https://api.lever.co/v0/postings/${b}/${job.source_job_id}?mode=json`:null;
  return ({ashby:`https://api.ashbyhq.com/posting-api/job-board/${b}`,greenhouse:`https://boards-api.greenhouse.io/v1/boards/${b}/jobs`,workable:`https://www.workable.com/api/accounts/${b}?details=true`})[job.source]||null;
}
export function sourceEvidence(job,response,now=new Date()) {
  const unknown=reason=>({status:'unknown',reason,original_posted_at:null,date_provenance:'unknown'});
  if(!response?.ok) return unknown(response?.reason||'unsupported_source');
  if(job.source==='himalayas')return unknown('aggregator_requires_employer_verification');
  let body;try{body=JSON.parse(response.text);}catch{return unknown('invalid_source_response');}
  const list=job.source==='lever'?(body?.id?[body]:body):body?.jobs;
  if(!Array.isArray(list)||!list.length||list.some(x=>!x||typeof x!=='object'))return unknown('empty_or_invalid_board');
  // A board absence is a review signal, never a closed finding on one sweep.
  const match=list.find(x=>String(x.id??x.shortcode)===String(job.source_job_id));
  if(!match)return unknown('not_found_in_board');
  if(['closed','archived','draft','unpublished','filled','inactive'].includes(String(match.state||match.status||'').toLowerCase()))return unknown('source_not_explicitly_open');
  const apply=match.applyUrl||match.application_url||match.absolute_url||match.url||match.jobUrl||match.hostedUrl;
  if(job.source==='ashby'&&match.isListed!==true)return unknown('not_explicitly_listed');
  if(!allowedURL(apply))return unknown('no_supported_application_url');
  const stamp=job.source==='ashby'?match.publishedAt:job.source==='workable'?match.published_at:null;
  const valid=stamp&&Number.isFinite(Date.parse(stamp))&&Date.parse(stamp)<=now.getTime();
  return {status:'open',reason:'exact_id_in_public_employer_board',application_url:apply,original_posted_at:null,source_published_at:valid?new Date(stamp).toISOString():null,date_provenance:valid?'employer_last_published':job.source==='greenhouse'?'updated_date_not_original':job.source==='workable'?'creation_date_not_original':'not_supplied'};
}
export function sourceReader(fetcher=fetch,maxRequests=32) {
  const cache=new Map(),blocked=new Set();let requests=0;
  const boundedFetch=async(...args)=>{if(requests++>=maxRequests)throw Error('request_budget_exhausted');return fetcher(...args);};
  return async value=>{
    const u=allowedURL(value);if(!u)return {ok:false,reason:'unsupported_url'};
    if(blocked.has(u.hostname))return {ok:false,status:429,reason:'source_rate_limited'};
    if(requests>=maxRequests)return {ok:false,reason:'request_budget_exhausted'};
    if(!cache.has(u.href))cache.set(u.href,readSource(u.href,boundedFetch).then(result=>{if(result.status===429)blocked.add(u.hostname);return result;}));
    return cache.get(u.href);
  };
}
export async function verifyListing(job,read=sourceReader(),now=new Date()) {
  const url=boardURL(job),board=url?await read(url):null;
  const evidence=sourceEvidence(job,board,now),source_status=evidence.status;
  const link=await read(evidence.application_url||job.job_url);
  const original=await read(job.job_url);
  if(evidence.status==='open'&&!link.ok){evidence.status='unknown';evidence.reason='application_link_not_verified';}
  if(evidence.status==='open'&&!original.ok){evidence.status='unknown';evidence.reason='original_link_not_verified';}
  if(job.source==='himalayas')evidence.reason='aggregator_requires_employer_verification';
  return {...job,checked_at:now.toISOString(),evidence,source_status,source_evidence_url:url,
    source_check:{status:board?.status||null,reason:board?.ok?'exact_id_required':board?.reason||'unsupported_source'},
    original_application_check:{reachable:original.ok,status:original.status||null,reason:original.ok?'http_success_only':original.reason},
    application_check:{reachable:link.ok,status:link.status||null,reason:link.ok?'http_success_only':link.reason},decision:reviewDecision(job,evidence,now)};
}
export function reviewDecision(job,evidence,now=new Date()) {
  const date=evidence?.original_posted_at||job.original_posted_at;
  const age=date&&Number.isFinite(Date.parse(date))?Math.floor((now-Date.parse(date))/86400000):null;
  return {automatic_hiding_enabled:false,would_hide:false,age_days:age,review_reason:age===null?'missing_original_date':age<0?'future_date':age>45?(evidence?.status==='open'?'older_but_open':'over_45_needs_verification'):age>=31?'aging':'recent'};
}
