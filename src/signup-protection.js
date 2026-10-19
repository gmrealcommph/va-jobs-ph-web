// Only Supabase consumes the single-use challenge token.
export function authCaptchaToken(env, form) {
  const tokens = form.getAll('cf-turnstile-response');
  if (!tokens.length || (tokens.length === 1 && tokens[0] === '')) {
    if (env.AUTH_CAPTCHA_ENABLED === 'true') throw Error('Complete the security check.');
    return undefined;
  }
  if (tokens.length !== 1 || typeof tokens[0] !== 'string' || !tokens[0].trim() || tokens[0].length > 2048) throw Error('Complete the security check.');
  return tokens[0];
}
export async function rateProtection(request, env, scope) {
  const ip = request.headers.get('cf-connecting-ip');
  if (!ip || !env.SIGNUP_RATE_LIMITER?.limit) return 503;
  try {
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))), b => b.toString(16).padStart(2, '0')).join('');
    return (await env.SIGNUP_RATE_LIMITER.limit({key: scope + ':' + hash})).success ? 200 : 429;
  } catch { return 503; }
}
export async function signupProtection(request, env) {
  if (env.SIGNUP_PROTECTION_ENABLED !== 'true') return 200;
  return rateProtection(request, env, 'signup');
}
