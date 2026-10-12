const account='e3383856f0658ad90cee219395f6e91e';
const cache=new Map();
export function referrerSource(host){
  host=String(host||'').toLowerCase().replace(/\.$/,'');
  const domain=d=>host===d||host.endsWith('.'+d);
  if(!host||domain('veeays.com'))return 'Direct / unknown';
  if(domain('facebook.com')||domain('fb.com')||domain('fb.me'))return 'Facebook';
  if(domain('linkedin.com')||domain('lnkd.in'))return 'LinkedIn';
  if(/(^|\.)google\.(com|[a-z]{2}|(?:com|co)\.[a-z]{2})$/.test(host))return 'Google organic (inferred)';
  return 'Referrals';
}
// Called only after the existing server-side admin authorization succeeds.
export async function visitorAnalytics(env,dates,{request=fetch}={}){
  if(request===fetch){
    const key=(env.CLOUDFLARE_ANALYTICS_TOKEN||'none')+':'+dates.p_start+':'+dates.p_end;
    const found=cache.get(key);
    if(found&&found.expires>Date.now())return found.promise;
    for(const [k,v] of cache)if(v.expires<=Date.now())cache.delete(k);
    if(cache.size>=100)cache.clear();
    const promise=fetchVisitors(env,dates,{request});cache.set(key,{expires:Date.now()+300000,promise});return promise;
  }
  return fetchVisitors(env,dates,{request});
}
async function fetchVisitors(env,dates,{request}){
  if(!env.CLOUDFLARE_ANALYTICS_TOKEN)return {available:false,reason:'not_connected'};
  const headers={Authorization:'Bearer '+env.CLOUDFLARE_ANALYTICS_TOKEN,'content-type':'application/json'};
  try{
    const sitesResponse=await request('https://api.cloudflare.com/client/v4/accounts/'+account+'/rum/site_info/list?per_page=100',{headers,signal:AbortSignal.timeout(5000)});
    if(!sitesResponse.ok)return {available:false,reason:sitesResponse.status===403||sitesResponse.status===401?'access_denied':'provider_error'};
    const sites=await sitesResponse.json();
    if(!sites.success||!Array.isArray(sites.result))return {available:false,reason:'provider_error'};
    const matches=sites.result.filter(s=>s.ruleset?.zone_name==='veeays.com'&&/^[a-f0-9]{32}$/.test(s.site_tag||''));
    if(matches.length!==1)return {available:false,reason:'site_not_found'};
    const start=dates.p_start+'T00:00:00+08:00';
    const end=new Date(Date.parse(dates.p_end+'T00:00:00+08:00')+86400000).toISOString();
    const filter={datetime_geq:new Date(start).toISOString(),datetime_lt:end,siteTag:matches[0].site_tag,requestHost:'veeays.com',bot:0};
    const fields=Object.entries(filter).map(([key,value])=>key+':'+JSON.stringify(value)).join(',');
    const query='{viewer{accounts(filter:{accountTag:'+JSON.stringify(account)+'}){total:rumPageloadEventsAdaptiveGroups(limit:1,filter:{'+fields+'}){count sum{visits}}}}}';
    const response=await request('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers,body:JSON.stringify({query}),signal:AbortSignal.timeout(5000)});
    if(!response.ok)return {available:false,reason:'provider_error'};
    const payload=await response.json(),accounts=payload.data?.viewer?.accounts;
    if(payload.errors?.length||!Array.isArray(accounts)||accounts.length!==1||!Array.isArray(accounts[0].total))return {available:false,reason:'query_error'};
    const rows=accounts[0].total;
    if(rows.length>1)return {available:false,reason:'query_error'};
    const visits=rows.length?rows[0].sum?.visits:0,page_views=rows.length?rows[0].count:0;
    if(!Number.isFinite(visits)||visits<0||!Number.isFinite(page_views)||page_views<0)return {available:false,reason:'query_error'};
    const report={available:true,visits,page_views,source:'Cloudflare Web Analytics',fetched_at:new Date().toISOString()};
    // Separate query: unavailable dimensions must never invalidate valid totals.
    try{
      const q='{viewer{accounts(filter:{accountTag:'+JSON.stringify(account)+'}){referrers:rumPageloadEventsAdaptiveGroups(limit:1000,filter:{'+fields+'},orderBy:[sum_visits_DESC]){sum{visits} dimensions{refererHost}} landings:rumPageloadEventsAdaptiveGroups(limit:1000,filter:{'+fields+'},orderBy:[sum_visits_DESC]){sum{visits} dimensions{requestPath}}}}}';
      const r=await request('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers,body:JSON.stringify({query:q}),signal:AbortSignal.timeout(5000)});
      const p=await r.json(),a=p.data?.viewer?.accounts?.[0];
      if(!r.ok||p.errors?.length||!Array.isArray(a?.referrers)||!Array.isArray(a?.landings))throw Error('dimensions unavailable');
      const valid=rows=>rows.every(x=>Number.isFinite(x.sum?.visits)&&x.sum.visits>=0&&x.dimensions&&typeof Object.values(x.dimensions)[0]==='string');
      if(!valid(a.referrers)||!valid(a.landings))throw Error('invalid dimensions');
      const groups=new Map();for(const row of a.referrers){const source=referrerSource(row.dimensions.refererHost);groups.set(source,(groups.get(source)||0)+row.sum.visits);}
      const pages=new Map();for(const row of a.landings){const path=safeLanding(row.dimensions.requestPath);if(path)pages.set(path,(pages.get(path)||0)+row.sum.visits);}
      report.attribution={available:true,sources:[...groups].map(([source,visits])=>({source,visits})).sort((a,b)=>b.visits-a.visits),landings:[...pages].map(([path,visits])=>({path,visits})).sort((a,b)=>b.visits-a.visits).slice(0,20),truncated:a.referrers.length===1000||a.landings.length===1000,utm_available:false,conversions_available:false};
    }catch{report.attribution={available:false,reason:'dimensions_unavailable'};}
    return report;
  }catch{return {available:false,reason:'provider_error'};}
}
// Only known public landing paths; discard query strings, private paths and arbitrary strings.
export function safeLanding(value){
  const path=String(value||'').split(/[?#]/)[0];
  return /^(\/(?:jobs(?:\/[1-9]\d{0,18})?|categories(?:\/[A-Za-z0-9%_-]{1,100})?|employers|about|pro)?)(?:\/)?$/.test(path)?path:null;
}
