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
  if (user) return { user, refreshed: null, accessToken: cookies[ACCESS_COOKIE] };
  if (!cookies[REFRESH_COOKIE]) return { user: null, refreshed: null, accessToken: null };
  const { response, data } = await exchangeRefreshToken(env, cookies[REFRESH_COOKIE]);
  if (!response.ok || !data?.access_token) return { user: null, refreshed: false, accessToken: null };
  user = data.user || await getUser(env, data.access_token);
  return { user, refreshed: user ? data : false, accessToken: user ? data.access_token : null };
}

export function authError(data, fallback) {
  return String(data?.msg || data?.message || data?.error_description || data?.error || fallback).slice(0, 240);
}

async function userRestFetch(env, accessToken, path, init = {}) {
  const { key, url } = config(env);
  const endpoint = new URL(path, url);
  const response = await fetch(endpoint, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(12000)
  });
  let data = null;
  if (response.status !== 204) { try { data = await response.json(); } catch {} }
  return { response, data };
}

export async function getJobPreferences(env, accessToken, userId) {
  const { response, data } = await userRestFetch(env, accessToken, `/rest/v1/job_preferences?user_id=eq.${encodeURIComponent(userId)}&select=*`, { method: 'GET' });
  if (!response.ok) throw new Error(`Could not load job preferences (${response.status}).`);
  return Array.isArray(data) ? (data[0] || null) : null;
}

export async function saveJobPreferences(env, accessToken, preferences) {
  const { response, data } = await userRestFetch(env, accessToken, '/rest/v1/job_preferences?on_conflict=user_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(preferences)
  });
  if (!response.ok) throw new Error(String(data?.message || data?.details || `Could not save job preferences (${response.status}).`));
  return Array.isArray(data) ? data[0] : data;
}

export async function completeOnboarding(env, accessToken) {
  const { response, data } = await userRestFetch(env, accessToken, '/rest/v1/rpc/update_my_profile', {
    method: 'POST', body: JSON.stringify({ new_full_name: null, new_onboarding_completed: true })
  });
  if (!response.ok) throw new Error(String(data?.message || data?.details || `Could not complete onboarding (${response.status}).`));
}

export async function getMyProfile(env, accessToken, userId) {
  const { response, data } = await userRestFetch(env, accessToken, `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,full_name,onboarding_completed`, { method: 'GET' });
  if (!response.ok) throw new Error(`Could not load profile (${response.status}).`);
  return Array.isArray(data) ? (data[0] || null) : null;
}
