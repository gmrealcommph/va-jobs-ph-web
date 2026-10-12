export function renderEmailUsage(usage,{row,num,date,esc,compact=false}){
  const reasons={not_connected:'Full-access usage secret is not connected.',access_denied:'Usage key is invalid or lacks Full access. Sending keys remain unchanged.',rate_limited:'Resend is rate limiting usage requests; automatic retry is delayed.',timeout:'Resend usage request timed out.',invalid_response:'Resend returned invalid or expired quota data.',endpoint_unavailable:'Resend Usage API endpoint is unavailable for this connection.',provider_error:'Resend Usage API is temporarily unavailable.'};
  let html='<h3>Resend account quota · current provider windows</h3>';
  if(!usage?.available)html+='<p role="status">Quota status unknown · '+esc(reasons[usage?.reason]||reasons.provider_error)+'</p>';
  const snapshot=usage?.available?usage:usage?.last_known;
  if(snapshot){
    if(!usage.available)html+='<p><strong>Stale last-known usage · cannot confirm current remaining quota.</strong></p>';
    for(const window of ['daily','monthly']){
      const q=snapshot[window];
      html+=row(window+' usage',num(q.used)+' / '+(q.limit===null?'Uncapped':num(q.limit)));
      html+=row(window+' threshold',q.level==='critical'?'100% or more · quota exhausted':q.level==='high'?'90% or more · high':q.level==='warning'?'70% or more · warning':q.level);
      if(q.limit!==null)html+=row(window+' utilization',(100*q.used/q.limit).toFixed(1)+'%')+row(window+' remaining',num(Math.max(0,q.limit-q.used)));
      for(const metric of ['sent','received'])if(q[metric]!==undefined)html+=row(window+' '+metric,num(q[metric]));
      html+=row(window+' resets · Manila',date(q.resets_at));
    }
    html+=row('Last successful provider retrieval · Manila',date(snapshot.fetched_at));
  }
  if(usage?.checked_at)html+=row('Last provider check · Manila',date(usage.checked_at));
  if(Number.isInteger(usage?.provider_status))html+=row('Provider HTTP status',usage.provider_status);
  if(usage?.next_refresh_at)html+=row('Next eligible provider refresh · Manila',date(usage.next_refresh_at));
  html+='<p class="note">Resend account-wide quota includes SMTP (including Supabase Auth on this account), API sends and received mail. Resend supplies limits and reset times; dashboard date filters do not change these windows. Usage refreshes on demand at most every 5 minutes per Worker instance, sooner at a quota reset; concurrent requests share a fetch. Multiple instances may each fetch. Manual refresh uses the same cache.</p>';
  if(!compact)return html;
  let summary='<p class="note">Resend account-wide quota · includes SMTP</p>';
  if(!usage?.available)summary+='<p role="status"><strong>Quota unknown</strong> · '+esc(reasons[usage?.reason]||reasons.provider_error)+'</p>';
  else for(const window of ['daily','monthly']){const q=usage[window];summary+=row(window+' usage',num(q.used)+' / '+(q.limit===null?'Uncapped':num(q.limit)))+row(window+' status',q.level==='critical'?'Quota exhausted · 100% or more':q.level==='high'?'High · 90% or more':q.level==='warning'?'Warning · 70% or more':q.level);}
  if(usage?.fetched_at)summary+=row('Fetched · Manila',date(usage.fetched_at));
  return summary+'<details><summary>Quota details, resets and refresh timing</summary>'+html+'</details>';
}
