import { config } from './data.js';

const ACCESS_COOKIE = 'veeays_access';
const REFRESH_COOKIE = 'veeays_refresh';

function cookieMap(request) {
  const out = {};
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookies(headers) {
  headers.append('Set-Cookie', cookie(ACCESS_COOKIE, '', 0));
  headers.append('Set-Cookie', cookie(REFRESH_COOKIE, '', 0));
}

export function setSessionCookies(headers, session) {
  if (!session?.access_token || !session?.refresh_token) throw new Error('Invalid Supabase session.');
  const accessAge = Math.max(60, Math.min(Number(session.expires_in) || 3600, 3600));
  headers.append('Set-Cookie', cookie(ACCESS_COOKIE, session.access_token, accessAge));
  headers.append('Set-Cookie', cookie(REFRESH_COOKIE, session.refresh_token, 60 * 60 * 24 * 30));
}

async function authFetch(env, path, init = {}) {
  const { key, url } = config(env);
  const endpoint = new URL(path, url);
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      apikey: key,
      'content-type': 'application/json',
      ...(init.headers || {})
    },
    signal: AbortSignal.timeout(12000)
  });
  let data = null;
  try { data = await response.json(); } catch {}
  return { response, data };
}

export async function signUp(env, { email, password, fullName, redirectTo }) {
  const path = `/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`;
  return authFetch(env, path, {
    method: 'POST',
    body: JSON.stringify({ email, password, data: { full_name: fullName } })
  });
}

export async function signIn(env, { email, password }) {
  return authFetch(env, '/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export async function exchangeRefreshToken(env, refreshToken) {
  return authFetch(env, '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken })
  });
}

export async function getUser(env, accessToken) {
  if (!accessToken) return null;
  const { response, data } = await authFetch(env, '/auth/v1/user', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return response.ok && data?.id ? data : null;
}

export async function sessionForRequest(request, env) {
  const cookies = cookieMap(request);
  let user = await getUser(env, cookies[ACCESS_COOKIE]);
  if (user) return { user, refreshed: null };
  if (!cookies[REFRESH_COOKIE]) return { user: null, refreshed: null };
  const { response, data } = await exchangeRefreshToken(env, cookies[REFRESH_COOKIE]);
  if (!response.ok || !data?.access_token) return { user: null, refreshed: false };
  user = data.user || await getUser(env, data.access_token);
  return { user, refreshed: user ? data : false };
}

export function authError(data, fallback) {
  return String(data?.msg || data?.message || data?.error_description || data?.error || fallback).slice(0, 240);
}
