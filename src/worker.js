import { categories, getJob, getJobsByIds, listJobs, query } from './data.js';
import { quickReadEndpoint } from './quick-read-service.js';
import { manualNotification } from './notifications.js';
import { scheduledStrongMatches } from './strong-matches.js';
import { scheduledDailyDigest, DIGEST_CRON } from './daily-digest.js';
import { emailPreferences } from './email-preferences.js';
import { categoryPage } from './category-page.js';
import { layout, listing, detail, esc, jobPath, categoryPath, authPage, checkEmailPage, authCallbackPage, onboardingPage, matchesPage, proPage, myJobsPage } from './render.js';
import { signUp, signIn, getUser, sessionForRequest, setSessionCookies, clearSessionCookies, authError, getJobPreferences, saveJobPreferences, completeOnboarding, getMyProfile, getMyJobMatches, getMyMatchSummary, getSavedJobs, saveJobForUser, unsaveJobForUser, getJobApplications, markJobApplied, updateJobApplication, deleteJobApplication } from './auth.js';

const headers = { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'content-security-policy': "default-src 'none'; style-src 'self'; img-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", 'permissions-policy': 'camera=(), microphone=(), geolocation=()' };
function origin(env, url) {
  if (!env.SITE_URL) return url.origin;
  const value = new URL(env.SITE_URL);
  if (!['http:', 'https:'].includes(value.protocol)) throw new Error('Invalid SITE_URL');
  return value.origin;
}

function safeReturnPath(value) {
  const v = String(value || '');
  if (/^\/apply\/[A-Za-z0-9%._~-]{1,240}$/.test(v)) return v;
  if (/^\/jobs\/[A-Za-z0-9%._~-]{1,240}(?:\?save=1)?$/.test(v)) return v;
  if (v === '/my-jobs' || v === '/matches' || v === '/jobs' || v === '/email-preferences') return v;
  if (v === '/onboarding' || v === '/') return v;
  return '';
}
async function defaultPostAuthPath(env, state) {
  // Onboarding is optional. Normal authentication always returns users to
  // the public job board; incomplete profiles are invited to onboard there.
  return '/';
}

function hasCookie(request, name, expected = '1') {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name && decodeURIComponent(rest.join('=')) === expected) return true;
  }
  return false;
}

function xml(body) { return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=300' } }); }
export async function handle(request, env) {
  const url = new URL(request.url);
  const quickReadMatch=url.pathname.match(/^\/internal\/quick-read\/([1-9]\d{0,18}|batch)$/);
  if(quickReadMatch) return quickReadEndpoint(request,env,quickReadMatch[1]==='batch'?null:quickReadMatch[1]);

  const manualMatch = url.pathname.match(/^\/internal\/strong-match\/([1-9]\d{0,18})$/);
  if (manualMatch) {
    if (env.STRONG_MATCH_MODE !== undefined) return new Response('Manual sender retired',{status:410});
    return manualNotification(request, env, manualMatch[1]);
  }
  if (url.pathname === '/email-preferences') return emailPreferences(request, env);

  const siteOrigin = origin(env, url);

  const sameOriginPost = () => {
    const requestOrigin = request.headers.get('origin');
    return !requestOrigin || requestOrigin === url.origin;
  };

  if (request.method === 'POST' && ['/signup', '/login', '/auth/session', '/onboarding', '/save-job', '/unsave-job', '/mark-applied', '/update-application', '/remove-application'].includes(url.pathname)) {
    if (!sameOriginPost()) return new Response('Forbidden', { status: 403 });

    if (url.pathname === '/auth/session') {
      let payload;
      try { payload = await request.json(); } catch { return new Response('Invalid request', { status: 400 }); }
      const accessToken = String(payload?.access_token || '');
      const refreshToken = String(payload?.refresh_token || '');
      const returnTo = safeReturnPath(payload?.return);
      if (!accessToken || !refreshToken || accessToken.length > 10000 || refreshToken.length > 10000) return new Response('Invalid session', { status: 400 });
      const user = await getUser(env, accessToken);
      if (!user) return new Response('Invalid session', { status: 401 });
      const state = { user, accessToken };
      const target = returnTo || await defaultPostAuthPath(env, state);
      const responseHeaders = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      setSessionCookies(responseHeaders, { access_token: accessToken, refresh_token: refreshToken, expires_in: Number(payload?.expires_in) || 3600 });
      return new Response(JSON.stringify({ redirect: target }), { status: 200, headers: responseHeaders });
    }

    let form;
    try { form = await request.formData(); } catch { return new Response('Invalid form', { status: 400 }); }

    if (['/save-job', '/unsave-job', '/mark-applied', '/update-application', '/remove-application'].includes(url.pathname)) {
      const inlineSave = ['/save-job', '/unsave-job'].includes(url.pathname) && request.headers.get('accept') === 'application/json';
      const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
      const state = await sessionForRequest(request, env);
      if (inlineSave && (!state.user || !state.accessToken)) return json({ error: 'Please sign in to save this job.' }, 401);
      if (!state.user || !state.accessToken) return Response.redirect(`${url.origin}/login?message=${encodeURIComponent('Log in to manage your jobs.')}&return=${encodeURIComponent('/my-jobs')}`, 303);
      const jobId = String(form.get('job_id') || '');
      if (!/^\d+$/.test(jobId)) return new Response('Invalid job', { status: 400 });
      const returnRaw = String(form.get('return_to') || '');
      const returnTo = (/^\/jobs\/\d+$/.test(returnRaw) || returnRaw === '/matches' || returnRaw === '/my-jobs' || (['/save-job', '/unsave-job'].includes(url.pathname) && returnRaw === '/#opportunities')) ? returnRaw : '/my-jobs';
      try {
        if (url.pathname === '/save-job') await saveJobForUser(env, state.accessToken, state.user.id, jobId);
        if (url.pathname === '/unsave-job') await unsaveJobForUser(env, state.accessToken, state.user.id, jobId);
        if (url.pathname === '/mark-applied') await markJobApplied(env, state.accessToken, state.user.id, jobId);
        if (url.pathname === '/update-application') {
          const allowed = new Set(['applied','interview','offer','hired','rejected','withdrawn']);
          const status = String(form.get('status') || '');
          if (!allowed.has(status)) return new Response('Invalid status', { status: 400 });
          const notes = String(form.get('notes') || '').slice(0, 2000);
          await updateJobApplication(env, state.accessToken, state.user.id, jobId, { status, notes });
        }
        if (url.pathname === '/remove-application') await deleteJobApplication(env, state.accessToken, state.user.id, jobId);
      } catch (error) {
        console.error('My jobs action failed:', error);
        if (inlineSave) return json({ error: 'We could not update that job. Please try again.' }, 502);
        return Response.redirect(`${url.origin}/my-jobs?error=${encodeURIComponent('We could not update that job. Please try again.')}`, 303);
      }
      const suffix = url.pathname === '/mark-applied' ? '?tracked=1' : '';
      const h = new Headers({ location: returnTo + suffix, 'cache-control': 'no-store' });
      if (state.refreshed && typeof state.refreshed === 'object') setSessionCookies(h, state.refreshed);
      if (inlineSave) { h.delete('location'); h.set('content-type', 'application/json'); return new Response(JSON.stringify({ saved: url.pathname === '/save-job' }), { headers: h }); }
      return new Response(null, { status: 303, headers: h });
    }

    if (url.pathname === '/onboarding') {
      const state = await sessionForRequest(request, env);
      if (!state.user || !state.accessToken) return Response.redirect(`${url.origin}/login?message=${encodeURIComponent('Log in to continue setting up your account.')}`, 303);
      const values = name => form.getAll(name).map(v => String(v).trim()).filter(Boolean);
      const allowedRoles = new Set(['Executive Assistant','General VA','Customer Support','Social Media','Marketing','Sales','E-commerce','Bookkeeping','Graphic Design','Video Editing','Operations','Web/Development','Other']);
      const allowedEmployment = new Set(['Full-time','Part-time','Contract/Freelance']);
      const allowedSchedules = new Set(['Philippines daytime','UK/Europe hours','Australia hours','US hours','Flexible/Any']);
      const allowedExperience = new Set(['Entry level','1–2 years','3–5 years','6+ years']);
      const targetRoles = values('target_roles').filter(v => allowedRoles.has(v));
      const employmentTypes = values('employment_types').filter(v => allowedEmployment.has(v));
      const schedulePreferences = values('schedule_preferences').filter(v => allowedSchedules.has(v));
      const experienceLevel = String(form.get('experience_level') || '');
      const salaryRaw = String(form.get('minimum_salary_usd') || '').trim();
      const minimumSalary = salaryRaw === '' ? null : Number.parseInt(salaryRaw, 10);
      const skills = String(form.get('skills') || '').split(',').map(v => v.trim()).filter(Boolean).slice(0, 30).map(v => v.slice(0, 60));
      const invalid = !targetRoles.length || !employmentTypes.length || !schedulePreferences.length || !allowedExperience.has(experienceLevel) || (minimumSalary !== null && (!Number.isInteger(minimumSalary) || minimumSalary < 0 || minimumSalary > 50000));
      if (invalid) return Response.redirect(`${url.origin}/onboarding?error=${encodeURIComponent('Please complete each step before finishing your profile.')}`, 303);
      try {
        await saveJobPreferences(env, state.accessToken, { user_id: state.user.id, target_roles: targetRoles, minimum_salary_usd: minimumSalary, employment_types: employmentTypes, schedule_preferences: schedulePreferences, experience_level: experienceLevel, skills });
        await completeOnboarding(env, state.accessToken);
      } catch (error) {
        console.error('Onboarding save failed:', error);
        return Response.redirect(`${url.origin}/onboarding?error=${encodeURIComponent('We could not save your preferences. Please try again.')}`, 303);
      }
      const h = new Headers({ location: '/?onboarding=complete', 'cache-control': 'no-store' });
      if (state.refreshed && typeof state.refreshed === 'object') setSessionCookies(h, state.refreshed);
      return new Response(null, { status: 303, headers: h });
    }

    const email = String(form.get('email') || '').trim().toLowerCase().slice(0, 254);
    const password = String(form.get('password') || '');
    const fullName = String(form.get('full_name') || '').trim().slice(0, 100);
    const returnTo = safeReturnPath(form.get('return'));
    if (!email || !email.includes('@') || password.length < 8 || password.length > 128) {
      const target = url.pathname === '/signup' ? '/signup' : '/login';
      return Response.redirect(`${url.origin}${target}?error=${encodeURIComponent('Enter a valid email and a password of at least 8 characters.')}&email=${encodeURIComponent(email)}${returnTo ? `&return=${encodeURIComponent(returnTo)}` : ''}`, 303);
    }

    if (url.pathname === '/signup') {
      if (!fullName) return Response.redirect(`${url.origin}/signup?error=${encodeURIComponent('Enter your full name.')}&email=${encodeURIComponent(email)}${returnTo ? `&return=${encodeURIComponent(returnTo)}` : ''}`, 303);
      const { response, data } = await signUp(env, { email, password, fullName, redirectTo: `${siteOrigin}/auth/callback${returnTo ? `?return=${encodeURIComponent(returnTo)}` : ''}` });
      if (!response.ok) return Response.redirect(`${url.origin}/signup?error=${encodeURIComponent(authError(data, 'We could not create your account.'))}&email=${encodeURIComponent(email)}${returnTo ? `&return=${encodeURIComponent(returnTo)}` : ''}`, 303);
      if (data?.access_token && data?.refresh_token) {
        const target = returnTo || '/';
        const h = new Headers({ location: target, 'cache-control': 'no-store' });
        setSessionCookies(h, data);
        return new Response(null, { status: 303, headers: h });
      }
      return Response.redirect(`${url.origin}/check-email?email=${encodeURIComponent(email)}${returnTo ? `&return=${encodeURIComponent(returnTo)}` : ''}`, 303);
    }

    const { response, data } = await signIn(env, { email, password });
    if (!response.ok || !data?.access_token) return Response.redirect(`${url.origin}/login?error=${encodeURIComponent(authError(data, 'Email or password is incorrect.'))}&email=${encodeURIComponent(email)}${returnTo ? `&return=${encodeURIComponent(returnTo)}` : ''}`, 303);
    const state = { user: data.user || await getUser(env, data.access_token), accessToken: data.access_token };
    const target = returnTo || await defaultPostAuthPath(env, state);
    const h = new Headers({ location: target, 'cache-control': 'no-store' });
    setSessionCookies(h, data);
    return new Response(null, { status: 303, headers: h });
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD, POST' } });
  }

  if (request.method === 'HEAD') {
    const result = await handle(
      new Request(request.url),
      env
    );

    return new Response(null, {
      status: result.status,
      headers: result.headers
    });
  }

  let base;
  let authState = { user: null, refreshed: null };
  let showPreferencesPrompt = false;
  let currentProfile = null;
  const onboardingComplete = url.searchParams.get('onboarding') === 'complete';

  const render = (
    title,
    body,
    {
      status = 200,
      description =
        'Explore virtual assistant and other jobs open to Filipino talent. Search opportunities by keyword and category.',
      canonical = base + url.pathname,
      noindex = false
    } = {}
  ) =>
    new Response(
      layout({
        title,
        body,
        description,
        canonical,
        noindex:
          noindex ||
          !env.SITE_URL ||
          base !== url.origin,
        user: authState.user,
        profile: currentProfile,
        showPreferencesPrompt
      }),
      {
        status,
        headers: (() => {
          const h = new Headers(headers);
          h.set('cache-control', status === 200 && !authState.user ? 'public, max-age=60' : 'no-store');
          if (authState.refreshed && typeof authState.refreshed === 'object') setSessionCookies(h, authState.refreshed);
          else if (authState.refreshed === false) clearSessionCookies(h);
          return h;
        })()
      }
    );

  const missing = () =>
    render(
      'Page not found',
      `
        <section class="wrap message">
          <h1>This opportunity has moved on.</h1>
          <p>
            The page does not exist or the listing
            is no longer available.
          </p>
          <a class="button" href="/">
            Explore current jobs
          </a>
        </section>
      `,
      {
        status: 404,
        noindex: true
      }
    );

  try {
    base = origin(env, url);

    /*
     * =====================================================
     * COMPANY LOGO PROXY
     * =====================================================
     *
     * The public page requests:
     *
     *   /company-logo/JOB_ID
     *
     * We then look up that public job and fetch only the
     * company_logo_url already stored for it.
     *
     * This prevents VeeAys from becoming an arbitrary URL
     * proxy.
     */

    const logoMatch =
      url.pathname.match(
        /^\/company-logo\/([1-9]\d*)$/
      );

    if (logoMatch) {
      const jobId = logoMatch[1];

      const job = await getJob(
        env,
        jobId
      );

      if (!job?.company_logo_url) {
        return new Response(
          'Logo not available',
          {
            status: 404,
            headers: {
              'cache-control':
                'public, max-age=300'
            }
          }
        );
      }

      let logoUrl;

      try {
        logoUrl = new URL(
          job.company_logo_url
        );
      } catch {
        return new Response(
          'Invalid logo URL',
          {
            status: 404,
            headers: {
              'cache-control':
                'public, max-age=300'
            }
          }
        );
      }

      /*
       * Only allow logo hosts that VeeAys explicitly
       * collects from supported job platforms.
       *
       * Ashby:
       *   https://app.ashbyhq.com/api/images/...
       *
       * Greenhouse:
       *   https://recruiting.cdn.greenhouse.io/...
       */

      const isAshbyLogo =
  logoUrl.protocol === 'https:' &&
  logoUrl.hostname ===
    'app.ashbyhq.com' &&
  logoUrl.pathname.startsWith(
    '/api/images/'
  );

const isGreenhouseLogo =
  logoUrl.protocol === 'https:' &&
  logoUrl.hostname ===
    'recruiting.cdn.greenhouse.io' &&
  logoUrl.pathname.startsWith(
    '/external_greenhouse_job_boards/'
  );

const isLeverLogo =
  logoUrl.protocol === 'https:' &&
  logoUrl.hostname ===
    'lever-client-logos.s3.us-west-2.amazonaws.com';

if (
  !isAshbyLogo &&
  !isGreenhouseLogo &&
  !isLeverLogo
) {
        console.error(
          'Company logo source not allowed:',
          logoUrl.hostname,
          logoUrl.pathname
        );

       return new Response(
  'Logo source not allowed',
  {
    status: 403,
            headers: {
              'cache-control':
                'public, max-age=300'
            }
          }
        );
      }

      let logoResponse;

      try {
        logoResponse = await fetch(
          logoUrl.toString(),
          {
            headers: {
              'User-Agent':
                'VeeAys/1.0',
              Accept:
                'image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*'
            },
            signal:
              AbortSignal.timeout(
                10000
              )
          }
        );
      } catch (error) {
        console.error(
          'Company logo fetch:',
          error.message
        );

        return new Response(
          'Logo unavailable',
          {
            status: 502,
            headers: {
              'cache-control':
                'public, max-age=60'
            }
          }
        );
      }

      if (!logoResponse.ok) {
        console.error(
          'Company logo fetch:',
          logoResponse.status
        );

        return new Response(
          'Logo unavailable',
          {
            status: 502,
            headers: {
              'cache-control':
                'public, max-age=60'
            }
          }
        );
      }

      const upstreamContentType =
  (
    logoResponse.headers.get(
      'content-type'
    ) || ''
  )
    .split(';')[0]
    .trim()
    .toLowerCase();

const allowedTypes =
  new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/svg+xml'
  ]);

let contentType =
  upstreamContentType;

/*
 * Lever's logo S3 bucket can return company images as
 * application/octet-stream instead of their actual image
 * MIME type.
 *
 * Only permit this fallback for the already allowlisted
 * Lever logo host.
 */

if (
  isLeverLogo &&
  upstreamContentType ===
    'application/octet-stream'
) {
  const pathname =
    logoUrl.pathname.toLowerCase();

  if (
    pathname.endsWith('.png')
  ) {
    contentType = 'image/png';
  } else if (
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg')
  ) {
    contentType = 'image/jpeg';
  } else if (
    pathname.endsWith('.webp')
  ) {
    contentType = 'image/webp';
  } else if (
    pathname.endsWith('.gif')
  ) {
    contentType = 'image/gif';
  } else if (
    pathname.endsWith('.svg')
  ) {
    contentType = 'image/svg+xml';
  }
}

if (
  !allowedTypes.has(
    contentType
  )
) {
  console.error(
    'Unexpected company logo type:',
    upstreamContentType
  );

  return new Response(
    'Invalid logo response',
    {
      status: 502,
      headers: {
        'cache-control':
          'public, max-age=60'
      }
    }
  );
}

      
      return new Response(
        logoResponse.body,
        {
          status: 200,
          headers: {
            'content-type':
              contentType,

            /*
             * Logos rarely change, so cache aggressively.
             */

            'cache-control':
              'public, max-age=86400',

            'x-content-type-options':
              'nosniff',

            'content-security-policy':
              "default-src 'none'",

            'referrer-policy':
              'no-referrer'
          }
        }
      );
    }

    /*
     * =====================================================
     * NORMAL SITE ROUTES
     * =====================================================
     */

    authState = await sessionForRequest(request, env);

    if (url.pathname === '/dismiss-preferences-prompt') {
      const h = new Headers({ location: '/', 'cache-control': 'no-store' });
      h.append('Set-Cookie', 'veeays_preferences_prompt_dismissed=1; Path=/; Max-Age=604800; Secure; HttpOnly; SameSite=Lax');
      if (authState.refreshed && typeof authState.refreshed === 'object') setSessionCookies(h, authState.refreshed);
      return new Response(null, { status: 303, headers: h });
    }

    if (authState.user && authState.accessToken) {
      try {
        currentProfile = await getMyProfile(env, authState.accessToken, authState.user.id);
        if (!hasCookie(request, 'veeays_preferences_prompt_dismissed')) {
          showPreferencesPrompt = currentProfile?.onboarding_completed === false;
        }
      } catch (error) {
        console.error('Profile check failed:', error);
      }
    }

    if (url.pathname === '/logout') {
      const h = new Headers({ location: '/', 'cache-control': 'no-store' });
      clearSessionCookies(h);
      return new Response(null, { status: 303, headers: h });
    }

    if (url.pathname === '/signup' || url.pathname === '/login') {
      if (authState.user) {
        const target = safeReturnPath(url.searchParams.get('return')) || await defaultPostAuthPath(env, authState);
        return Response.redirect(url.origin + target, 303);
      }
      const mode = url.pathname === '/signup' ? 'signup' : 'login';
      return render(mode === 'signup' ? 'Create your account' : 'Log in', authPage({
        mode,
        error: (url.searchParams.get('error') || '').slice(0, 240),
        message: (url.searchParams.get('message') || '').slice(0, 240),
        email: (url.searchParams.get('email') || '').slice(0, 254),
        returnTo: safeReturnPath(url.searchParams.get('return'))
      }), { noindex: true });
    }

    if (url.pathname === '/check-email') {
      if (authState.user) return Response.redirect(url.origin + (safeReturnPath(url.searchParams.get('return')) || await defaultPostAuthPath(env, authState)), 303);
      return render('Check your email', checkEmailPage((url.searchParams.get('email') || '').slice(0, 254), safeReturnPath(url.searchParams.get('return'))), { noindex: true });
    }

    if (url.pathname === '/auth/callback') {
      if (authState.user) return Response.redirect(url.origin + (safeReturnPath(url.searchParams.get('return')) || await defaultPostAuthPath(env, authState)), 303);
      return render('Verifying your email', authCallbackPage(), { noindex: true });
    }

    if (url.pathname === '/onboarding') {
      if (!authState.user || !authState.accessToken) return Response.redirect(url.origin + '/login?message=' + encodeURIComponent('Log in to continue setting up your account.'), 303);
      let preferences = null;
      try { preferences = await getJobPreferences(env, authState.accessToken, authState.user.id); }
      catch (error) { console.error('Preferences load failed:', error); }
      return render('Set up your account', onboardingPage({ user: authState.user, preferences, error: (url.searchParams.get('error') || '').slice(0, 240) }), { noindex: true });
    }

    if (url.pathname === '/pro') {
      const isPro = currentProfile?.plan === 'pro' && currentProfile?.plan_status === 'active';
      return render('VeeAys Pro', proPage({ isPro }), { noindex: false });
    }

    if (url.pathname === '/my-jobs') {
      if (!authState.user || !authState.accessToken) return Response.redirect(url.origin + '/login?message=' + encodeURIComponent('Log in to see your saved jobs and applications.') + '&return=' + encodeURIComponent('/my-jobs'), 303);
      let savedRows = [], applications = [], error = '';
      try {
        [savedRows, applications] = await Promise.all([
          getSavedJobs(env, authState.accessToken, authState.user.id),
          getJobApplications(env, authState.accessToken, authState.user.id)
        ]);
        const ids = [...savedRows.map(r => r.job_id), ...applications.map(r => r.job_id)];
        const jobs = await getJobsByIds(env, ids);
        const byId = new Map(jobs.map(j => [String(j.id), j]));
        savedRows = savedRows.map(r => byId.get(String(r.job_id))).filter(Boolean);
        applications = applications.map(a => ({ ...a, job: byId.get(String(a.job_id)) || null }));
      } catch (e) { console.error('My jobs load failed:', e); error = 'We could not load your jobs right now. Please try again.'; }
      const message = url.searchParams.get('message') || '';
      return render('My jobs', myJobsPage({ saved: savedRows, applications, message: message.slice(0,160), error: (url.searchParams.get('error') || error).slice(0,240) }), { noindex: true });
    }

    if (url.pathname === '/matches') {
      if (!authState.user || !authState.accessToken) {
        return Response.redirect(url.origin + '/login?message=' + encodeURIComponent('Log in to see your job matches.') + '&return=' + encodeURIComponent('/matches'), 303);
      }
      let matches = [];
      let preferences = null;
      let matchSummary = null;
      let savedRows = [];
      let matchError = '';
      try {
        [matches, preferences, matchSummary, savedRows] = await Promise.all([
          getMyJobMatches(env, authState.accessToken, 100),
          getJobPreferences(env, authState.accessToken, authState.user.id),
          getMyMatchSummary(env, authState.accessToken),
          getSavedJobs(env, authState.accessToken, authState.user.id)
        ]);
      } catch (error) {
        console.error('Matches load failed:', error);
        matchError = 'We could not load your matches right now. Please try again.';
      }
      return render('My matches', matchesPage({ matches, preferences, summary: matchSummary, error: matchError, savedJobIds: savedRows.map(r => String(r.job_id)) }), { noindex: true });
    }

    const applyMatch = url.pathname.match(/^\/apply\/([^/]+)$/);
    if (applyMatch) {
      let id;
      try { id = decodeURIComponent(applyMatch[1]); } catch { return missing(); }
      if (!id || id.length > 200) return missing();
      const job = await getJob(env, id);
      if (!job) return missing();
      if (!authState.user) {
        const returnTo = `/apply/${encodeURIComponent(id)}`;
        return Response.redirect(url.origin + `/signup?return=${encodeURIComponent(returnTo)}`, 303);
      }
      const destination = String(job.job_url || '');
      let external;
      try { external = new URL(destination); } catch { return missing(); }
      if (!['https:', 'http:'].includes(external.protocol)) return missing();
      return Response.redirect(external.href, 302);
    }

    if (
      url.pathname.endsWith('/') &&
      url.pathname !== '/'
    ) {
      return Response.redirect(
        url.origin +
          url.pathname.slice(0, -1) +
          url.search,
        308
      );
    }

    if (
      url.pathname === '/robots.txt'
    ) {
      return new Response(
        env.SITE_URL &&
        base === url.origin
          ? `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`
          : 'User-agent: *\nDisallow: /\n',
        {
          headers: {
            'content-type':
              'text/plain; charset=utf-8'
          }
        }
      );
    }

    if (
      url.pathname === '/sitemap.xml'
    ) {
      const { total } =
        await query(
          env,
          { select: 'id' },
          {
            limit: 1,
            count: true
          }
        );

      return xml(
        `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${esc(
          base
        )}/sitemaps/pages.xml</loc></sitemap>${Array.from(
          {
            length:
              Math.ceil(
                total / 1000
              )
          },
          (_, i) =>
            `<sitemap><loc>${esc(
              base
            )}/sitemaps/jobs-${
              i + 1
            }.xml</loc></sitemap>`
        ).join(
          ''
        )}</sitemapindex>`
      );
    }

    if (
      url.pathname ===
      '/sitemaps/pages.xml'
    ) {
      const names =
        await categories(env);

      return xml(
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[
          '/',
          '/categories',
          ...names.map(
            categoryPath
          )
        ]
          .map(
            path =>
              `<url><loc>${esc(
                base + path
              )}</loc></url>`
          )
          .join('')}</urlset>`
      );
    }

    const sitemap =
      url.pathname.match(
        /^\/sitemaps\/jobs-([1-9]\d*)\.xml$/
      );

    if (sitemap) {
      const page =
        Number(sitemap[1]);

      if (
        !Number.isSafeInteger(
          page
        ) ||
        page > 1000000
      ) {
        return missing();
      }

      let rows = [];
      let offset =
        (page - 1) * 1000;

      while (
        rows.length < 1000
      ) {
        const result =
          await query(
            env,
            {
              select: 'id',
              order: 'id.asc'
            },
            {
              offset:
                offset +
                rows.length,
              limit:
                1000 -
                rows.length
            }
          );

        if (
          !result.rows.length
        ) {
          break;
        }

        rows.push(
          ...result.rows
        );
      }

      if (!rows.length) {
        return missing();
      }

      return xml(
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows
          .map(
            job =>
              `<url><loc>${esc(
                base +
                  jobPath(job)
              )}</loc></url>`
          )
          .join('')}</urlset>`
      );
    }

    if (
      url.pathname ===
      '/categories'
    ) {
      const entries = await categories(env, { withCounts: true });
      return render('Explore job categories', categoryPage(entries));
    }

    const jobMatch =
      url.pathname.match(
        /^\/jobs\/([^/]+)$/
      );

    if (jobMatch) {
      let id;

      try {
        id =
          decodeURIComponent(
            jobMatch[1]
          );
      } catch {
        return missing();
      }

      if (
        id.length > 200
      ) {
        return missing();
      }

      const job =
        await getJob(
          env,
          id
        );

      let detailState = { user: authState.user, saved: false, application: null, saveIntent: url.searchParams.get('save') === '1' };
      if (job && authState.user && authState.accessToken) {
        try {
          const [savedRows, applications] = await Promise.all([
            getSavedJobs(env, authState.accessToken, authState.user.id),
            getJobApplications(env, authState.accessToken, authState.user.id)
          ]);
          detailState.saved = savedRows.some(r => String(r.job_id) === String(job.id));
          detailState.application = applications.find(a => String(a.job_id) === String(job.id)) || null;
        } catch (e) { console.error('Job user state failed:', e); }
      }

      return job
        ? render(
            `${
              job.title ||
              'Job opportunity'
            }${
              job.company
                ? ' at ' +
                  job.company
                : ''
            }`,
            detail(job, detailState),
            {
              canonical:
                base +
                jobPath(job),

              description:
                String(
                  job.description ||
                    `Explore this opportunity at ${
                      job.company ||
                      'VeeAys'
                    }.`
                )
                  .replace(
                    /\s+/g,
                    ' '
                  )
                  .slice(
                    0,
                    155
                  )
            }
          )
        : missing();
    }

    const categoryMatch =
      url.pathname.match(
        /^\/categories\/([^/]+)$/
      );

    const browseOnly = url.pathname === '/jobs';

    if (
      url.pathname !== '/' &&
      !browseOnly &&
      !categoryMatch
    ) {
      return missing();
    }

    let category = '';

    try {
      category =
        categoryMatch
          ? decodeURIComponent(
              categoryMatch[1]
            )
          : '';
    } catch {
      return missing();
    }

    const names =
      await categories(env);

    if (
      category &&
      !names.includes(category)
    ) {
      return missing();
    }

    const pageInput =
      url.searchParams.get(
        'page'
      ) || '1';

    if (
      !/^[1-9]\d{0,5}$/.test(
        pageInput
      )
    ) {
      return missing();
    }

    const page =
      Number(pageInput);

    const search =
      (
        url.searchParams.get(
          'q'
        ) || ''
      )
        .trim()
        .slice(
          0,
          120
        );

    const {
      rows,
      total
    } = await listJobs(
      env,
      {
        category,
        search,
        page
      }
    );

    let savedJobIds = [];
    if (authState.user && authState.accessToken) {
      try { savedJobIds = (await getSavedJobs(env, authState.accessToken, authState.user.id)).map(r => String(r.job_id)); }
      catch (e) { console.error('Saved jobs listing state failed:', e); }
    }

    if (
      page > 1 &&
      (page - 1) * 15 >=
        total
    ) {
      return missing();
    }

    return render(
      `${
        category ||
        'Find your next opportunity'
      }${
        page > 1
          ? ` — Page ${page}`
          : ''
      }`,
      listing({
        rows,
        total,
        page,
        search,
        category,
        names,
        showPreferencesPrompt,
        onboardingComplete,
        user: authState.user,
        savedJobIds,
        browseOnly
      }),
      {
        canonical:
          base +
          (
            category
              ? categoryPath(
                  category
                )
              : browseOnly ? '/jobs' : '/'
          ) +
          (
            page > 1
              ? `?page=${page}`
              : ''
          ),

        noindex:
          !!search
      }
    );
  } catch (error) {
    console.error(
      'Jobs frontend:',
      error.message
    );

    base ||= url.origin;

    const response =
      render(
        'Temporarily unavailable',
        '<section class="wrap message"><div class="kicker">BACK SOON</div><h1>A little pause<br>in your job search.</h1><p>We couldn’t load opportunities right now. Please try again shortly.</p><a class="button" href="/">Try again</a></section>',
        {
          status: 503,
          noindex: true
        }
      );

    response.headers.set(
      'Retry-After',
      '60'
    );

    return response;
  }
}
export default { fetch: handle, scheduled(controller,env) {
  // Separate cron invocations preserve Strong Match behavior and its subrequest budget.
  return controller.cron===DIGEST_CRON ? scheduledDailyDigest(controller,env) : scheduledStrongMatches(controller,env);
} };
