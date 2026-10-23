import {purgeProAiCache} from './pro-ai-budget.js';
import {layout} from './render.js';
import {sessionForRequest,getMyProfile,clearSessionCookies,signIn,authFetch} from './auth.js';
import {pages} from './legal-pages.js';
function deletionDisclosure(env={}) {
  const period=(value,fallback)=>/^\d{1,3}$/.test(String(value))&&Number(value)>0?Number(value):fallback;
  const years=period(env.FINANCIAL_RETENTION_YEARS,5),months=period(env.DISPUTE_RETENTION_MONTHS,12);
  return `<p>This permanently removes your sign-in, profile, job preferences, saved jobs, application tracker and notes, and queued alerts. You cannot undo this. Shared job listings and other members' data stay available.</p><p>Your Pro access ends immediately. VeeAys currently uses one-time QR Ph payments, with no automatic renewal. Open checkout links will be closed before deletion. Deletion does not automatically refund past payments or cancel a payment already processing.</p><p>We detach your account from financial receipts and retain payment references, amounts, currency, status and transaction dates securely for accounting, tax and payment reconciliation, restricted to authorized administrators. Our proposed retention schedule is ${years} years based on the applicable BIR tax-year filing timeline, and ${months} months after closure for fraud or dispute records, subject to legal review and provider requirements. Active disputes, investigations and legal holds may require longer retention. Automatic purging remains disabled until this schedule is formally approved; these periods are not a promise of automatic deletion.</p><p>PayMongo may retain its own payment and fraud-prevention records under its obligations. Security logs, backups and already-sent emails follow their providers' retention policies; account deletion cannot recall an email.</p>`;
}
function deletionPage(body, state=null, status=200) {
  return new Response(layout({title:'Account settings',description:'Manage your VeeAys account',canonical:'https://veeays.com/account/delete',noindex:true,user:state?.user,body:`<link rel="stylesheet" href="/account/deletion.css?v=20261012-fun"><section class="deletion-settings">${body}</section>`}),{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"}});
}
const deletionDanger = `<section class="deletion-danger" aria-labelledby="danger-title"><h2 id="danger-title">Danger Zone</h2><h3>Delete Account</h3><p>Permanently delete your VeeAys account and personal job-search data.</p><a class="button secondary" href="/account/delete">Delete Account</a></section>`;
function deletionConfirmation(env,profile) {
  const isPro=profile?.plan==='pro'&&profile?.plan_status==='active'&&(!profile.pro_expires_at||Date.parse(profile.pro_expires_at)>Date.now());
  const details=deletionDisclosure(env).replace(/<p>Your Pro access ends immediately\.[\s\S]*?<\/p>/,'');
  return `<p>Your account and personal job-search data will be permanently deleted. This cannot be undone.</p>${isPro?'<p class="deletion-pro-note">Your Pro access will end immediately.</p>':''}<details class="deletion-details"><summary>What happens to my data?</summary><div>${details}<p>Any open checkout links will be closed before deletion. Deletion does not automatically refund past payments or reverse a payment already processing.</p><a href="/privacy" target="_blank" rel="noopener">Read our Privacy Policy</a></div></details>`;
}
function deletionCookie(request) {
  const raw=(request.headers.get('cookie')||'').split(';').find(x=>x.trim().startsWith('__Host-veeays_delete='));
  return raw?.trim().slice('__Host-veeays_delete='.length)||'';
}
async function deletionRpc(env,name,id) {
  if(!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Deletion unavailable');
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  const r=await fetch(new URL('/rest/v1/rpc/'+name,env.SUPABASE_URL),{method:'POST',headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),'content-type':'application/json'},body:JSON.stringify({p_user_id:id}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('Deletion temporarily blocked');
  return r.json();
}
async function closeDeletionCheckout(env,record) {
  if(!/^cs_[A-Za-z0-9]+$/.test(record.checkout_id))throw Error('Checkout reconciliation needed');
  const secret=record.livemode?env.PAYMONGO_LIVE_SECRET_KEY:env.PAYMONGO_TEST_SECRET_KEY;
  if(!(record.livemode?/^sk_live_/:/^sk_test_/).test(secret||''))throw Error('Billing unavailable');
  const endpoint='https://api.paymongo.com/v1/checkout_sessions/'+encodeURIComponent(record.checkout_id);
  const options={redirect:'error',headers:{Authorization:'Basic '+btoa(secret+':'),accept:'application/json'},signal:AbortSignal.timeout(10000)};
  const read=async()=>{const r=await fetch(endpoint,options);if(!r.ok)throw Error('Billing unavailable');const data=(await r.json()).data;if(data?.id!==record.checkout_id||data?.attributes?.livemode!==record.livemode)throw Error('Checkout mismatch');return data.attributes;};
  const a=await read();
  if(a.status==='expired')return;
  // Even paid sessions are closed, preventing retries on an old checkout link.
  await fetch(endpoint+'/expire',{...options,method:'POST'});
  if((await read()).status!=='expired')throw Error('Checkout could not be closed');
}
async function accountDeletionEndpoint(request,env) {
  const path=new URL(request.url).pathname;
  if(path==='/account/deletion.css')return new Response('.deletion-settings,.deletion-danger{max-width:760px;margin:40px auto;padding:28px}.deletion-danger{border:2px solid #a42e36;border-radius:16px}.deletion-danger h2{color:#a42e36}.deletion-settings dialog{position:fixed;inset:0;box-sizing:border-box;margin:auto;width:min(520px,calc(100vw - 32px));max-width:none;height:fit-content;max-height:calc(100dvh - 32px);overflow:auto;overflow-wrap:anywhere;border:1px solid #a42e36;border-radius:16px;padding:24px;background:#fff;color:#243d33}.deletion-settings dialog::backdrop{background:#14251fcc}.deletion-settings dialog h1{font-size:28px;line-height:1.15;letter-spacing:-.5px;margin:0 0 14px}.deletion-settings dialog p{font-size:15px;line-height:1.5;margin:12px 0}.deletion-settings label{display:block;font-size:14px;margin:18px 0}.deletion-settings input{display:block;width:100%;min-width:0;box-sizing:border-box;margin-top:7px;padding:11px;font-size:16px;border:1px solid #9caea5;border-radius:8px}.deletion-settings button{display:block;width:100%;background:#a42e36;color:white;padding:12px 16px;font-size:15px;font-weight:600;border:0;border-radius:8px;cursor:pointer}.deletion-settings form a{display:block;text-align:center;margin:16px 0 0}.deletion-details{margin:16px 0}.deletion-details summary{color:#0f5c42;text-decoration:underline;text-underline-offset:3px;font-size:14px;cursor:pointer}.deletion-details>div{padding-top:6px}.deletion-details[open]{border-bottom:1px solid #dce5df;padding-bottom:16px}.deletion-pro-note{font-weight:600}.deletion-error{color:#9c2028}.deletion-settings dialog{background:#f8f6ee;border:1px solid #cfdbcf;box-shadow:0 20px 80px #0b281f33;padding:24px 26px}.deletion-settings dialog h1{color:#0f3d2e;font-family:Georgia,serif;font-weight:500;font-size:32px;letter-spacing:-1px;line-height:1.08}.deletion-farewell{margin:-6px 0 14px;border-bottom:1px dashed #bdcdbd;padding-bottom:16px}.deletion-farewell svg{display:block;width:180px;height:54px;margin:0 auto 8px}.deletion-farewell span{display:block;font-size:10px;font-weight:700;letter-spacing:1.6px;color:#547161}.deletion-settings input{background:#fffdf8;border-color:#c4d2c5}.deletion-settings input:focus{outline:2px solid #6c9876;outline-offset:2px}.deletion-settings button{background:#a4423e;box-shadow:0 3px 0 #79322e;transition:background .15s,transform .15s}.deletion-settings button:hover{background:#8c3633}.deletion-settings button:active{transform:translateY(2px);box-shadow:0 1px 0 #79322e}.deletion-settings button span{margin-left:5px}.deletion-settings form a{font-weight:600;color:#0f3d2e}.deletion-settings dialog .deletion-goodbye{border-top:1px dashed #bdcdbd;margin:20px 0 0;padding-top:14px;font-size:11px;line-height:1.5;color:#647967;text-align:center}.deletion-goodbye span{color:#a77a39}.deletion-settings dialog .deletion-pro-note{font-size:13px;padding:8px 10px;border-radius:8px;background:#eee8d8;font-weight:500}@media(prefers-reduced-motion:reduce){.deletion-settings button{transition:none}}',{headers:{'content-type':'text/css','cache-control':'public,max-age=3600'}});
  if(path==='/account/deletion.js')return new Response('const d=document.querySelector("dialog");if(d){d.removeAttribute("open");d.showModal();d.addEventListener("cancel",()=>location.assign("/onboarding"));}document.querySelector("form")?.addEventListener("submit",e=>{const b=e.target.querySelector("button");b.disabled=true;b.textContent="Deleting account…";});',{headers:{'content-type':'text/javascript','cache-control':'public,max-age=3600'}});
  if(path==='/account/deleted') {
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
    const result=deletionPage('<h1>You are signed out</h1><p>If you completed account deletion, your VeeAys account and personal job-search data have been removed. Financial records disclosed during confirmation remain detached from your account.</p><a href="/jobs">Browse public jobs</a>');
    clearSessionCookies(result.headers);result.headers.append('set-cookie','__Host-veeays_delete=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');return result;
  }
  if(!['GET','POST'].includes(request.method))return new Response('Method not allowed',{status:405});
  let state;
  try {state=await sessionForRequest(request,env);}catch{return deletionPage('<h1>Account service unavailable</h1><p>Please try again shortly. No deletion was confirmed.</p>',null,503);}
  if(!state.user||!state.accessToken)return new Response(null,{status:303,headers:{location:'/login','cache-control':'no-store'}});
  if(request.method==='GET') {
    const token=crypto.randomUUID();
    let profile;
    try{profile=await getMyProfile(env,state.accessToken,state.user.id);}catch{return deletionPage('<h1>Account settings unavailable</h1><p>Please try again shortly.</p><a href="/account/delete">Try again</a>',state,503);}
    const response=deletionPage(`<dialog open aria-labelledby="delete-title"><div class="deletion-farewell" aria-hidden="true"><svg viewBox="0 0 240 72" fill="none"><path d="M12 52c29-29 49 13 74-8 22-19-17-40-25-18-8 24 55 35 91-1" stroke="#7c9c83" stroke-width="2" stroke-dasharray="4 5" stroke-linecap="round"/><path d="m151 22 59-13-30 45-5-21-24-11Z" fill="#d5ed83" stroke="#0f3d2e" stroke-width="2.5" stroke-linejoin="round"/><path d="m175 33 35-24-28 32" stroke="#0f3d2e" stroke-width="2" stroke-linejoin="round"/><path d="m27 15 2-6m-8 10-6-1m18 6 5 4m182 29 2-6m-8 10-6-1" stroke="#c78c49" stroke-width="2" stroke-linecap="round"/></svg><span>OFF TO YOUR NEXT CHAPTER?</span></div><h1 id="delete-title">Delete your account?</h1>${deletionConfirmation(env,profile)}<form method="post" action="/account/delete"><input type="hidden" name="token" value="${token}"><label>Current password<input type="password" name="password" autocomplete="current-password" required maxlength="128"></label><label>Type DELETE to confirm<input name="confirm" required pattern="DELETE" autocomplete="off" maxlength="6"></label><button type="submit">Permanently Delete Account <span aria-hidden="true">↗</span></button><a href="/onboarding">Keep my account</a></form><p class="deletion-goodbye">Different flight path. Same big possibilities. <span aria-hidden="true">✦</span></p></dialog><script src="/account/deletion.js" defer></script>`,state);
    response.headers.append('set-cookie',`__Host-veeays_delete=${state.user.id}.${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=600`);
    if(state.refreshed)setSessionCookies(response.headers,state.refreshed);return response;
  }
  const origin=new URL(request.url).origin;
  if(request.headers.get('origin')!==origin||origin!==new URL(env.SITE_URL).origin)return new Response('Forbidden',{status:403});
  if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')||Number(request.headers.get('content-length'))>4096)return new Response('Invalid form',{status:400});
  const raw=await request.text();if(raw.length>4096)return new Response('Invalid form',{status:400});
  const form=new URLSearchParams(raw),token=form.get('token')||'',password=form.get('password')||'';
  if(!/^[0-9a-f-]{36}$/.test(token)||deletionCookie(request)!==state.user.id+'.'+token||form.get('confirm')!=='DELETE'||!password||password.length>128)return new Response('Invalid confirmation. Reopen Delete Account to try again.',{status:400,headers:{'cache-control':'no-store'}});
  let freshToken;
  try {
    // Verified factors must not be bypassed by a password-only deletion request.
    if(state.user.factors?.some(f=>f.status==='verified'))return deletionPage('<h1>Additional verification needed</h1><p>This account has multi-factor authentication. Contact support for verified account deletion.</p><a href="/onboarding">Back to my account</a>',state,409);
    const fresh=await signIn(env,{email:state.user.email,password});freshToken=fresh.data?.access_token;
    if(!fresh.response.ok||fresh.data?.user?.id!==state.user.id||!freshToken)return deletionPage('<h1>Password could not be verified</h1><p>Your account was not deleted.</p><a href="/account/delete">Try again</a>',state,403);
    await purgeProAiCache(env,state.user.id);
    const prepared=await deletionRpc(env,'prepare_account_deletion',state.user.id);
    for(const row of prepared.checkouts||[])await closeDeletionCheckout(env,row);
    const result=await deletionRpc(env,'finish_account_deletion',state.user.id);
    if(result.deleted!==true)throw Error('Deletion unconfirmed');
    const headers=new Headers({location:'/account/deleted','cache-control':'no-store'});clearSessionCookies(headers);
    headers.append('set-cookie','__Host-veeays_delete=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');
    return new Response(null,{status:303,headers});
  } catch {
    return deletionPage('<h1>Deletion has not been confirmed</h1><p>Your request may be waiting for checkout or email processing. Any checkout already closed stays closed, and new checkout creation is blocked once deletion begins. If the final step completed but its response was interrupted, you will be signed out. Otherwise, retry securely below; repeated requests cannot delete another account.</p><a href="/account/delete">Retry deletion</a><p>If this persists, contact support to reconcile the request.</p>',state,503);
  } finally {
    // Do not leave the password verification's temporary session behind on failure.
    if(freshToken)try{await authFetch(env,'/auth/v1/logout?scope=local',{method:'POST',headers:{Authorization:'Bearer '+freshToken}});}catch{}
  }
}
export {accountDeletionEndpoint,closeDeletionCheckout,deletionDanger,refreshDeletionDisclosure};

// Keep the published account/billing disclosures consistent with this flow.
const currentPaymentCopy='<p>VeeAys Pro checkout currently uses PayMongo QR Ph for a one-time ₱499 payment granting 30 days of access. It does not renew automatically. Existing promotional or administrator-granted Pro access does not authorize a payment. Paddle is not the active checkout provider.</p>';
for(const path of ['/terms','/privacy','/refund-policy','/contact']) {
  const page=pages[path];if(!page)continue;
  page.sections=page.sections.map(([heading,copy])=>{
    if(['VeeAys Pro and payment launch','Current payment status','Pro and billing enquiries'].includes(heading))return [heading,currentPaymentCopy];
    if(heading==='Cancellation once paid subscriptions launch')return ['Account deletion and payment cancellation','<p>There is no automatic renewal to cancel in the current QR Ph checkout. Deleting an account immediately ends its Pro access and closes its checkout links. It does not automatically refund completed payments or reverse a payment already processing. Contact support@veeays.com about payment disputes or refund requests; applicable statutory rights remain unaffected.</p>'];
    if(path==='/privacy'&&heading==='Information we use')copy=copy.replace(/<p>Payments are not live\.[\s\S]*?<\/p>/,currentPaymentCopy);
    return [heading,copy];
  });
  if(path==='/privacy')page.sections.push(['Self-service account deletion',deletionDisclosure()]);
}
function refreshDeletionDisclosure(env) {
  const section=pages['/privacy']?.sections.find(([heading])=>heading==='Self-service account deletion');
  if(section)section[1]=deletionDisclosure(env)+'<p>Open My account, find Danger Zone and choose Delete Account. Verify your current password and type DELETE. Administrative or multi-factor accounts currently require assisted verification through support@veeays.com. If billing processing prevents completion, retry or contact support. New checkouts remain blocked after a deletion request starts.</p>';
}
