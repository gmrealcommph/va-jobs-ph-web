import {authFetch, sessionForRequest, setSessionCookies} from './auth.js';
import {layout, esc, authSupportPage} from './render.js';
import {authCaptchaToken, rateProtection} from './signup-protection.js';

const callbackScript = `const p=new URLSearchParams(location.hash.slice(1));history.replaceState(null,'',location.pathname);if(p.has('access_token')&&p.has('refresh_token')){fetch('/auth/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({access_token:p.get('access_token'),refresh_token:p.get('refresh_token'),expires_in:Number(p.get('expires_in'))||3600})}).then(r=>{if(!r.ok)throw Error();location.replace('/reset-password')}).catch(()=>{document.getElementById('recovery-status').textContent='This reset link could not be verified. Request a new password reset.'})}else{document.getElementById('recovery-status').textContent='This reset link is missing or expired. Request a new password reset.'}`;
const paths = ['/auth/resend','/forgot-password','/reset-password','/auth/recovery','/auth/recovery.js'];
export async function authSupportEndpoint(request, env, siteOrigin, baseHeaders) {
  const url = new URL(request.url);
  if (!paths.includes(url.pathname)) return null;
  const headers = {...baseHeaders, 'cache-control':'no-store', 'referrer-policy':'same-origin'};
  if (env.TURNSTILE_SITE_KEY) headers['content-security-policy'] = headers['content-security-policy'].replace("script-src 'self'; connect-src 'self';", "script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com;");
  const page = (title, body, status=200, extra={}) => new Response(request.method === 'HEAD' ? null : layout({title,body:authSupportPage(title, body, url.pathname),noindex:true}), {status,headers:{...headers,...extra}});
  if (!['GET','HEAD','POST'].includes(request.method)) return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD, POST'}});
  if(url.pathname === '/auth/recovery.js') return new Response(request.method==='HEAD'?null:callbackScript,{status:request.method==='POST'?405:200,headers:{...headers,'content-type':'application/javascript'}});
  if(url.pathname === '/auth/recovery' && request.method === 'POST') return new Response('Method not allowed',{status:405});
  if(url.pathname === '/auth/recovery') return page('Reset your password','<p id="recovery-status" role="status" aria-live="polite">Verifying your reset linkΓÇª</p><a href="/forgot-password">Request a new reset link</a><script src="/auth/recovery.js" defer></script>');
  const reset = url.pathname === '/reset-password';
  const resend = url.pathname === '/auth/resend';
  const title = reset ? 'Choose a new password' : resend ? 'Resend verification email' : 'Reset your password';
  let form = new FormData();
  if(request.method==='POST') {
    if(request.headers.get('origin')!==url.origin) return new Response('Forbidden',{status:403});
    try {form=await request.formData();} catch {return page(title,'<p>Invalid form.</p>',400);}
  }
  const email=String(form.get('email') || url.searchParams.get('email') || '').trim().toLowerCase().slice(0,254);
  const rawReturn=String(form.get('return') || url.searchParams.get('return') || '');
  const returnTo=/^\/apply\/[A-Za-z0-9%._~-]{1,240}$/.test(rawReturn) ? rawReturn : '';
  const widget=env.TURNSTILE_SITE_KEY ? `<div class="cf-turnstile" data-sitekey="${esc(env.TURNSTILE_SITE_KEY)}" data-action="${resend?'resend':'recovery'}"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` : '';
  const emailForm=(error='')=>`${error?`<div class="auth-alert error" role="alert">${esc(error)}</div>`:''}<form class="auth-form" method="post" action="${url.pathname}"><div class="auth-field"><label for="recovery-email">Email address</label><input id="recovery-email" name="email" type="email" maxlength="254" autocomplete="email" value="${esc(email)}" required></div><input type="hidden" name="return" value="${esc(returnTo)}">${widget}<button type="submit">${resend?'Resend verification':'Send reset link'}</button></form><p class="auth-switch"><a href="/login">Back to log in</a></p>`;
  if(reset){
    const state=await sessionForRequest(request,env);
    if(!state.user||!state.accessToken) return page(title,'<p>Open the link in your reset email first.</p><a class="button" href="/forgot-password">Request a reset link</a>',401);
    const passwordForm=(error='')=>`${error ? `<div class="auth-alert error" role="alert">${esc(error)}</div>` : ''}<form class="auth-form" method="post" action="/reset-password"><div class="auth-field"><label for="recovery-password">New password</label><input id="recovery-password" type="password" name="password" autocomplete="new-password" minlength="8" maxlength="128" aria-describedby="recovery-password-help" required><small id="recovery-password-help">Use 8ΓÇô128 characters for your password.</small></div><button type="submit">Save password</button></form>`;
    const passwordPage=(title,body,status=200)=>{const response=page(title,body,status);if(state.refreshed)setSessionCookies(response.headers,state.refreshed);return response;};
    if(request.method==='POST'){
      const password=String(form.get('password')||'');
      if(password.length<8||password.length>128)return passwordPage(title,passwordForm('Use 8ΓÇô128 characters.'),400);
      let result;try{result=await authFetch(env,'/auth/v1/user',{method:'PUT',headers:{Authorization:`Bearer ${state.accessToken}`},body:JSON.stringify({password})});}catch{return passwordPage(title,passwordForm('Password service is temporarily unavailable. Please try again.'),503);}
      if(!result.response.ok)return passwordPage(title,passwordForm('Password could not be updated. Try again or request a new link.'),400);
      return passwordPage('Password updated','<p>Your new password is saved.</p><a class="button" href="/login">Continue to log in</a>');
    }
    // Keep refreshed cookies as separate header values.
    const response=page(title,passwordForm());if(state.refreshed)setSessionCookies(response.headers,state.refreshed);return response;
  }
  if(request.method!=='POST')return page(title,emailForm());
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return page(title,emailForm('Enter a valid email address.'),400);
  if(env.AUTH_CAPTCHA_ENABLED==='true'&&!env.TURNSTILE_SITE_KEY)return page(title,'<p>Security check temporarily unavailable.</p>',503);
  let captchaToken;try{captchaToken=authCaptchaToken(env,form);}catch{return page(title,emailForm('Please complete a fresh security check.'),400);}
  // Email endpoints are always limited; Supabase also enforces its per-address cooldown.
  const limited=await rateProtection(request,env,'auth-email');
  if(limited!==200)return page(title,emailForm('Please wait a minute before trying again.'),limited,{'retry-after':'60'});
  const redirectTo=resend?`${siteOrigin}/auth/callback${returnTo?'?return='+encodeURIComponent(returnTo):''}`:`${siteOrigin}/auth/recovery`;
  const payload={email,...(captchaToken?{gotrue_meta_security:{captcha_token:captchaToken}}:{})};
  if(resend)payload.type='signup';
  let result;try{result=await authFetch(env,`/auth/v1/${resend?'resend':'recover'}?redirect_to=${encodeURIComponent(redirectTo)}`,{method:'POST',body:JSON.stringify(payload)});}catch{return page(title,emailForm('Email service is temporarily unavailable. Please try again later.'),503);}
  if(/captcha/i.test(String(result.data?.error_code||'')+' '+String(result.data?.msg||result.data?.message||'')))return page(title,emailForm('Please complete a fresh security check.'),400);
  if(result.response.status>=500)return page(title,emailForm('Email service is temporarily unavailable. Please try again later.'),503);
  // Do not expose account existence, confirmation state, or address cooldown.
  return page('Check your inbox','<p>If this address is eligible, an email will arrive shortly. Please wait at least 60 seconds before requesting another.</p><a href="/login">Back to log in</a>');
}
