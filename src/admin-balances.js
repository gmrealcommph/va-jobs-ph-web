// Read-only provider reports. Application keys are never returned or enumerated.
export async function openaiCosts(env,{request=fetch,now=Date.now}={}){
  const checked_at=new Date(now()).toISOString();
  const fail=reason=>({available:false,reason,checked_at,credit_balance_available:false});
  if(!env.OPENAI_USAGE_ADMIN_KEY)return fail('not_connected');
  const current=new Date(now()),start=Date.UTC(current.getUTCFullYear(),current.getUTCMonth(),1);
  let page,total=0;const items=new Map();
  try{
    const signal=AbortSignal.timeout(5000);
    for(let count=0;count<3;count++){
      const url=new URL('https://api.openai.com/v1/organization/costs');
      url.searchParams.set('start_time',String(Math.floor(start/1000)));
      url.searchParams.set('end_time',String(Math.floor(now()/1000)));
      url.searchParams.set('limit','31');
      url.searchParams.set('group_by','line_item');
      if(page)url.searchParams.set('page',page);
      const r=await request(url.href,{redirect:'manual',headers:{Authorization:'Bearer '+env.OPENAI_USAGE_ADMIN_KEY},signal});
      if(!r.ok)return fail([401,403].includes(r.status)?'access_denied':r.status===429?'rate_limited':'provider_error');
      const data=await r.json();
      if(!Array.isArray(data.data)||typeof data.has_more!=='boolean')return fail('invalid_response');
      for(const bucket of data.data){
        if(!Array.isArray(bucket.results))return fail('invalid_response');
        for(const result of bucket.results){
          if(result.amount?.currency!=='usd'||!Number.isFinite(result.amount.value))return fail('invalid_response');
          total+=result.amount.value;
          const label=result.line_item==null?'Other reported usage':result.line_item;
          if(typeof label!=='string'||!label||label.length>250)return fail('invalid_response');
          items.set(label,(items.get(label)||0)+result.amount.value);
        }
      }
      if(!Number.isFinite(total))return fail('invalid_response');
      if(!data.has_more)return {available:true,source:'OpenAI Costs API',scope:'organization-wide',period_start:new Date(start).toISOString(),period_end:checked_at,month_cost_usd:total,cost_items:[...items].map(([label,cost_usd])=>({label,cost_usd})).sort((a,b)=>b.cost_usd-a.cost_usd),fetched_at:checked_at,checked_at,credit_balance_available:false};
      if(typeof data.next_page!=='string'||!data.next_page||data.next_page===page)return fail('invalid_response');
      page=data.next_page;
    }
    return fail('incomplete_response');
  }catch{return fail('provider_error');}
}

export async function paymongoBalance(env,{request=fetch,now=Date.now}={}){
  const checked_at=new Date(now()).toISOString(),fail=reason=>({available:false,reason,checked_at});
  if(env.PAYMONGO_MODE!=='live'||!env.PAYMONGO_LIVE_SECRET_KEY)return fail('not_connected');
  try{
    const r=await request('https://api.paymongo.com/v2/wallets/?fields=balance',{redirect:'manual',headers:{Authorization:'Basic '+btoa(env.PAYMONGO_LIVE_SECRET_KEY+':'),accept:'application/json'},signal:AbortSignal.timeout(5000)});
    if(!r.ok)return fail([401,403].includes(r.status)?'access_denied':r.status===429?'rate_limited':'provider_error');
    const data=await r.json();
    if(!Array.isArray(data.data))return fail('invalid_response');
    const wallets=data.data.map(w=>w.attributes||w).filter(w=>w.livemode===true&&w.status==='activated');
    if(!wallets.length)return fail('wallet_not_active');
    let available=0,pending=0;
    for(const w of wallets){
      if(!Number.isSafeInteger(w.balance?.available)||w.balance.available<0||!Number.isSafeInteger(w.balance.pending)||w.balance.pending<0)return fail('invalid_response');
      available+=w.balance.available;pending+=w.balance.pending;
    }
    if(!Number.isSafeInteger(available)||!Number.isSafeInteger(pending))return fail('invalid_response');
    return {available:true,source:'PayMongo Wallet API',scope:'active live merchant wallets',available_php:available/100,pending_php:pending/100,wallet_count:wallets.length,checked_at,fetched_at:checked_at};
  }catch{return fail('provider_error');}
}

export function cachedReport(fetcher,keyFor){
  let identity,entry,inflight;
  return async(env,options={})=>{
    const key=keyFor(env),now=options.now||Date.now;
    if(identity!==key){identity=key;entry=inflight=undefined;}
    if(entry?.expires>now())return structuredClone(entry.value);
    if(inflight)return structuredClone(await inflight);
    const pending=fetcher(env,options).then(value=>{
      const expires=now()+900000;
      value.next_refresh_at=new Date(expires).toISOString();
      if(key===identity)entry={value,expires};
      return value;
    });inflight=pending;
    try{return structuredClone(await pending);}finally{if(inflight===pending)inflight=undefined;}
  };
}
export const cachedOpenaiCosts=cachedReport(openaiCosts,e=>e.OPENAI_USAGE_ADMIN_KEY);
export const cachedPaymongoBalance=cachedReport(paymongoBalance,e=>(e.PAYMONGO_MODE||'')+':'+(e.PAYMONGO_LIVE_SECRET_KEY||''));
export async function cloudflareUsage(env,{request=fetch,now=Date.now}={}){
  const checked_at=new Date(now()).toISOString(),fail=reason=>({available:false,reason,checked_at});
  if(!env.CLOUDFLARE_USAGE_TOKEN||!env.CLOUDFLARE_USAGE_ACCOUNT_ID||!env.CLOUDFLARE_USAGE_WORKER_NAME)return fail('not_connected');
  if(!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_USAGE_ACCOUNT_ID))return fail('invalid_configuration');
  const period_start=new Date(now()-86400000).toISOString();
  // No dimensions: aggregate across the entire window, rather than truncating time-series rows.
  const query=`query Usage($accountTag: string, $start: string, $end: string, $script: string) {
    viewer { accounts(filter: {accountTag: $accountTag}) {
      workersInvocationsAdaptive(limit: 1, filter: {scriptName: $script, datetime_geq: $start, datetime_leq: $end}) {
        sum { requests errors }
      }
    } }
  }`;
  try{
    const response=await request('https://api.cloudflare.com/client/v4/graphql',{method:'POST',redirect:'manual',headers:{Authorization:'Bearer '+env.CLOUDFLARE_USAGE_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,variables:{accountTag:env.CLOUDFLARE_USAGE_ACCOUNT_ID,start:period_start,end:checked_at,script:env.CLOUDFLARE_USAGE_WORKER_NAME}}),signal:AbortSignal.timeout(5000)});
    if(!response.ok)return fail([401,403].includes(response.status)?'access_denied':response.status===429?'rate_limited':'provider_error');
    const data=await response.json();
    if(data.errors!=null&&(!Array.isArray(data.errors)||data.errors.length))return fail('provider_error');
    const accounts=data.data?.viewer?.accounts;
    if(!Array.isArray(accounts)||accounts.length!==1)return fail('invalid_response');
    const rows=accounts[0].workersInvocationsAdaptive;
    if(!Array.isArray(rows)||rows.length!==1)return fail('incomplete_response');
    const sum=rows[0]?.sum;
    if(!Number.isFinite(sum?.requests)||sum.requests<0||!Number.isFinite(sum?.errors)||sum.errors<0)return fail('invalid_response');
    return {available:true,source:'Cloudflare GraphQL Analytics',scope:'configured VeeAys Worker',sampled:true,requests:sum.requests,errors:sum.errors,period_start,period_end:checked_at,checked_at,fetched_at:checked_at};
  }catch{return fail('provider_error');}
}
export const cachedCloudflareUsage=cachedReport(cloudflareUsage,e=>JSON.stringify([e.CLOUDFLARE_USAGE_TOKEN,e.CLOUDFLARE_USAGE_ACCOUNT_ID,e.CLOUDFLARE_USAGE_WORKER_NAME]));
export async function providerBalances(env){
  const [openai,paymongo,cloudflare,cloudflare_billing]=await Promise.all([cachedOpenaiCosts(env),cachedPaymongoBalance(env),cachedCloudflareUsage(env),cachedCloudflareBilling(env)]);
  return {openai,paymongo,cloudflare,cloudflare_billing,supabase:{available:false,reason:'organization_usage_not_connected'}};
}

export async function cloudflareBilling(env,{request=fetch,now=Date.now}={}){
 const checked_at=new Date(now()).toISOString(),fail=reason=>({available:false,reason,checked_at});
 if(!env.CLOUDFLARE_BILLING_TOKEN||!env.CLOUDFLARE_USAGE_ACCOUNT_ID)return fail('not_connected');
 if(!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_USAGE_ACCOUNT_ID))return fail('invalid_configuration');
 const base='https://api.cloudflare.com/client/v4/accounts/'+env.CLOUDFLARE_USAGE_ACCOUNT_ID+'/billable-usage';
 const options={redirect:'manual',headers:{Authorization:'Bearer '+env.CLOUDFLARE_BILLING_TOKEN,accept:'application/json'},signal:AbortSignal.timeout(5000)};
 try{
  const infoResponse=await request(base+'/info',options);
  if(!infoResponse.ok)return fail([401,403].includes(infoResponse.status)?'access_denied':infoResponse.status===429?'rate_limited':'provider_error');
  const info=await infoResponse.json();
  if(info.success!==true||!Array.isArray(info.errors)||info.errors.length||typeof info.result?.covered!=='boolean')return fail('invalid_response');
  if(!info.result.covered)return fail('billing_not_covered');
  const response=await request(base,options); // No dates: provider selects current subscription billing periods.
  if(!response.ok)return fail([401,403].includes(response.status)?'access_denied':response.status===429?'rate_limited':'provider_error');
  const data=await response.json();
  if(data.success!==true||!Array.isArray(data.errors)||data.errors.length||!Array.isArray(data.result)||data.result_info?.total_pages>1)return fail('invalid_response');
  if(!data.result.length)return {...fail('billing_no_records'),access_verified:true,coverage_verified:true};
  const groups=new Map();
  for(const row of data.result){
   if(row.BillingAccountId!==env.CLOUDFLARE_USAGE_ACCOUNT_ID||row.ChargeCategory!=='Usage'||(row.ChargeClass!=null&&row.ChargeClass!=='')||!Number.isFinite(row.ContractedCost)||row.ContractedCost<0||!Number.isFinite(row.ConsumedQuantity)||row.ConsumedQuantity<0||typeof row.ServiceName!=='string'||!row.ServiceName||row.ServiceName.length>250||typeof row.ConsumedUnit!=='string'||row.ConsumedUnit.length>100||typeof row.BillingCurrency!=='string'||!/^[A-Z]{3}$/.test(row.BillingCurrency))return fail('invalid_response');
   for(const name of ['BillingPeriodStart','ChargePeriodStart','ChargePeriodEnd'])if(typeof row[name]!=='string'||!Number.isFinite(Date.parse(row[name])))return fail('invalid_response');
   if(Date.parse(row.ChargePeriodEnd)<=Date.parse(row.ChargePeriodStart)||Date.parse(row.ChargePeriodStart)<Date.parse(row.BillingPeriodStart))return fail('invalid_response');
   const key=JSON.stringify([row.BillingPeriodStart,row.ServiceName,row.ConsumedUnit,row.BillingCurrency]);
   const group=groups.get(key)||{period_start:row.BillingPeriodStart,service:row.ServiceName,unit:row.ConsumedUnit,currency:row.BillingCurrency,reported_cost:0,consumed_quantity:0,reported_through:row.ChargePeriodEnd};
   // Sum per-charge-period costs; cumulative cost fields must never be summed across days.
   group.reported_cost+=row.ContractedCost;group.consumed_quantity+=row.ConsumedQuantity;
   if(!Number.isFinite(group.reported_cost)||!Number.isFinite(group.consumed_quantity))return fail('invalid_response');
   if(Date.parse(row.ChargePeriodEnd)>Date.parse(group.reported_through))group.reported_through=row.ChargePeriodEnd;
   groups.set(key,group);
  }
  return {available:true,source:'Cloudflare Billable Usage API (v1 alpha)',scope:'account-wide metered usage in current provider billing periods',items:[...groups.values()].sort((a,b)=>a.service.localeCompare(b.service)),checked_at,fetched_at:checked_at};
 }catch{return fail('provider_error');}
}
export const cachedCloudflareBilling=cachedReport(cloudflareBilling,e=>JSON.stringify([e.CLOUDFLARE_BILLING_TOKEN,e.CLOUDFLARE_USAGE_ACCOUNT_ID]));
